// src/app/[locale]/p/[id]/page.tsx
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PostCard, { type FeedPost } from '@/components/PostCard';
import PostDetailHeader from '@/components/PostDetailHeader';
import CommentsThread from '@/components/comments/CommentsThread';

// ⬇️ NEU: Session holen (Pfad zu authOptions ggf. anpassen)
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/** Prisma UploadedMedia -> PostCard.ContentMedia */
function mapUploaded(
  rows: Array<{ url: string; alt: string | null; type: string | null }> | null | undefined
) {
  return (rows ?? []).map((u) => {
    const mime = u.type ?? null;
    const kind: 'image' | 'video' | 'gif' =
      mime === 'image/gif' ? 'gif' : mime?.startsWith('video/') ? 'video' : 'image';
    return { url: u.url, alt: u.alt ?? null, kind };
  });
}

type Params = { locale: string; id: string };

export default async function PostDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  const p = await prisma.post.findUnique({
    where: { id },
    include: {
      Community: { select: { name: true, slug: true } },
      author: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          role: true,
          avatarUrl: true,
          premiumUntil: true,
          isFirstAdopter: true,
        },
      },
      uploaded: true,
      repostOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true,
          mediaAlt: true,
          createdAt: true,
          uploaded: true,
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              role: true,
              avatarUrl: true,
              premiumUntil: true,
              isFirstAdopter: true,
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
          uploaded: true,
          author: {
            select: {
              id: true,
              handle: true,
              displayName: true,
              role: true,
              avatarUrl: true,
              premiumUntil: true,
              isFirstAdopter: true,
            },
          },
        },
      },
      _count: { select: { Like: true, Comment: true, reposts: true } },
    },
  });

  if (!p) notFound();

  const isRepost = !!p.repostOf;

  function mapAuthor(a: {
    id: string;
    handle: string;
    displayName: string;
    role: 'DOMME' | 'SUBMISSIVE';
    avatarUrl: string | null;
    premiumUntil: Date | null;
    isFirstAdopter: boolean | null;
  }) {
    return {
      id: a.id,
      handle: a.handle,
      displayName: a.displayName,
      role: a.role,
      avatarUrl: a.avatarUrl,
      premiumUntil: a.premiumUntil ? a.premiumUntil.toISOString() : null,
      isFirstAdopter: !!a.isFirstAdopter,
    };
  }

  const content: FeedPost['content'] = isRepost
    ? {
        id: p.repostOf!.id,
        text: p.repostOf!.text ?? '',
        mediaUrl: p.repostOf!.mediaUrl,
        mediaAlt: p.repostOf!.mediaAlt,
        uploaded: mapUploaded(p.repostOf!.uploaded),
        createdAt: p.repostOf!.createdAt.toISOString(),
        author: mapAuthor(p.repostOf!.author),
        quote: null,
      }
    : {
        id: p.id,
        text: p.text ?? '',
        mediaUrl: p.mediaUrl,
        mediaAlt: p.mediaAlt,
        uploaded: mapUploaded(p.uploaded),
        createdAt: p.createdAt.toISOString(),
        author: mapAuthor(p.author),
        quote: p.quoteOf
          ? {
              id: p.quoteOf.id,
              text: p.quoteOf.text ?? '',
              mediaUrl: p.quoteOf.mediaUrl,
              mediaAlt: p.quoteOf.mediaAlt,
              uploaded: mapUploaded(p.quoteOf.uploaded),
              createdAt: p.quoteOf.createdAt.toISOString(),
              author: mapAuthor(p.quoteOf.author),
            }
          : null,
      };

  const statSource = isRepost ? p.repostOf! : p;

  // ⬇️ NEU: viewer-Infos wie im Feed berechnen
  const contentId = statSource.id;
  const contentAuthorId = isRepost ? p.repostOf!.author.id : p.author.id;

  let viewer: FeedPost['viewer'] = {
    liked: false,
    bookmarked: false,
    hasBlockedAuthor: false,
    blockedByAuthor: false,
    isAuthor: false,
    commented: false,
    hasReposted: false,
  };

  if (viewerId) {
    const [like, bookmark, block, blockedBy, comment, repost] = await Promise.all([
      // Hat der User diesen Post geliked?
      prisma.like.findFirst({
        where: { userId: viewerId, postId: contentId },
        select: { postId: true }, // ✔ existiert
      }),

      // Hat er den Post gebookmarked?
      prisma.bookmark.findFirst({
        where: { userId: viewerId, postId: contentId },
        select: { id: true }, // ✔ existiert
      }),

      // Viewer → Autor blockiert?
      prisma.block.findFirst({
        where: { blockerId: viewerId, blockedId: contentAuthorId },
        select: { blockedId: true }, // ✔ existiert
      }),

      // Autor → Viewer blockiert?
      prisma.block.findFirst({
        where: { blockerId: contentAuthorId, blockedId: viewerId },
        select: { blockedId: true }, // ✔ existiert
      }),

      // Hat Viewer den Post kommentiert?
      prisma.comment.findFirst({
        where: { userId: viewerId, postId: contentId },
        select: { id: true }, // ✔ existiert
      }),

      // Hat Viewer dieses Posting bereits reposted?
      prisma.post.findFirst({
        where: { authorId: viewerId, repostOfId: contentId },
        select: { id: true }, // ✔ existiert
      }),
    ]);

    viewer = {
      liked: !!like,
      bookmarked: !!bookmark,
      hasBlockedAuthor: !!block,
      blockedByAuthor: !!blockedBy,
      isAuthor: viewerId === contentAuthorId,
      commented: !!comment,
      hasReposted: !!repost,
    };
  }


  const item: FeedPost = {
    id: p.id, // sichtbarer Post (bei Repost ≠ contentId)
    createdAtISO: p.createdAt.toISOString(),
    content,
    reposter: isRepost
      ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName }
      : null,
    stats: {
      comments: statSource._count.Comment ?? 0,
      reposts: statSource._count.reposts ?? 0,
      likes: statSource._count.Like ?? 0,
    },
    viewer,
    initiallyBookmarked: !!viewer.bookmarked,
    community: p.Community ? { name: p.Community.name, slug: p.Community.slug } : null,
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
