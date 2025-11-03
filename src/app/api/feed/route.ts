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

// Effektive Community (bei Reposts vom Original übernehmen)
function effectiveCommunityId(p: { communityId: string | null; repostOf?: { communityId: string | null } | null }) {
  return p.communityId ?? p.repostOf?.communityId ?? null;
}

// UploadedMedia → API-Shape { url, alt, kind, mime }
function mapUploaded(
  rows: Array<{ url: string; alt: string | null; type: string | null }> | null | undefined,
) {
  return (rows ?? []).map((u) => {
    const mime = u.type ?? null;
    const kind =
      mime === 'image/gif' ? 'gif' :
      (mime && mime.startsWith('video/')) ? 'video' : 'image';
    return { url: u.url, alt: u.alt ?? null, kind, mime };
  });
}

function parseFilters(searchParams: URLSearchParams) {
  const feedRaw = (searchParams.get('feed') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const following = feedRaw.includes('following');
  const sort: 'new' | 'top' = feedRaw.includes('top') ? 'top' : 'new'; // Default: 'new'

  const roleParam = searchParams.get('role');
  const role: Role =
    roleParam === 'dommes' ? 'DOMME' :
    roleParam === 'subs'   ? 'SUBMISSIVE' : null;

  return { following, sort, role };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const { following, sort, role } = parseFilters(searchParams);

  // NEU: Pagination nach unten
  const beforeISO = searchParams.get('before');
  const limitRaw = Number(searchParams.get('limit'));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 20;

  // Bestehend (Polling nach oben)
  const sinceISO = searchParams.get('since');
  const onlyCount = searchParams.get('onlyCount') === '1';

  const sinceDate = sinceISO ? new Date(sinceISO) : null;
  const beforeDate = beforeISO ? new Date(beforeISO) : null;
  if ((sinceISO && Number.isNaN(sinceDate!.getTime())) || (beforeISO && Number.isNaN(beforeDate!.getTime()))) {
    return NextResponse.json({ posts: [], count: 0 });
  }

  const me = await getCurrentUser().catch(() => null);

  // Rolle sicher laden (für Community Sichtbarkeit)
  let viewerRole: Role = null;
  if (me) {
    const row = await prisma.user.findUnique({
      where: { id: me.id },
      select: { role: true },
    });
    viewerRole = (row?.role ?? null) as Role;
  }

  // Follows laden (für following-Filter)
  let followingUserIds = new Set<string>();
  if (following) {
    if (!me) {
      // nicht eingeloggt → kein Following-Feed
      return NextResponse.json(onlyCount ? { count: 0 } : { posts: [] });
    }
    const rows = await prisma.follow.findMany({
      where: { followerId: me.id }, // ggf. Relationen/Felder anpassen
      select: { followeeId: true },
    });
    followingUserIds = new Set(rows.map(r => r.followeeId));
    if (followingUserIds.size === 0) {
      return NextResponse.json(onlyCount ? { count: 0 } : { posts: [] });
    }
  }

  // Communities & Memberships laden und Posts nach Policy filtern
  async function filterAndCollect<T extends {
    id: string; communityId: string | null; repostOf?: { communityId: string | null } | null;
  }>(posts: T[]) {
    const communityIds = Array.from(
      new Set(
        posts
          .map((p) => effectiveCommunityId(p))
          .filter((id): id is string => typeof id === 'string'),
      ),
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
            ).map((m) => m.communityId),
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

  // Hilfsfunktion: Role-Filter auf den *Inhalt* (bei Repost der Original-Author, sonst Post-Author)
  const passesRoleFilter = (p: {
    author: { role: Role }; repostOf?: { author: { role: Role } } | null;
  }) => {
    if (!role) return true;
    const contentRole = p.repostOf?.author.role ?? p.author.role ?? null;
    return contentRole === role;
  };

  // --- Zählend (Polling) ---
  if (onlyCount) {
    const recent = await prisma.post.findMany({
      where: {
        ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
        ...(following ? { authorId: { in: Array.from(followingUserIds) } } : {}),
      },
      select: {
        id: true,
        communityId: true,
        createdAt: true,
        author: { select: { role: true } },
        repostOf: {
          select: {
            communityId: true,
            author: { select: { role: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const recentRoleFiltered = role ? recent.filter(passesRoleFilter) : recent;
    const { allowed } = await filterAndCollect(recentRoleFiltered);
    return NextResponse.json({ count: allowed.length });
  }

  // --- Vollständige Liste (Pagination) ---
  const orderBy =
    sort === 'top'
      ? [{ Like: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
      : [{ createdAt: 'desc' as const }];

  const posts = await prisma.post.findMany({
    where: {
      ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
      ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}), // NEU: nach unten paginieren
      ...(following ? { authorId: { in: Array.from(followingUserIds) } } : {}),
    },
    orderBy,
    include: {
      author: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          role: true,
          avatarUrl: true,
          // ⬇️ neu
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
          uploaded: true,
          createdAt: true,
          communityId: true,
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
          uploaded: true,
          createdAt: true,
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
    take: limit, // NEU: Batch-Größe
  });

  // Role-Filter anwenden (auf Inhalt)
  const postsRoleFiltered = role ? posts.filter(passesRoleFilter) : posts;

  // Likes/Bookmarks/Blocks
  const likeTargetIds = postsRoleFiltered.map((p) => (p.repostOf ? p.repostOf.id : p.id));
  const bookmarkIds = postsRoleFiltered.map((p) => p.id);
  const authorIds = Array.from(new Set(postsRoleFiltered.map((p) => p.author.id)));

  const [likes, bms, myBlocks, blocksMe] = await Promise.all([
    me
      ? prisma.like.findMany({ where: { userId: me.id, postId: { in: likeTargetIds } }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({ where: { userId: me.id, postId: { in: bookmarkIds } }, select: { postId: true } })
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

  const { allowed, communitiesById } = await filterAndCollect(postsRoleFiltered);

  return NextResponse.json({
    posts: allowed.map((p) => {
      const isRepost = !!p.repostOf;
      const isQuote = !!p.quoteOf;

      const statSource = isRepost ? p.repostOf! : p;
      const likeRefId = isRepost ? p.repostOf!.id : p.id;

      // Effektive Community fürs Badge
      const effectiveCid = effectiveCommunityId(p);
      const community = effectiveCid ? communitiesById.get(effectiveCid) ?? null : null;

      return {
        id: p.id,
        text: p.text,
        mediaUrl: p.mediaUrl,             // legacy
        mediaAlt: p.mediaAlt,             // legacy
        uploaded: mapUploaded(p.uploaded),
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
          premiumUntil: p.author.premiumUntil,
          isFirstAdopter: p.author.isFirstAdopter,
        },

        repostOf: isRepost
          ? {
              id: p.repostOf!.id,
              text: p.repostOf!.text,
              mediaUrl: p.repostOf!.mediaUrl,      // legacy
              mediaAlt: p.repostOf!.mediaAlt,      // legacy
              uploaded: mapUploaded(p.repostOf!.uploaded),
              createdAt: p.repostOf!.createdAt.toISOString(),
              author: {
                id: p.repostOf!.author.id,
                handle: p.repostOf!.author.handle,
                displayName: p.repostOf!.author.displayName,
                role: p.repostOf!.author.role,
                avatarUrl: p.repostOf!.author.avatarUrl,
                premiumUntil: p.repostOf!.author.premiumUntil,
                isFirstAdopter: p.repostOf!.author.isFirstAdopter,
              },
            }
          : null,

        quoteOf: isQuote
          ? {
              id: p.quoteOf!.id,
              text: p.quoteOf!.text,
              mediaUrl: p.quoteOf!.mediaUrl,       // legacy
              mediaAlt: p.quoteOf!.mediaAlt,       // legacy
              uploaded: mapUploaded(p.quoteOf!.uploaded),
              createdAt: p.quoteOf!.createdAt.toISOString(),
              author: {
                id: p.quoteOf!.author.id,
                handle: p.quoteOf!.author.handle,
                displayName: p.quoteOf!.author.displayName,
                role: p.quoteOf!.author.role,
                avatarUrl: p.quoteOf!.author.avatarUrl,
                premiumUntil: p.quoteOf!.author.premiumUntil,
                isFirstAdopter: p.quoteOf!.author.isFirstAdopter,
              },
            }
          : null,

        viewer: {
          liked: likedSet.has(likeRefId),
          bookmarked: bookmarkedSet.has(p.id),
          hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
          blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
        },

        community: community ? { name: community.name, slug: community.slug } : null,
      };
    }),
  });
}
