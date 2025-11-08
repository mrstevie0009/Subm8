//src/app/[locale]/(protected)/communities/[slug]/members/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { notFound } from 'next/navigation';
import CommunityMembersClient, { type UserLite } from '@/components/CommunityMembersClient';
import BackButton from '@/components/BackButton';

type Params = { locale: string; slug: string };
type Tab = 'members' | 'verified';

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

  // Mitglieder laden (jüngste zuerst)
  const rows = await prisma.communityMember.findMany({
    where: { communityId: community.id },
    orderBy: { createdAt: 'desc' },
    select: {
      User: {
        select: {
          id: true, handle: true, displayName: true, avatarUrl: true, role: true,
          premiumUntil: true, isFirstAdopter: true,
        },
      },
      createdAt: true,
    },
  });

  const members: UserLite[] = rows.map(r => ({
    ...r.User,
    // premiumUntil darf string|Date|null sein, Client macht new Date(...) robust
    premiumUntil: r.User.premiumUntil,
  }));

  const isVerified = (u: Pick<UserLite,'premiumUntil'|'isFirstAdopter'>) => {
    const until = u.premiumUntil ? new Date(u.premiumUntil) : null;
    return (until && until.getTime() > Date.now()) || !!u.isFirstAdopter;
  };

  const verified = members.filter(isVerified);

  // Für "folge ich schon?" (Button-Status)
  const allIds = members.map(m => m.id);
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
          meId={me?.id ?? null}
          counts={{ members: community._count.CommunityMember, verified: verified.length }}
          members={members}
          verified={verified}
          viewerFollows={Array.from(viewerFollows)}
          initialTab={initialTab}
        />
      </div>
    </section>
  );
}

