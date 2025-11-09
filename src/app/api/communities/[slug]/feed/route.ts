//src/app/api/communities/[slug]/feed/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

type Params = { slug: string };

type FeedPostAuthor = {
  id: string;
  handle: string;
  displayName: string;
  role: 'DOMME' | 'SUBMISSIVE' | null;
  avatarUrl: string | null;
};

type FeedPostCounts = {
  Like: number;
  Comment: number;
  reposts: number;
};

type FeedPostRepost = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  author: FeedPostAuthor;
  _count: FeedPostCounts;
};

type FeedPostQuote = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  author: FeedPostAuthor;
};

type FeedPostViewer = {
  liked: boolean;
  bookmarked: boolean;
  hasBlockedAuthor: boolean;
  blockedByAuthor: boolean;
};

type FeedPostOut = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  _count: FeedPostCounts;
  author: FeedPostAuthor;
  repostOf: FeedPostRepost | null;
  quoteOf: FeedPostQuote | null;
  viewer: FeedPostViewer;
};

type FeedResponse =
  | { count: number } // onlyCount=1
  | { posts: FeedPostOut[]; nextCursor: string | null };

function encodeCursor(d: Date, id: string) {
  return `${d.getTime()}_${id}`;
}
function decodeCursor(token: string | null | undefined): { createdAt: Date; id: string } | null {
  if (!token) return null;
  const [msStr, id] = token.split('_');
  const ms = Number(msStr);
  if (!id || !Number.isFinite(ms)) return null;
  return { createdAt: new Date(ms), id };
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { slug } = await ctx.params;
  const { searchParams } = new URL(req.url);

  const sinceISO = searchParams.get('since');        // neuere Posts (Top-Refresh)
  const beforeTok = searchParams.get('before');      // ältere Posts (Bottom-Scroll)
  const onlyCount = searchParams.get('onlyCount') === '1';
  const takeRaw = parseInt(searchParams.get('take') || '20', 10);
  const take = Math.min(Math.max(Number.isFinite(takeRaw) ? takeRaw : 20, 1), 100);

  const community = await prisma.community.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true },
  });
  if (!community) {
    const empty: FeedResponse = onlyCount ? { count: 0 } : { posts: [], nextCursor: null };
    return NextResponse.json(empty);
  }

  const sinceDate = sinceISO ? new Date(sinceISO) : null;
  if (sinceDate && Number.isNaN(sinceDate.getTime())) {
    const bad: FeedResponse = { posts: [], nextCursor: null };
    return NextResponse.json(bad);
  }
  const decoded = decodeCursor(beforeTok);

  const me = await getCurrentUser().catch(() => null);

  // --- Nur zählen (für Top-Badge) ---
  if (onlyCount) {
    const count = await prisma.post.count({
      where: {
        communityId: community.id,
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
      },
    });
    const out: FeedResponse = { count };
    return NextResponse.json(out);
  }

  // --- Query-Bedingungen (Keyset-Pagination via createdAt DESC, id DESC) ---
  const orderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  const whereBase: Record<string, unknown> = { communityId: community.id };
  if (sinceDate) {
    (whereBase as { createdAt: { gt: Date } }).createdAt = { gt: sinceDate };
  }

  // Ältere Seite?
  let whereWithCursor: Record<string, unknown> = whereBase;
  if (decoded) {
    whereWithCursor = {
      AND: [
        whereBase,
        {
          OR: [
            { createdAt: { lt: decoded.createdAt } },
            { AND: [{ createdAt: decoded.createdAt }, { id: { lt: decoded.id } }] },
          ],
        },
      ],
    };
  }

  const posts = await prisma.post.findMany({
    where: whereWithCursor,
    orderBy,
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
    take: sinceDate && !decoded ? Math.min(Math.max(50, 1), 100) : take, // für Top-Refresh großzügig
  });

  // Begleitdaten für Viewer
  const likeTargetIds = posts.map((p) => (p.repostOf ? p.repostOf.id : p.id));
  const authorIds = Array.from(new Set(posts.map((p) => p.author.id)));

  const [likes, bookmarks, myBlocks, blocksMe] = await Promise.all([
    me
      ? prisma.like.findMany({
          where: { userId: me.id, postId: { in: likeTargetIds } },
          select: { postId: true },
        })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({
          where: { userId: me.id, postId: { in: likeTargetIds } },
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
  const bookmarkedSet = new Set(bookmarks.map((b) => b.postId));
  const hasBlockedSet = new Set(myBlocks.map((b) => b.blockedId));
  const blockedBySet = new Set(blocksMe.map((b) => b.blockerId));

  const outPosts: FeedPostOut[] = posts.map((p) => {
    const isRepost = !!p.repostOf;
    const statSource = isRepost ? p.repostOf! : p;
    const likeRefId = isRepost ? p.repostOf!.id : p.id;

    const counts: FeedPostCounts = {
      Like: statSource._count.Like ?? 0,
      Comment: statSource._count.Comment ?? 0,
      reposts: statSource._count.reposts ?? 0,
    };

    const author: FeedPostAuthor = {
      id: p.author.id,
      handle: p.author.handle,
      displayName: p.author.displayName,
      role: p.author.role,
      avatarUrl: p.author.avatarUrl,
    };

    const repostOf: FeedPostRepost | null = isRepost
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
          _count: counts,
        }
      : null;

    const quoteOf: FeedPostQuote | null = p.quoteOf
      ? {
          id: p.quoteOf.id,
          text: p.quoteOf.text,
          mediaUrl: p.quoteOf.mediaUrl,
          mediaAlt: p.quoteOf.mediaAlt,
          createdAt: p.quoteOf.createdAt.toISOString(),
          author: {
            id: p.quoteOf.author.id,
            handle: p.quoteOf.author.handle,
            displayName: p.quoteOf.author.displayName,
            role: p.quoteOf.author.role,
            avatarUrl: p.quoteOf.author.avatarUrl,
          },
        }
      : null;

    const viewer: FeedPostViewer = {
      liked: likedSet.has(likeRefId),
      bookmarked: bookmarkedSet.has(likeRefId),
      hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
      blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
    };

    return {
      id: p.id,
      text: p.text,
      mediaUrl: p.mediaUrl,
      mediaAlt: p.mediaAlt,
      createdAt: p.createdAt.toISOString(),
      _count: counts,
      author,
      repostOf,
      quoteOf,
      viewer,
    };
  });

  const last = posts[posts.length - 1] || null;
  const nextCursor = last ? encodeCursor(last.createdAt, last.id) : null;

  const out: FeedResponse = { posts: outPosts, nextCursor };
  return NextResponse.json(out);
}
