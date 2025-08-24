// src/app/[locale]/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import PostCard from '@/components/PostCard';
import type { Post as PostCardPost } from '@/components/PostCard';
import { relativeTime } from '@/lib/relativeTime';
import type { Role } from '@prisma/client';

type Params = { locale: string };

function toUiRole(role: Role): 'domme' | 'submissive' {
  return role === 'DOMME' ? 'domme' : 'submissive';
}

// Extra-Feld ist ok; PostCard ignoriert Unbekanntes
type FeedPost = PostCardPost & { initiallyBookmarked?: boolean };

export default async function HomePage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  const me = await getCurrentUser().catch(() => null);

  const [posts, likedByMe, bookmarkedByMe] = await Promise.all([
    prisma.post.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: true,
        _count: { select: { Like: true, Comment: true } },
      },
      take: 30,
    }),
    me
      ? prisma.like.findMany({
          where: { userId: me.id },
          select: { postId: true },
        })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({
          where: { userId: me.id },
          select: { postId: true },
        })
      : Promise.resolve([] as { postId: string }[]),
  ]);

  const likedSet = new Set(likedByMe.map((l) => l.postId));
  const bookmarkedSet = new Set(bookmarkedByMe.map((b) => b.postId));

  const items: FeedPost[] = posts.map((p) => ({
    id: p.id,
    author: {
      name: p.author.displayName,
      role: toUiRole(p.author.role),
      handle: p.author.handle,
      avatarUrl: p.author.avatarUrl ?? undefined,
    },
    createdAt: relativeTime(p.createdAt, locale),
    text: p.text,
    mediaUrl: p.mediaUrl ?? undefined,
    mediaAlt: p.mediaAlt ?? undefined,
    stats: {
      comments: p._count.Comment ?? 0,
      reposts: 0,           // (kein Repost-Modell vorhanden)
      likes: p._count.Like ?? 0,
    },
    viewer: {
      liked: likedSet.has(p.id),
      bookmarked: bookmarkedSet.has(p.id),
    },
    initiallyBookmarked: bookmarkedSet.has(p.id),
  }));

  return (
    <section className="grid gap-3">
      {items.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </section>
  );
}
