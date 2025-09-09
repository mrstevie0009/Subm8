// src/app/api/feed/route.ts
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
    const count = await prisma.post.count({ where: { createdAt: { gt: sinceDate } } });
    return NextResponse.json({ count });
  }

  const posts = await prisma.post.findMany({
    where: { createdAt: { gt: sinceDate } },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: { id: true, handle: true, displayName: true, role: true, avatarUrl: true },
      },
      repostOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true,
          mediaAlt: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              role: true,
              avatarUrl: true,
            },
          },
          _count: { select: { Like: true, Comment: true, reposts: true } },
        },
      },
      quoteOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true,
          mediaAlt: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              role: true,
              avatarUrl: true,
            },
          },
        },
      },
      _count: { select: { Like: true, Comment: true, reposts: true } },
    },
    take: 50,
  });

  // Für Likes/Bookmarks/Block-Status:
  const likeTargetIds = posts.map((p) => (p.repostOf ? p.repostOf.id : p.id)); // Likes auf's Original bei Repost
  const bookmarkIds = posts.map((p) => p.id); // Bookmarks aufs Feed-Item
  const authorIds = Array.from(new Set(posts.map((p) => p.authorId)));

  const [likes, bms, myBlocks, blocksMe] = await Promise.all([
    me
      ? prisma.like.findMany({
          where: { userId: me.id, postId: { in: likeTargetIds } },
          select: { postId: true },
        })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({
          where: { userId: me.id, postId: { in: bookmarkIds } },
          select: { postId: true },
        })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.block.findMany({
          where: { blockerId: me.id, blockedId: { in: authorIds } },
          select: { blockedId: true },
        })
      : Promise.resolve([] as { blockedId: string }[]),
    me
      ? prisma.block.findMany({
          where: { blockerId: { in: authorIds }, blockedId: me.id },
          select: { blockerId: true },
        })
      : Promise.resolve([] as { blockerId: string }[]),
  ]);

  const likedSet = new Set(likes.map((l) => l.postId));
  const bookmarkedSet = new Set(bms.map((b) => b.postId));
  const hasBlockedSet = new Set(myBlocks.map((b) => b.blockedId));
  const blockedBySet = new Set(blocksMe.map((b) => b.blockerId));

  return NextResponse.json({
    posts: posts.map((p) => {
      const isRepost = !!p.repostOf;
      const isQuote = !!p.quoteOf;

      const statSource = isRepost ? p.repostOf! : p; // Repost: Zähler vom Original
      const likeRefId = isRepost ? p.repostOf!.id : p.id; // Likes aufs Original bei Repost

      return {
        id: p.id,
        text: p.text,
        mediaUrl: p.mediaUrl,
        mediaAlt: p.mediaAlt,
        createdAt: p.createdAt.toISOString(),

        _count: {
          Like: statSource._count.Like ?? 0,
          Comment: statSource._count.Comment ?? 0,
          reposts: statSource._count.reposts ?? 0,
        },

        author: {
          id: p.author.id,
          handle: p.author.handle,
          displayName: p.author.displayName,
          role: p.author.role,
          avatarUrl: p.author.avatarUrl,
        },

        repostOf: isRepost
          ? {
              id: p.repostOf!.id,
              text: p.repostOf!.text,
              mediaUrl: p.repostOf!.mediaUrl,
              mediaAlt: p.repostOf!.mediaAlt,
              createdAt: p.repostOf!.createdAt.toISOString(),
              author: {
                id: p.repostOf!.author.id,
                handle: p.repostOf!.author.handle,
                displayName: p.repostOf!.author.displayName,
                role: p.repostOf!.author.role,
                avatarUrl: p.repostOf!.author.avatarUrl,
              },
            }
          : null,

        quoteOf: isQuote
          ? {
              id: p.quoteOf!.id,
              text: p.quoteOf!.text,
              mediaUrl: p.quoteOf!.mediaUrl,
              mediaAlt: p.quoteOf!.mediaAlt,
              createdAt: p.quoteOf!.createdAt.toISOString(),
              author: {
                id: p.quoteOf!.author.id,
                handle: p.quoteOf!.author.handle,
                displayName: p.quoteOf!.author.displayName,
                role: p.quoteOf!.author.role,
                avatarUrl: p.quoteOf!.author.avatarUrl,
              },
            }
          : null,

        viewer: {
          liked: likedSet.has(likeRefId),
          bookmarked: bookmarkedSet.has(p.id),
          hasBlockedAuthor: me ? hasBlockedSet.has(p.authorId) : false,
          blockedByAuthor: me ? blockedBySet.has(p.authorId) : false,
        },
      };
    }),
  });
}
