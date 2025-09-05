import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sinceISO = searchParams.get('since');
  const onlyCount = searchParams.get('onlyCount') === '1';

  const sinceDate = sinceISO ? new Date(sinceISO) : new Date(0);
  if (Number.isNaN(sinceDate.getTime())) {
    return NextResponse.json({ posts: [], count: 0 });
  }

  const me = await getCurrentUser().catch(() => null);

  if (onlyCount) {
    const count = await prisma.post.count({
      where: { createdAt: { gt: sinceDate } },
    });
    return NextResponse.json({ count });
  }

  // neue Posts seit "since"
  const posts = await prisma.post.findMany({
    where: { createdAt: { gt: sinceDate } },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          role: true,
          avatarUrl: true,
        },
      },
      _count: { select: { Like: true, Comment: true } },
    },
    take: 50,
  });

  // Likes/Bookmarks/Block-Status für Viewer
  const postIds = posts.map((p) => p.id);
  const authorIds = Array.from(new Set(posts.map((p) => p.author.id)));

  const [likes, bms, myBlocks, blocksMe] = await Promise.all([
    me
      ? prisma.like.findMany({ where: { userId: me.id, postId: { in: postIds } }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({ where: { userId: me.id, postId: { in: postIds } }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.block.findMany({ where: { blockerId: me.id, blockedId: { in: authorIds } }, select: { blockedId: true } })
      : Promise.resolve([] as { blockedId: string }[]),
    me
      ? prisma.block.findMany({ where: { blockerId: { in: authorIds }, blockedId: me.id }, select: { blockerId: true } })
      : Promise.resolve([] as { blockerId: string }[]),
  ]);

  const likedSet = new Set(likes.map((l) => l.postId));
  const bookmarkedSet = new Set(bms.map((b) => b.postId));
  const hasBlockedSet = new Set(myBlocks.map((b) => b.blockedId));
  const blockedBySet = new Set(blocksMe.map((b) => b.blockerId));

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      text: p.text,
      mediaUrl: p.mediaUrl,
      mediaAlt: p.mediaAlt,
      createdAt: p.createdAt.toISOString(),
      _count: p._count,
      author: {
        id: p.author.id,
        handle: p.author.handle,
        displayName: p.author.displayName,
        role: p.author.role,
        avatarUrl: p.author.avatarUrl,
      },
      viewer: {
        liked: likedSet.has(p.id),
        bookmarked: bookmarkedSet.has(p.id),
        hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
        blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
      },
    })),
  });
}
