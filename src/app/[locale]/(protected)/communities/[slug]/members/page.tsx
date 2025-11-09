import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { notFound } from 'next/navigation';
import CommunityMembersClient from '@/components/CommunityMembersClient';
import BackButton from '@/components/BackButton';

type Params = { locale: string; slug: string };
type Tab = 'members' | 'verified';

function encodeCursor(d: Date, userId: string) {
  return `${d.getTime()}_${userId}`;
}

export default async function CommunityMembersPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: { tab?: string };
}) {
  const { locale, slug } = await params;
  const initialTab = (searchParams?.tab as Tab) || 'members';

  const me = await getCurrentUser().catch(() => null);

  const community = await prisma.community.findUnique({
    where: { slug: slug.toLowerCase() },
    select: { id: true, name: true, slug: true, _count: { select: { CommunityMember: true } } },
  });
  if (!community) notFound();

  const now = new Date();
  const verifiedWhere = {
    OR: [{ premiumUntil: { gt: now } }, { isFirstAdopter: true }],
  };

  // verified count (leichtgewichtig)
  const verifiedCount = await prisma.communityMember.count({
    where: { communityId: community.id, User: verifiedWhere },
  });

  // Erste Seite für initialTab (SSR, 30 Items)
  const take = 30;
  const orderBy = [{ createdAt: 'desc' as const }, { userId: 'desc' as const }];

  const initialRows = await prisma.communityMember.findMany({
    where: {
      communityId: community.id,
      ...(initialTab === 'verified' ? { User: verifiedWhere } : {}),
    },
    select: {
      createdAt: true,
      userId: true,
      User: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          premiumUntil: true,
          isFirstAdopter: true,
        },
      },
    },
    orderBy,
    take,
  });

  const initialUsers = initialRows.map((r) => ({
    id: r.User.id,
    handle: r.User.handle,
    displayName: r.User.displayName,
    avatarUrl: r.User.avatarUrl,
    role: r.User.role,
    premiumUntil: r.User.premiumUntil,
    isFirstAdopter: r.User.isFirstAdopter,
  }));

  // Follow-Status des Viewers für die initialen Items
  const initialIds = initialUsers.map((u) => u.id);
  const myFollows =
    me && initialIds.length
      ? await prisma.follow.findMany({
          where: { followerId: me.id, followeeId: { in: initialIds } },
          select: { followeeId: true },
        })
      : [];
  const initialFollowingSet = new Set(myFollows.map((m) => m.followeeId));

  const last = initialRows[initialRows.length - 1] || null;
  const initialNextCursor =
    last ? encodeCursor(last.createdAt, last.userId) : null;

  return (
    <section className="max-w-2xl mx-auto">
      <div className="rounded-app border border-sub shadow-app overflow-hidden">
        <header className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-2">
            <BackButton
              fallbackHref={`/${locale}/communities/${community.slug}`}
              ariaLabel="Zurück zur Community"
              className="inline-flex items-center justify-center size-9 rounded-full border border-white/15 hover:bg-white/5"
            />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight">{community.name}</h1>
              <div className="text-xs sm:text-sm opacity-70 truncate">@{community.slug}</div>
            </div>
          </div>
        </header>

        <CommunityMembersClient
          locale={locale}
          slug={community.slug}
          meId={me?.id ?? null}
          counts={{ members: community._count.CommunityMember, verified: verifiedCount }}
          initialTab={initialTab}
          initialItems={initialUsers.map((u) => ({
            ...u,
            initialFollowing: initialFollowingSet.has(u.id),
          }))}
          initialNextCursor={initialNextCursor}
        />
      </div>
    </section>
  );
}
