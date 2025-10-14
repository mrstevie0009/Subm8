import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import FollowInlineButton from '@/components/FollowInlineButton';

const AVATAR_PH = '/images/avatar-placeholder.png';

type Params = { locale: string; handle: string };

export default async function FollowersPage({ params }: { params: Promise<Params> }) {
  const { locale, handle } = await params;

  const user = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true, handle: true, displayName: true },
  });
  if (!user) notFound();

  const me = await getCurrentUser().catch(() => null);

  // Follower dieses Profils
  const rows = await prisma.follow.findMany({
    where: { followeeId: user.id },
    select: {
      follower: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          role: true,
        },
      },
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  const followers = rows.map((r) => r.follower);

  // Folge ich diese Follower bereits?
  let iFollow = new Set<string>();
  if (me && followers.length > 0) {
    const mine = await prisma.follow.findMany({
      where: { followerId: me.id, followeeId: { in: followers.map((u) => u.id) } },
      select: { followeeId: true },
    });
    iFollow = new Set(mine.map((m) => m.followeeId));
  }

  return (
    <section className="max-w-2xl mx-auto grid gap-4">
      {/* Header-Card */}
      <header className="rounded-app border border-sub shadow-app px-3 py-3 sm:px-4 sm:py-4">
        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/u/${user.handle}`}
            aria-label="Back to profile"
            className="inline-grid place-items-center size-9 rounded-full border border-white/15 hover:bg-white/5"
          >
            <BackIcon />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold leading-tight">Followers</h1>
            <div className="text-xs sm:text-sm opacity-70 truncate">
              {followers.length} {followers.length === 1 ? 'follower' : 'followers'} of @{user.handle}
            </div>
          </div>
        </div>
      </header>

      {/* Liste */}
      <ul className="rounded-app border border-sub shadow-app divide-y divide-white/10">
        {followers.map((u) => (
          <li key={u.id} className="px-3 py-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3">
            <Link
              href={`/${locale}/u/${u.handle}`}
              className="flex items-center gap-3 min-w-0"
            >
              <Image
                src={u.avatarUrl || AVATAR_PH}
                alt=""
                width={44}
                height={44}
                className="rounded-full object-cover border border-white/15"
              />
              <div className="min-w-0">
                <div className="font-medium truncate">{u.displayName}</div>
                <div className="text-sm opacity-70 truncate">@{u.handle}</div>
              </div>
            </Link>
            <div className="shrink-0">
              <FollowInlineButton
                targetUserId={u.id}
                initialFollowing={me ? iFollow.has(u.id) : false}
              />
            </div>
          </li>
        ))}

        {followers.length === 0 && (
          <li className="px-4 py-10 text-center opacity-70">No followers yet.</li>
        )}
      </ul>
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
