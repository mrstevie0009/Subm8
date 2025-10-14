// src/app/[locale]/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import HomeFeedClient from '@/components/HomeFeedClient';
import type { FeedPost } from '@/components/PostCard';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';  

export const dynamic = 'force-dynamic';

type Params = { locale: string };
type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';
type Role = 'DOMME' | 'SUBMISSIVE' | null;

function canSeeCommunity(policy: JoinPolicy, viewerRole: Role, isMember: boolean) {
  if (policy === 'OPEN') return true;
  if (policy === 'INVITE_ONLY') return isMember;
  if (policy === 'DOMME_ONLY') return isMember || viewerRole === 'DOMME';
  if (policy === 'SUB_ONLY') return isMember || viewerRole === 'SUBMISSIVE';
  return false;
}

/** UploadedMedia -> UI-Shape (mit korrekt getypter kind-Union) */
function mapUploaded(
  rows: Array<{ url: string; alt: string | null; type: string | null }> | null | undefined
): Array<{ url: string; alt: string | null; kind: 'image' | 'video' | 'gif'; mime: string | null }> {
  return (rows ?? []).map((u) => {
    const mime = u.type ?? null;
    const kind: 'image' | 'video' | 'gif' =
      mime === 'image/gif' ? 'gif' : mime && mime.startsWith('video/') ? 'video' : 'image';
    return { url: u.url, alt: u.alt ?? null, kind, mime };
  });
}

function parseFilters(sp: URLSearchParams) {
  const feedRaw = (sp.get('feed') || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const following = feedRaw.includes('following');
  const sort: 'new' | 'top' = feedRaw.includes('top') ? 'top' : 'new';

  const roleParam = sp.get('role');
  const role: Role =
    roleParam === 'dommes' ? 'DOMME' :
    roleParam === 'subs'   ? 'SUBMISSIVE' : null;

  return { following, sort, role };
}

export default async function HomePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Locale wirklich auslesen (brauchst du für den Redirect)
  const { locale } = await params;                    // ⬅️ angepasst

  // 🔒 Serverseitiger Auth-Guard (zusätzlich zur Middleware)
  const session = await auth();
  if (!session?.user?.id) {
    const back = `/${locale}`;                        // Ziel nach Login
    redirect(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
  }

  // ab hier dein bestehender Code …
  const spObj = (await searchParams) ?? {};
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(spObj)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val != null) sp.set(k, val);
  }

  const { following, sort, role } = parseFilters(sp);

  const me = await getCurrentUser().catch(() => null);

  // Rolle ggf. nachladen
  let viewerRole: Role = (me as unknown as { role?: Role } | null)?.role ?? null;
  if (me && viewerRole == null) {
    const row = await prisma.user.findUnique({ where: { id: me.id }, select: { role: true } });
    viewerRole = (row?.role as Role) ?? null;
  }

  // Following-Menge bestimmen
  let followingUserIds = new Set<string>();
  if (following) {
    if (!me) {
      return <HomeFeedClient initialItems={[]} />;
    }
    const rows = await prisma.follow.findMany({
      where: { followerId: me.id },            // <-- ggf. Relationenname anpassen
      select: { followeeId: true },            // <-- ggf. Feldnamen anpassen
    });
    followingUserIds = new Set(rows.map(r => r.followeeId));
    if (followingUserIds.size === 0) {
      return <HomeFeedClient initialItems={[]} />;
    }
  }

  const orderBy =
    sort === 'top'
      ? [{ Like: { _count: 'desc' as const } }, { createdAt: 'desc' as const }]
      : [{ createdAt: 'desc' as const }];

  const posts = await prisma.post.findMany({
    where: {
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
        },
      },
      uploaded: true, // Multi-Media am Hauptpost
      repostOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true,   // legacy
          mediaAlt: true,   // legacy
          uploaded: true,   // Multi-Media beim Original des Reposts
          createdAt: true,
          communityId: true, // für Community-Badge bei Reposts
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
          mediaUrl: true,   // legacy
          mediaAlt: true,   // legacy
          uploaded: true,   // Multi-Media in Quotes
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
  });

  // Role-Filter wirkt auf Inhalt (Repost → Original-Author; sonst Post-Author)
  const rolePass = (p: typeof posts[number]) => {
    if (!role) return true;
    const contentRole: Role = p.repostOf?.author.role ?? p.author.role ?? null;
    return contentRole === role;
  };
  const postsRoleFiltered = posts.filter(rolePass);

  // Likes/Bookmarks
  const [likedByMe, bookmarkedByMe] = await Promise.all([
    me
      ? prisma.like.findMany({
          where: { userId: me.id, postId: { in: postsRoleFiltered.map(p => (p.repostOf ? p.repostOf.id : p.id)) } },
          select: { postId: true },
        })
      : Promise.resolve([] as { postId: string }[]),
    me
      ? prisma.bookmark.findMany({ where: { userId: me.id, postId: { in: postsRoleFiltered.map(p => p.id) } }, select: { postId: true } })
      : Promise.resolve([] as { postId: string }[]),
  ]);

  const likedSet = new Set(likedByMe.map((l) => l.postId));
  const bookmarkedSet = new Set(bookmarkedByMe.map((b) => b.postId));

  // Block-Flags
  let hasBlockedSet = new Set<string>();
  let blockedBySet = new Set<string>();
  if (me) {
    const feedAuthorIds = Array.from(new Set(postsRoleFiltered.map((p) => p.author.id)));
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

  // Effektive Community je Post: eigener Community-Bezug oder der des Originals bei Reposts
  const effectiveCommunityId = (p: typeof posts[number]) =>
    p.communityId ?? p.repostOf?.communityId ?? null;

  // Communities + Visibility filtern
  const communityIds = Array.from(
    new Set(postsRoleFiltered.map(effectiveCommunityId).filter(Boolean) as string[])
  );
  const communities = communityIds.length
    ? await prisma.community.findMany({
        where: { id: { in: communityIds } },
        select: { id: true, name: true, slug: true, joinPolicy: true },
      })
    : [];
  const commById = new Map(communities.map((c) => [c.id, c]));

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

  const visible = postsRoleFiltered.filter((p) => {
    const cid = effectiveCommunityId(p);
    if (!cid) return true;
    const c = commById.get(cid);
    if (!c) return false;
    return canSeeCommunity(c.joinPolicy as JoinPolicy, viewerRole, memberSet.has(c.id));
  });

  const items: FeedPost[] = visible.map((p) => {
    const isRepost = !!p.repostOf;
    const isQuote = !!p.quoteOf;

    const content = isRepost
      ? {
          id: p.repostOf!.id,
          text: p.repostOf!.text ?? '',
          mediaUrl: p.repostOf!.mediaUrl,           // legacy
          mediaAlt: p.repostOf!.mediaAlt,           // legacy
          uploaded: mapUploaded(p.repostOf!.uploaded), // multi
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
          mediaUrl: p.mediaUrl,                     // legacy
          mediaAlt: p.mediaAlt,                     // legacy
          uploaded: mapUploaded(p.uploaded),        // multi
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
                mediaUrl: p.quoteOf!.mediaUrl,            // legacy
                mediaAlt: p.quoteOf!.mediaAlt,            // legacy
                uploaded: mapUploaded(p.quoteOf!.uploaded), // multi
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

    const statSource = isRepost ? p.repostOf! : p;
    const likeRefId = isRepost ? p.repostOf!.id : p.id; // Likes zählen auf Original bei Repost
    const cid = effectiveCommunityId(p);
    const community = cid ? commById.get(cid) ?? null : null;

    return {
      id: p.id,
      createdAtISO: p.createdAt.toISOString(),
      content,
      reposter: isRepost ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName } : null,
      stats: {
        comments: statSource._count.Comment ?? 0,
        reposts: statSource._count.reposts ?? 0,
        likes: statSource._count.Like ?? 0,
      },
      viewer: {
        liked: likedSet.has(likeRefId),
        bookmarked: bookmarkedSet.has(p.id), // Bookmark bezieht sich auf den sichtbaren Post
        hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
        blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
      },
      initiallyBookmarked: bookmarkedSet.has(p.id),
      community: community ? { name: community.name, slug: community.slug } : null,
    } satisfies FeedPost;
  });

  return <HomeFeedClient initialItems={items} />;
}
