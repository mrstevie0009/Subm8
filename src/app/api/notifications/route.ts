// src/app/api/notifications/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

// ---------- API Item Types (Server) ----------
type NotiUser = { handle: string; displayName: string; avatarUrl?: string | null };

type NotiItem =
  | { id: string; kind: 'follow'; time: string; user: NotiUser }
  | { id: string; kind: 'like'; time: string; user: NotiUser; text: string; postId: string }               // like on your POST
  | { id: string; kind: 'mention'; time: string; user: NotiUser; text: string; postId?: string }
  | { id: string; kind: 'comment'; time: string; user: NotiUser; text: string; postId: string }            // comment on your POST (not a reply to you)
  | { id: string; kind: 'reply'; time: string; user: NotiUser; text: string; postId: string }              // reply to YOUR COMMENT
  | { id: string; kind: 'comment_like'; time: string; user: NotiUser; text: string; postId: string };      // like on YOUR COMMENT

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });

    const url = new URL(req.url);
    const tab = (url.searchParams.get('tab') || 'all') as 'all' | 'mentions' | 'comments';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

    // ---- Follows (you are the followee) ----
    const follows = await prisma.follow.findMany({
      where: { followeeId: me.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { follower: { select: { handle: true, displayName: true, avatarUrl: true } } },
    });

    // ---- Likes on your POSTS ----
    const postLikes = await prisma.like.findMany({
      where: { Post: { authorId: me.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        User: { select: { handle: true, displayName: true, avatarUrl: true } },
        Post: { select: { id: true, text: true } },
      },
    });

    // ---- Mentions in posts & comments ----
    const handlePattern = `@${me.handle}`;

    const postsWithMention = await prisma.post.findMany({
      where: { text: { contains: handlePattern, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        author: { select: { handle: true, displayName: true, avatarUrl: true } },
      },
    });

    const commentsWithMention = await prisma.comment.findMany({
      where: { text: { contains: handlePattern, mode: 'insensitive' } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        User: { select: { handle: true, displayName: true, avatarUrl: true } },
        Post: { select: { id: true } },
      },
    });

    // ---- Replies to YOUR comments ----
    const repliesToMe = await prisma.comment.findMany({
      where: {
        parent: { userId: me.id },          // replying to a comment that you authored
        userId: { not: me.id },             // ignore your own replies
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        User: { select: { handle: true, displayName: true, avatarUrl: true } },
        Post: { select: { id: true } },
      },
    });

    // ---- Comments on YOUR posts (that are NOT replies to you) ----
    const commentsOnMyPosts = await prisma.comment.findMany({
      where: {
        Post: { authorId: me.id },
        userId: { not: me.id },
        OR: [
          { parentId: null },                               // top level
          { parent: { userId: { not: me.id } } },           // reply, but not to you
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true, createdAt: true, text: true,
        User: { select: { handle: true, displayName: true, avatarUrl: true } },
        Post: { select: { id: true } },
      },
    });

    // ---- Likes on YOUR comments ----
    const commentLikes = await prisma.commentLike.findMany({
      where: { comment: { userId: me.id }, userId: { not: me.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { handle: true, displayName: true, avatarUrl: true } },
        comment: { select: { text: true, Post: { select: { id: true } } } },
      },
    });

    // ---- Build unified list ----
    const notis: NotiItem[] = [
      ...follows.map((f) => ({
        id: `follow:${f.id}`,
        kind: 'follow' as const,
        time: f.createdAt.toISOString(),
        user: { handle: f.follower.handle, displayName: f.follower.displayName, avatarUrl: f.follower.avatarUrl },
      })),
      ...postLikes.map((l) => ({
        id: `like:${l.userId}:${l.postId}:${l.createdAt.getTime()}`,
        kind: 'like' as const,
        time: l.createdAt.toISOString(),
        user: { handle: l.User.handle, displayName: l.User.displayName, avatarUrl: l.User.avatarUrl },
        text: l.Post.text,
        postId: l.Post.id,
      })),
      ...postsWithMention.map((p) => ({
        id: `mention:post:${p.id}`,
        kind: 'mention' as const,
        time: p.createdAt.toISOString(),
        user: { handle: p.author.handle, displayName: p.author.displayName, avatarUrl: p.author.avatarUrl },
        text: p.text,
        postId: p.id,
      })),
      ...commentsWithMention.map((c) => ({
        id: `mention:comment:${c.id}`,
        kind: 'mention' as const,
        time: c.createdAt.toISOString(),
        user: { handle: c.User.handle, displayName: c.User.displayName, avatarUrl: c.User.avatarUrl },
        text: c.text,
        postId: c.Post.id,
      })),
      ...repliesToMe.map((r) => ({
        id: `reply:${r.id}`,
        kind: 'reply' as const,
        time: r.createdAt.toISOString(),
        user: { handle: r.User.handle, displayName: r.User.displayName, avatarUrl: r.User.avatarUrl },
        text: r.text,
        postId: r.Post.id,
      })),
      ...commentsOnMyPosts.map((c) => ({
        id: `comment:${c.id}`,
        kind: 'comment' as const,
        time: c.createdAt.toISOString(),
        user: { handle: c.User.handle, displayName: c.User.displayName, avatarUrl: c.User.avatarUrl },
        text: c.text,
        postId: c.Post.id,
      })),
      ...commentLikes.map((cl) => ({
        id: `comment_like:${cl.userId}:${cl.commentId}:${cl.createdAt.getTime()}`,
        kind: 'comment_like' as const,
        time: cl.createdAt.toISOString(),
        user: { handle: cl.user.handle, displayName: cl.user.displayName, avatarUrl: cl.user.avatarUrl },
        text: cl.comment.text,
        postId: cl.comment.Post.id,
      })),
    ];

    // de-dupe + sort + filter tab
    const seen = new Set<string>();
    const sorted = notis
      .sort((a, b) => +new Date(b.time) - +new Date(a.time))
      .filter((n) => {
        if (tab === 'mentions') return n.kind === 'mention';
        if (tab === 'comments') return n.kind === 'comment' || n.kind === 'reply' || n.kind === 'comment_like';
        return true; // 'all'
      })
      .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
      .slice(0, limit);

    return NextResponse.json({ ok: true, items: sorted });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('notifications GET failed:', err);
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
