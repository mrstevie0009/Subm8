// src/app/api/post/[id]/comments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

type Params = { id: string };

// ---------------- Types ----------------

type UserSlim = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'DOMME' | 'SUBMISSIVE';
};

type CommentRow = {
  id: string;
  text: string;
  createdAt: Date;
  parentId: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  User: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    role: 'DOMME' | 'SUBMISSIVE';
  };
  _count: {
    likes: number;
    replies: number;
  };
};

export type TreeComment = {
  id: string;
  text: string;
  createdAt: string; // ISO
  parentId: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  author: UserSlim;
  counts: { likes: number; replies: number };
  viewer: { liked: boolean };
  children: TreeComment[];
};

// ----------- small in-memory limiter -----------

const MIN_GAP_MS = 800;
const lastHit = new Map<string, number>();

function clientKey(req: Request, postId: string) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'local';
  const ua = req.headers.get('user-agent') || '';
  return `${ip}:${postId}:${ua.slice(0, 40)}`;
}

// ----------------- Handler -----------------

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  // ignore prefetches
  const prefetch =
    req.headers.get('purpose') === 'prefetch' ||
    req.headers.get('sec-purpose') === 'prefetch' ||
    req.headers.get('x-middleware-prefetch') === '1' ||
    req.headers.get('next-router-prefetch') === '1';
  if (prefetch) return new NextResponse(null, { status: 204 });

  // rate limit per client × post
  const key = clientKey(req, id);
  const now = Date.now();
  const last = lastHit.get(key) ?? 0;
  if (now - last < MIN_GAP_MS) {
    return NextResponse.json(
      { ok: true, throttled: true, items: [] as TreeComment[], nextCursor: null as string | null },
      { status: 200, headers: { 'Cache-Control': 'no-store', 'X-Comments-Throttled': '1' } },
    );
  }
  lastHit.set(key, now);

  try {
    const me = await getCurrentUser();

    const { searchParams } = new URL(req.url);
    const after = searchParams.get('after');
    const take = 25;

    // 1) top-level comments
    const top: CommentRow[] = await prisma.comment.findMany({
      where: { postId: id, parentId: null },
      orderBy: { createdAt: 'asc' },
      ...(after ? { cursor: { id: after }, skip: 1 } : {}),
      take,
      select: {
        id: true,
        text: true,
        createdAt: true,
        parentId: true,
        mediaUrl: true,
        mediaAlt: true,
        User: { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true } },
        _count: { select: { likes: true, replies: true } },
      },
    });

    // 2) fetch all children of these nodes (BFS)
    const queue: string[] = top.map((c) => c.id);
    const nodes: Record<string, CommentRow> = {};
    for (const c of top) nodes[c.id] = c;

    while (queue.length) {
      const parentIds = queue.splice(0, 30);
      const children: CommentRow[] = await prisma.comment.findMany({
        where: { parentId: { in: parentIds } },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          text: true,
          createdAt: true,
          parentId: true,
          mediaUrl: true,
          mediaAlt: true,
          User: { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true } },
          _count: { select: { likes: true, replies: true } },
        },
      });
      for (const ch of children) {
        nodes[ch.id] = ch;
        queue.push(ch.id);
      }
    }

    // 3) parentId -> children map
    const byParent: Map<string | null, CommentRow[]> = new Map();
    Object.values(nodes).forEach((n) => {
      const k = n.parentId;
      const list = byParent.get(k) ?? [];
      list.push(n);
      byParent.set(k, list);
    });

    // viewer.liked: alle IDs sammeln und Likes des Viewers ziehen
    const allIds = Object.keys(nodes);
    const likedSet = new Set<string>();
    if (me && allIds.length) {
      const liked = await prisma.commentLike.findMany({
        where: { userId: me.id, commentId: { in: allIds } },
        select: { commentId: true },
      });
      for (const r of liked) likedSet.add(r.commentId);
    }

    // 4) transform to tree
    const toTree = (parentId: string | null): TreeComment[] =>
      (byParent.get(parentId) ?? []).map<TreeComment>((n) => ({
        id: n.id,
        text: n.text,
        createdAt: n.createdAt.toISOString(),
        parentId: n.parentId,
        mediaUrl: n.mediaUrl,
        mediaAlt: n.mediaAlt,
        author: {
          id: n.User.id,
          handle: n.User.handle,
          displayName: n.User.displayName,
          avatarUrl: n.User.avatarUrl,
          role: n.User.role,
        },
        counts: { likes: n._count.likes, replies: n._count.replies },
        viewer: { liked: likedSet.has(n.id) },
        children: toTree(n.id),
      }));

    const items: TreeComment[] = toTree(null);
    const nextCursor: string | null = top.length === take ? top[top.length - 1]!.id : null;

    return NextResponse.json(
      { ok: true, items, nextCursor },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } },
    );
  } catch (e) {
    console.error('GET /api/post/[id]/comments failed:', e);
    return NextResponse.json({ ok: false, error: 'Failed to load comments' }, { status: 500 });
  }
}
