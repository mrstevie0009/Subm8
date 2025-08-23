// src/app/[locale]/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import PostCard from '@/components/PostCard';
import type { Post as PostCardPost } from '@/components/PostCard';
import { relativeTime } from '@/lib/relativeTime';
import type { Role } from '@prisma/client';

type Params = { locale: string };

// Prisma → UI-Role Mapping
function toUiRole(role: Role): 'domme' | 'submissive' {
  return role === 'DOMME' ? 'domme' : 'submissive';
}

// Wir erlauben optional ein zusätzliches Feld für das Bookmark-Icon.
// Extra Felder stören die PostCard nicht (strukturelle Typisierung).
type FeedPost = PostCardPost & { initiallyBookmarked?: boolean };

export default async function HomePage({
  params,
}: { params: Promise<Params> }) {
  const { locale } = await params;

  const me = await getCurrentUser().catch(() => null);

  const posts = await prisma.post.findMany({
    orderBy: { createdAt: 'desc' },
    include: { author: true },
    take: 30,
  });

  const bookmarkedSet = me
    ? new Set(
        (await prisma.bookmark.findMany({
          where: { userId: me.id },
          select: { postId: true },
        })).map((b) => b.postId)
      )
    : new Set<string>();

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
    stats: { comments: 0, reposts: 0, likes: 0 },
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
