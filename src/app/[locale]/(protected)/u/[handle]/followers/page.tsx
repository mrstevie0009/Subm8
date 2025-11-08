// src/app/[locale]/(protected)/u/[handle]/followers/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import FollowersUnifiedClient, { type UserLite } from '@/components/FollowersUnifiedClient';

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

  const [followersRows, followingRows] = await Promise.all([
    prisma.follow.findMany({
      where: { followeeId: user.id },
      select: {
        follower: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true, role: true,
            premiumUntil: true, isFirstAdopter: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.follow.findMany({
      where: { followerId: user.id },
      select: {
        followee: {
          select: {
            id: true, handle: true, displayName: true, avatarUrl: true, role: true,
            premiumUntil: true, isFirstAdopter: true,
          },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const followers = followersRows.map(r => r.follower) satisfies UserLite[];
  const following = followingRows.map(r => r.followee) satisfies UserLite[];

  const isVerified = (u: Pick<UserLite, 'premiumUntil' | 'isFirstAdopter'>) => {
    const until = u.premiumUntil ? new Date(u.premiumUntil) : null;
    return (until && until.getTime() > Date.now()) || !!u.isFirstAdopter;
  };

  // Neu: getrennte Verified-Listen
  const verifiedFollowing = following.filter(isVerified);
  const verifiedFollowers = followers.filter(isVerified);

  // Für “folge ich schon?” Lookup
  const allIds = Array.from(new Set([...followers, ...following].map(u => u.id)));
  let viewerFollows = new Set<string>();
  if (me && allIds.length > 0) {
    const mine = await prisma.follow.findMany({
      where: { followerId: me.id, followeeId: { in: allIds } },
      select: { followeeId: true },
    });
    viewerFollows = new Set(mine.map(m => m.followeeId));
  }

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
          meId={me?.id ?? null}
          counts={{
            followers: user._count.followers,
            following: user._count.following,
            vFollowing: verifiedFollowing.length,
            vFollowers: verifiedFollowers.length,
          }}
          followers={followers}
          following={following}
          verifiedFollowing={verifiedFollowing}
          verifiedFollowers={verifiedFollowers}
          viewerFollows={Array.from(viewerFollows)}
          initialTab={initialTab} 
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
