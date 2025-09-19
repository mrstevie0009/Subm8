// src/app/api/feed/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';
type Role = 'DOMME' | 'SUBMISSIVE' | null;

function canSeeCommunity(policy: JoinPolicy, viewerRole: Role, isMember: boolean) {
  if (policy === 'OPEN') return true;
  if (policy === 'INVITE_ONLY') return isMember;
  if (policy === 'DOMME_ONLY') return isMember || viewerRole === 'DOMME';
  if (policy === 'SUB_ONLY') return isMember || viewerRole === 'SUBMISSIVE';
  return false;
}

// Hilfsfunktion: effektive Community bestimmen (bei Reposts vom Original übernehmen)
function effectiveCommunityId(p: { communityId: string | null; repostOf?: { communityId: string | null } | null }) {
  return p.communityId ?? p.repostOf?.communityId ?? null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sinceISO = searchParams.get('since');
  const onlyCount = searchParams.get('onlyCount') === '1';

  const sinceDate = sinceISO ? new Date(sinceISO) : new Date(0);
  if (Number.isNaN(sinceDate.getTime())) {
    return NextResponse.json({ posts: [], count: 0 });
  }

  const me = await getCurrentUser().catch(() => null);

  // Rolle sicher laden (ohne any)
  let viewerRole: Role = null;
  if (me) {
    const row = await prisma.user.findUnique({
      where: { id: me.id },
      select: { role: true },
    });
    viewerRole = (row?.role ?? null) as Role;
  }

  // Communities & Memberships laden und Posts nach Policy filtern
  async function filterAndCollect<T extends { id: string; communityId: string | null; repostOf?: { communityId: string | null } | null }>(
    posts: T[]
  ) {
    const communityIds = Array.from(
      new Set(
        posts
          .map((p) => effectiveCommunityId(p))
          .filter((id): id is string => typeof id === 'string')
      )
    );

    const communities = communityIds.length
      ? await prisma.community.findMany({
          where: { id: { in: communityIds } },
          select: { id: true, name: true, slug: true, joinPolicy: true },
        })
      : [];

    const byId = new Map(communities.map((c) => [c.id, c]));

    const memberSet =
      me && communityIds.length
        ? new Set(
            (
              await prisma.communityMember.findMany({
                where: { userId: me.id, communityId: { in: communityIds } },
                select: { communityId: true },
              })
            ).map((m) => m.communityId)
          )
        : new Set<string>();

    const allowed = posts.filter((p) => {
      const cid = effectiveCommunityId(p);
      if (!cid) return true;
      const c = byId.get(cid);
      if (!c) return false;
      return canSeeCommunity(c.joinPolicy as JoinPolicy, viewerRole, memberSet.has(c.id));
    });

    return { allowed, communitiesById: byId };
  }

  if (onlyCount) {
    // Für das Polling reicht eine gefilterte Zählung über die letzten X Einträge
    const recent = await prisma.post.findMany({
      where: { createdAt: { gt: sinceDate } },
      select: {
        id: true,
        communityId: true,
        createdAt: true,
        repostOf: { select: { communityId: true } }, // wichtig für Repost-Community
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const { allowed } = await filterAndCollect(recent);
    return NextResponse.json({ count: allowed.length });
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
          communityId: true, // ← damit Badge bei Reposts erhalten bleibt
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

  // Likes/Bookmarks/Blocks wie gehabt
  const likeTargetIds = posts.map((p) => (p.repostOf ? p.repostOf.id : p.id));
  const bookmarkIds = posts.map((p) => p.id);
  const authorIds = Array.from(new Set(posts.map((p) => p.author.id)));

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

  const { allowed, communitiesById } = await filterAndCollect(posts);

  return NextResponse.json({
    posts: allowed.map((p) => {
      const isRepost = !!p.repostOf;
      const isQuote = !!p.quoteOf;

      const statSource = isRepost ? p.repostOf! : p;
      const likeRefId = isRepost ? p.repostOf!.id : p.id;

      // Effektive Community für Badge (bei Reposts vom Original)
      const effectiveCid = effectiveCommunityId(p);
      const community = effectiveCid ? communitiesById.get(effectiveCid) ?? null : null;

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
          hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
          blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
        },

        // Community-Infos fürs Badge
        community: community ? { name: community.name, slug: community.slug } : null,
      };
    }),
  });
}
