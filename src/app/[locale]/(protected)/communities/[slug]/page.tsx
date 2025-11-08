// src/app/[locale]/(protected)/communities/[slug]/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { notFound } from 'next/navigation';

import CommunityJoinButton from '@/components/CommunityJoinButton';
import CommunityComposer from '@/components/CommunityComposer';
import BackButton from '@/components/BackButton';
import CommunityCompactHeader from '@/components/CommunityCompactHeader';
import CommunityFeedClient from '@/components/CommunityFeedClient';
import CommunityShareButton from '@/components/CommunityShareButton';
import CommunityInviteButton from '@/components/CommunityInviteButton';
import type { FeedPost as PostCardFeedPost } from '@/components/PostCard';

// i18n: manuelles Laden
import { createTranslator } from 'next-intl';

type Params = { locale: string; slug: string };

const toIso = (d?: Date | null) => (d ? d.toISOString() : null);

function mapAuthor(a: {
  id: string;
  handle: string;
  displayName: string;
  role: 'DOMME' | 'SUBMISSIVE' | null;
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
    premiumUntil: toIso(a.premiumUntil),
    isFirstAdopter: !!a.isFirstAdopter,
  };
}

function policyKeyFromDb(value: string) {
  switch (value) {
    case 'OPEN':
      return 'open';
    case 'INVITE_ONLY':
      return 'invite';
    case 'DOMME_ONLY':
      return 'dommeOnly';
    case 'SUB_ONLY':
      return 'subOnly';
    default:
      return 'open';
  }
}

// gleiche Selektion wie im Home-Feed, damit die PostCard alles hat
export default async function CommunityPage({ params }: { params: Promise<Params> }) {
  const { locale, slug } = await params;
  
  let tDetail: ReturnType<typeof createTranslator>;
  let tPolicy: ReturnType<typeof createTranslator>;
  try {
    const communitiesFile = (await import(`@/messages/${locale}/communities.json`)).default;

    tDetail = createTranslator({
      locale,
      messages: communitiesFile,
      namespace: 'communities.detail'
    });

    // Wichtig: richtiges Namespace (ohne doppelte "communities")
    tPolicy = createTranslator({
      locale,
      messages: communitiesFile,
      namespace: 'communities.page.policyBadge'
    });
  } catch {
    notFound();
  }

  const me = await getCurrentUser().catch(() => null);

  const community = await prisma.community.findUnique({
    where: { slug: slug.toLowerCase() },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      joinPolicy: true,
      bannerUrl: true,
      _count: { select: { CommunityMember: true } },
    },
  });
  if (!community) notFound();

  const joined = me
    ? !!(await prisma.communityMember.findUnique({
        where: { communityId_userId: { communityId: community.id, userId: me.id } },
        select: { communityId: true },
      }))
    : false;

  const [posts, likedByMe, bookmarkedByMe] = await Promise.all([
    prisma.post.findMany({
      where: { communityId: community.id },
      orderBy: { createdAt: 'desc' },
      include: {
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

  // Block-Flags gegen den Feed-Item-Autor (bei Repost = Reposter)
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

  const items: PostCardFeedPost[] = posts.map((p) => {
    const isRepost = !!p.repostOf;
    const isQuote = !!p.quoteOf;

    const content = isRepost
      ? {
          id: p.repostOf!.id,
          text: p.repostOf!.text ?? '',
          mediaUrl: p.repostOf!.mediaUrl,
          mediaAlt: p.repostOf!.mediaAlt,
          createdAt: p.repostOf!.createdAt.toISOString(),
          author: mapAuthor(p.repostOf!.author),
          quote: null,
        }
      : {
          id: p.id,
          text: p.text ?? '',
          mediaUrl: p.mediaUrl,
          mediaAlt: p.mediaAlt,
          createdAt: p.createdAt.toISOString(),
          author: mapAuthor(p.author),
          quote: isQuote
            ? {
                id: p.quoteOf!.id,
                text: p.quoteOf!.text ?? '',
                mediaUrl: p.quoteOf!.mediaUrl,
                mediaAlt: p.quoteOf!.mediaAlt,
                createdAt: p.quoteOf!.createdAt.toISOString(),
                author: mapAuthor(p.quoteOf!.author),
              }
            : null,
        };

    const statSource = isRepost ? p.repostOf! : p;
    const viewerTargetId = isRepost ? p.repostOf!.id : p.id;

    return {
      id: p.id,
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
      viewer: {
        liked: likedSet.has(viewerTargetId),
        bookmarked: bookmarkedSet.has(viewerTargetId),
        hasBlockedAuthor: me ? hasBlockedSet.has(p.author.id) : false,
        blockedByAuthor: me ? blockedBySet.has(p.author.id) : false,
      },
      initiallyBookmarked: bookmarkedSet.has(viewerTargetId),
      community: { name: community.name, slug: community.slug },
    } satisfies PostCardFeedPost;
  });

  const policyKey = policyKeyFromDb(community.joinPolicy);
  const policyPrefix = tDetail('policyPrefix');
  const policyLabel = tPolicy(policyKey);

  return (
    <section className="grid gap-4 max-w-2xl mx-auto">
      {/* --- BANNER NUR ALS BILD --- */}
      <div className="[--banner-h:clamp(140px,28vw,200px)]">
        <figure className="relative rounded-app border border-sub shadow-app overflow-hidden isolate">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={community.bannerUrl ?? '/images/banner-placeholder.png'}
            alt=""
            className="block w-full h-[var(--banner-h)] object-cover select-none"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 to-black/35" />
        </figure>
      </div>

      {/* --- INFO-KARTE, ÜBERLAPPT DAS BILD --- */}
      <div className="relative z-10 -mt-6 sm:-mt-8 px-1 sm:px-0">
        <div
          className={`
            relative bg-black
            border-x border-b border-white/12 
            rounded-b-app rounded-t-none    
            shadow-app
            p-4
            before:content-[''] before:absolute before:inset-x-0
            before:-top-3 sm:before:-top-4
            before:h-4 sm:before:h-5
            before:pointer-events-none
          `}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 relative pl-10">
              <div className="absolute left-0 top-0.5">
                <BackButton
                  fallbackHref={`/${locale}/communities`}
                  forceFallback
                  replaceOnFallback
                />
              </div>

              <div className="text-xl font-bold truncate">{community.name}</div>
              <div className="text-sm opacity-70 truncate">@{community.slug}</div>
              {community.description && (
                <p className="mt-1 text-sm opacity-90">{community.description}</p>
              )}

              {/* --- hübsche, klickbare Pills --- */}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <a
                  href={`/${locale}/communities/${community.slug}/members`}
                  className="
                    inline-flex items-center gap-2
                    rounded-full border border-white/12
                    bg-white/[.06] hover:bg-white/[.1]
                    px-3 py-1.5
                    text-sm text-white
                    transition focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/60
                    shadow-sm hover:shadow
                  "
                  aria-label={`${community._count.CommunityMember.toLocaleString(locale)} members – open members list`}
                >
                  <UsersIcon className="opacity-90" />
                  <span className="font-medium">Members</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 tabular-nums">
                    {community._count.CommunityMember.toLocaleString(locale)}
                  </span>
                </a>

                <span
                  className="
                    inline-flex items-center gap-1 uppercase
                    rounded-full border border-white/12
                    bg-white/[.04] px-2.5 py-1 text-xs tracking-wide
                    text-white/85
                  "
                  title={`${policyPrefix} ${policyLabel}`}
                >
                  Policy
                  <span className="font-semibold">{policyKey}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <CommunityJoinButton
                slug={community.slug}
                initialJoined={joined}
                initialMembers={community._count.CommunityMember}
              />
              <CommunityInviteButton
                locale={locale}
                slug={community.slug}
                name={community.name}
                joined={joined}
                joinPolicy={community.joinPolicy}
              />
              <CommunityShareButton locale={locale} name={community.name} slug={community.slug} />
            </div>
          </div>
        </div>
      </div>

      <CommunityCompactHeader
        locale={locale}
        name={community.name}
        slug={community.slug}
        initialJoined={joined}
        initialMembers={community._count.CommunityMember}
      />

      {joined && (
        <div className="rounded-app border border-sub shadow-app p-4">
          <CommunityComposer slug={community.slug} />
        </div>
      )}

      <CommunityFeedClient initialItems={items} slug={community.slug} />
    </section>
  );
  function UsersIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
}
