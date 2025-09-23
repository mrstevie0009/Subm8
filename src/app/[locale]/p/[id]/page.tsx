import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PostCard, { type FeedPost } from '@/components/PostCard';
import PostDetailHeader from '@/components/PostDetailHeader';
import CommentsThread from '@/components/comments/CommentsThread';

type Params = { locale: string; id: string };

export default async function PostDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const p = await prisma.post.findUnique({
    where: { id },
    include: {
      Community: {
        select: { name: true, slug: true }
      },
      author: {
        select: { id: true, handle: true, displayName: true, role: true, avatarUrl: true }
      },
      repostOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true,
          mediaAlt: true,
          createdAt: true,
          author: {
            select: { id: true, handle: true, displayName: true, role: true, avatarUrl: true }
          },
          _count: { select: { Like: true, Comment: true, reposts: true } }
        }
      },
      quoteOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true,
          mediaAlt: true,
          createdAt: true,
          author: {
            select: { id: true, handle: true, displayName: true, role: true, avatarUrl: true }
          }
        }
      },
      _count: { select: { Like: true, Comment: true, reposts: true } }
    }
  });

  if (!p) notFound();

  const isRepost = !!p.repostOf;

  const content: FeedPost['content'] = isRepost
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
          avatarUrl: p.repostOf!.author.avatarUrl
        },
        quote: null
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
          avatarUrl: p.author.avatarUrl
        },
        quote: p.quoteOf
          ? {
              id: p.quoteOf.id,
              text: p.quoteOf.text ?? '',
              mediaUrl: p.quoteOf.mediaUrl,
              mediaAlt: p.quoteOf.mediaAlt,
              createdAt: p.quoteOf.createdAt.toISOString(),
              author: {
                id: p.quoteOf.author.id,
                handle: p.quoteOf.author.handle,
                displayName: p.quoteOf.author.displayName,
                role: p.quoteOf.author.role,
                avatarUrl: p.quoteOf.author.avatarUrl
              }
            }
          : null
      };

  const statSource = isRepost ? p.repostOf! : p;

  const item: FeedPost = {
    id: p.id,
    createdAtISO: p.createdAt.toISOString(),
    content,
    reposter: isRepost
      ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName }
      : null,
    stats: {
      comments: statSource._count.Comment ?? 0,
      reposts: statSource._count.reposts ?? 0,
      likes: statSource._count.Like ?? 0
    },
    viewer: {
      liked: false,
      bookmarked: false,
      hasBlockedAuthor: false,
      blockedByAuthor: false
    },
    initiallyBookmarked: false,
    community: p.Community ? { name: p.Community.name, slug: p.Community.slug } : null
  };

  return (
    <>
      <PostDetailHeader />
      <section className="max-w-2xl mx-auto grid gap-4">
        <PostCard post={item} />
        <CommentsThread postId={item.id} />
      </section>
    </>
  );
}
