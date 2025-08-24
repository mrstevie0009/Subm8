import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

type NotiItem =
  | { id: string; kind: 'follow'; time: string; user: { handle: string; displayName: string; avatarUrl?: string | null } }
  | { id: string; kind: 'like'; time: string; user: { handle: string; displayName: string; avatarUrl?: string | null }; text: string; postId: string }
  | { id: string; kind: 'mention'; time: string; user: { handle: string; displayName: string; avatarUrl?: string | null }; text: string; postId?: string };

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });

    const url = new URL(req.url);
    const tab = (url.searchParams.get('tab') || 'all') as 'all' | 'mentions';
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100);

    const follows = await prisma.follow.findMany({
      where: { followeeId: me.id },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        follower: { select: { handle: true, displayName: true, avatarUrl: true } },
      },
    });

    const likes = await prisma.like.findMany({
      where: { Post: { authorId: me.id } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        User: { select: { handle: true, displayName: true, avatarUrl: true } },
        Post: { select: { id: true, text: true } },
      },
    });

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

    const notis: NotiItem[] = [
      ...follows.map((f) => ({
        id: `follow:${f.id}`,
        kind: 'follow' as const,
        time: f.createdAt.toISOString(),
        user: {
          handle: f.follower.handle,
          displayName: f.follower.displayName,
          avatarUrl: f.follower.avatarUrl,
        },
      })),
      ...likes.map((l) => ({
        id: `like:${l.userId}:${l.postId}:${l.createdAt.getTime()}`,
        kind: 'like' as const,
        time: l.createdAt.toISOString(),
        user: {
          handle: l.User.handle,
          displayName: l.User.displayName,
          avatarUrl: l.User.avatarUrl,
        },
        text: l.Post.text,
        postId: l.Post.id,
      })),
      ...postsWithMention.map((p) => ({
        id: `mention:post:${p.id}`,
        kind: 'mention' as const,
        time: p.createdAt.toISOString(),
        user: {
          handle: p.author.handle,
          displayName: p.author.displayName,
          avatarUrl: p.author.avatarUrl,
        },
        text: p.text,
        postId: p.id,
      })),
      ...commentsWithMention.map((c) => ({
        id: `mention:comment:${c.id}`,
        kind: 'mention' as const,
        time: c.createdAt.toISOString(),
        user: {
          handle: c.User.handle,
          displayName: c.User.displayName,
          avatarUrl: c.User.avatarUrl,
        },
        text: c.text,
        postId: c.Post.id,
      })),
    ];

    const seen = new Set<string>();
    const sorted = notis
      .sort((a, b) => +new Date(b.time) - +new Date(a.time))
      .filter((n) => (tab === 'mentions' ? n.kind === 'mention' : true))
      .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
      .slice(0, limit);

    return NextResponse.json({ ok: true, items: sorted });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') console.error('notifications GET failed:', err);
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
