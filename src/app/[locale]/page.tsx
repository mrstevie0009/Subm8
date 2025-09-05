import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import type { Post as PostCardPost } from '@/components/PostCard';
import { relativeTime } from '@/lib/relativeTime';
import type { Role } from '@prisma/client';
import HomeFeedClient from '@/components/HomeFeedClient';

export const dynamic = 'force-dynamic';

type Params = { locale: string };

function toUiRole(role: Role): 'domme' | 'submissive' {
  return role === 'DOMME' ? 'domme' : 'submissive';
}

export type FeedPost = PostCardPost & {
  initiallyBookmarked?: boolean;
  createdAtISO: string; // für spätere Abfragen im Client
};

export default async function HomePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;
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
        _count: { select: { Like: true, Comment: true } },
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

  // Block-Flags (Viewer vs. Autoren)
  let hasBlockedSet = new Set<string>();
  let blockedBySet = new Set<string>();
  if (me) {
    const authorIds = Array.from(new Set(posts.map((p) => p.author.id)));
    if (authorIds.length > 0) {
      const [myBlocks, blocksMe] = await Promise.all([
        prisma.block.findMany({
          where: { blockerId: me.id, blockedId: { in: authorIds } },
          select: { blockedId: true },
        }),
        prisma.block.findMany({
          where: { blockerId: { in: authorIds }, blockedId: me.id },
          select: { blockerId: true },
        }),
      ]);
      hasBlockedSet = new Set(myBlocks.map((b) => b.blockedId));
      blockedBySet = new Set(blocksMe.map((b) => b.blockerId));
    }
  }

  const items: FeedPost[] = posts.map((p) => ({
    id: p.id,
    author: {
      name: p.author.displayName,
      role: toUiRole(p.author.role),
      handle: p.author.handle,
      avatarUrl: p.author.avatarUrl ?? undefined,
    },
    createdAt: relativeTime(p.createdAt, locale),
    createdAtISO: p.createdAt.toISOString(),
    text: p.text,
    mediaUrl: p.mediaUrl ?? undefined,
    mediaAlt: p.mediaAlt ?? undefined,
    stats: {
      comments: p._count.Comment ?? 0,
      reposts: 0,
      likes: p._count.Like ?? 0,
    },
    viewer: {
      liked: likedSet.has(p.id),
      bookmarked: bookmarkedSet.has(p.id),
      hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
      blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
    },
    initiallyBookmarked: bookmarkedSet.has(p.id),
  }));

  return <HomeFeedClient initialItems={items} locale={locale} />;
}
