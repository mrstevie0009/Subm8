// src/app/[locale]/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import HomeFeedClient from '@/components/HomeFeedClient';
import type { FeedPost } from '@/components/PostCard';

export const dynamic = 'force-dynamic';

type Params = { locale: string };

export default async function HomePage({ params }: { params: Promise<Params> }) {
  await params; // locale wird hier nicht benötigt

  const me = await getCurrentUser().catch(() => null);

  const [posts, likedByMe, bookmarkedByMe] = await Promise.all([
    prisma.post.findMany({
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
        // Repost: Zähler & Daten vom Original
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
        // Quote: eingebetteter Original-Post
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
      take: 30,
    }),
    me
      ? prisma.like.findMany({ where: { userId: me.id }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({ where: { userId: me.id }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
  ]);

  const likedSet = new Set(likedByMe.map((l) => l.postId));
  const bookmarkedSet = new Set(bookmarkedByMe.map((b) => b.postId));

  // Block-Flags bezogen auf den Feed-Item-Autor (bei Repost = Reposter)
  let hasBlockedSet = new Set<string>();
  let blockedBySet = new Set<string>();
  if (me) {
    const feedAuthorIds = Array.from(new Set(posts.map((p) => p.author.id)));
    if (feedAuthorIds.length > 0) {
      const [myBlocks, blocksMe] = await Promise.all([
        prisma.block.findMany({
          where: { blockerId: me.id, blockedId: { in: feedAuthorIds } },
          select: { blockedId: true },
        }),
        prisma.block.findMany({
          where: { blockerId: { in: feedAuthorIds }, blockedId: me.id },
          select: { blockerId: true },
        }),
      ]);
      hasBlockedSet = new Set(myBlocks.map((b) => b.blockedId));
      blockedBySet = new Set(blocksMe.map((b) => b.blockerId));
    }
  }

  const items: FeedPost[] = posts.map((p) => {
    const isRepost = !!p.repostOf;
    const isQuote = !!p.quoteOf;

    // Inhalt (bei Repost: Original; sonst eigener Inhalt + optionale Quote-Box)
    const content = isRepost
      ? {
          id: p.repostOf!.id,
          text: p.repostOf!.text ?? '',
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
          quote: null,
        }
      : {
          id: p.id,
          text: p.text ?? '',
          mediaUrl: p.mediaUrl,
          mediaAlt: p.mediaAlt,
          createdAt: p.createdAt.toISOString(),
          author: {
            id: p.author.id,
            handle: p.author.handle,
            displayName: p.author.displayName,
            role: p.author.role,
            avatarUrl: p.author.avatarUrl,
          },
          quote: isQuote
            ? {
                id: p.quoteOf!.id,
                text: p.quoteOf!.text ?? '',
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
        };

    // Repost → Stats vom Original; Quote/Normal → eigene Stats
    const statSource = isRepost ? p.repostOf! : p;

    // Viewer-Flags: Like/Bookmark-Ziel bestimmen
    const viewerTargetId = isRepost ? p.repostOf!.id : p.id;

    return {
      id: p.id,
      createdAtISO: p.createdAt.toISOString(),
      content,
      reposter: isRepost
        ? {
            id: p.author.id,
            handle: p.author.handle,
            displayName: p.author.displayName,
          }
        : null,
      stats: {
        comments: statSource._count.Comment ?? 0,
        reposts: statSource._count.reposts ?? 0,
        likes: statSource._count.Like ?? 0,
      },
      viewer: {
        liked: likedSet.has(viewerTargetId),
        bookmarked: bookmarkedSet.has(viewerTargetId),
        hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
        blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
      },
      initiallyBookmarked: bookmarkedSet.has(viewerTargetId),
    } satisfies FeedPost;
  });

  return <HomeFeedClient initialItems={items} />;
}
