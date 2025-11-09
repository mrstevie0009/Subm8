// src/app/[locale]/(protected)/u/[handle]/followers/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import FollowersUnifiedClient from '@/components/FollowersUnifiedClient';

type UserPick = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'DOMME' | 'SUBMISSIVE' | string;
  premiumUntil: Date | string | null;
  isFirstAdopter: boolean | null;
};

// Rückgabetypen der vier Abfragen (jede liefert genau eine der beiden Formen)
type FollowRowFollower = { id: string; follower: UserPick };
type FollowRowFollowee = { id: string; followee: UserPick };

type Params = { locale: string; handle: string };
type Tab = 'followers' | 'following' | 'vFollowing' | 'vFollowers';

export default async function FollowersUnifiedPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: { tab?: string };
}) {
  const { locale, handle } = await params;
  const initialTab = (searchParams?.tab as Tab) || 'followers';

  const me = await getCurrentUser().catch(() => null);
  const user = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true, handle: true, displayName: true,
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user) notFound();

  const now = new Date();
  const verifiedWhere = {
    OR: [{ premiumUntil: { gt: now } }, { isFirstAdopter: true }],
  };

  // Counts für Tabs (leichtgewichtige COUNTs mit Where)
  const [vFollowersCount, vFollowingCount] = await Promise.all([
    prisma.follow.count({ where: { followeeId: user.id, follower: verifiedWhere }}),
    prisma.follow.count({ where: { followerId: user.id, followee: verifiedWhere }}),
  ]);

  // Erste Seite der initialen Tab-Liste vom API-Query "nachbauen", damit SSR die Seite direkt befüllt ist
  const take = 30;
  const commonOrder = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  const initialRows =
    initialTab === 'followers'
      ? await prisma.follow.findMany({
          where: { followeeId: user.id },
          select: {
            id: true,
            follower: {
              select: {
                id: true, handle: true, displayName: true, avatarUrl: true, role: true,
                premiumUntil: true, isFirstAdopter: true,
              },
            },
          },
          orderBy: commonOrder,
          take,
        })
      : initialTab === 'following'
      ? await prisma.follow.findMany({
          where: { followerId: user.id },
          select: {
            id: true,
            followee: {
              select: {
                id: true, handle: true, displayName: true, avatarUrl: true, role: true,
                premiumUntil: true, isFirstAdopter: true,
              },
            },
          },
          orderBy: commonOrder,
          take,
        })
      : initialTab === 'vFollowers'
      ? await prisma.follow.findMany({
          where: { followeeId: user.id, follower: verifiedWhere },
          select: {
            id: true,
            follower: {
              select: {
                id: true, handle: true, displayName: true, avatarUrl: true, role: true,
                premiumUntil: true, isFirstAdopter: true,
              },
            },
          },
          orderBy: commonOrder,
          take,
        })
      : await prisma.follow.findMany({
          where: { followerId: user.id, followee: verifiedWhere },
          select: {
            id: true,
            followee: {
              select: {
                id: true, handle: true, displayName: true, avatarUrl: true, role: true,
                premiumUntil: true, isFirstAdopter: true,
              },
            },
          },
          orderBy: commonOrder,
          take,
        });

  const initialUsers: UserPick[] = initialRows.map((r) =>
  (initialTab === 'followers' || initialTab === 'vFollowers'
    ? (r as FollowRowFollower).follower
    : (r as FollowRowFollowee).followee)
);
  const initialIds = initialUsers.map((u) => u.id);
  const myFollows = me && initialIds.length
    ? await prisma.follow.findMany({
        where: { followerId: me.id, followeeId: { in: initialIds } },
        select: { followeeId: true },
      })
    : [];
  const initialFollowingSet = new Set(myFollows.map(m => m.followeeId));

  return (
    <section className="max-w-2xl mx-auto">
      <div className="rounded-app border border-sub shadow-app overflow-hidden">
        <header className="px-3 py-3 sm:px-4 sm:py-4">
          <div className="flex items-center gap-2">
            <Link
              href={`/${locale}/u/${user.handle}`}
              aria-label="Back to profile"
              className="inline-grid place-items-center size-9 rounded-full border border-white/15 hover:bg-white/5"
            >
              <BackIcon />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold leading-tight">{user.displayName}</h1>
              <div className="text-xs sm:text-sm opacity-70 truncate">@{user.handle}</div>
            </div>
          </div>
        </header>

        <FollowersUnifiedClient
          locale={locale}
          handle={user.handle}
          meId={me?.id ?? null}
          counts={{
            followers: user._count.followers,
            following: user._count.following,
            vFollowers: vFollowersCount,
            vFollowing: vFollowingCount,
          }}
          initialTab={initialTab}
          initialItems={initialUsers.map(u => ({
            id: u.id,
            handle: u.handle,
            displayName: u.displayName,
            avatarUrl: u.avatarUrl,
            role: u.role,
            premiumUntil: u.premiumUntil,
            isFirstAdopter: u.isFirstAdopter,
            initialFollowing: initialFollowingSet.has(u.id),
          }))}
          initialNextCursor={initialRows.length === take ? initialRows[initialRows.length - 1].id : null}
        />
      </div>
    </section>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}
