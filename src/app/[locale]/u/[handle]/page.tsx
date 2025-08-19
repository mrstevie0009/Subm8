// src/app/[locale]/u/[handle]/page.tsx
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import ProfileHeader from '@/components/ProfileHeader';
import type { RoleUI, Profile } from '@/types/profile';

function toRoleUI(r: unknown): RoleUI {
  if (r === 'DOMME' || r === 'domme') return 'domme';
  return 'sub'; // SUB | submissive -> sub
}

type Params = { locale: string; handle: string };

export default async function ProfilePage({ params }: { params: Promise<Params> }) {
  // ✅ params zuerst awaiten (Next 15)
  const { handle: raw, locale } = await params;

  // @user → user
  const clean = raw.startsWith('@') ? raw.slice(1) : raw;
  const handle = clean.toLowerCase();

  const viewer = await getCurrentUser();

  const user = await prisma.user.findFirst({
    where: { handle: { equals: handle, mode: 'insensitive' } },
    select: {
      id: true,
      displayName: true,
      handle: true,
      role: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      location: true,
      createdAt: true,
      ageVerifiedAt: true,
      nsfwDefault: true,
      _count: { select: { followers: true, following: true } },
    },
  });

  if (!user) notFound();

  const ui: Profile = {
    id: user.id,
    username: user.handle,
    displayName: user.displayName,
    role: toRoleUI(user.role),
    avatarUrl: user.avatarUrl ?? undefined,
    bannerUrl: user.bannerUrl ?? undefined,
    bio: user.bio ?? undefined,
    location: user.location ?? undefined,
    createdAt: user.createdAt?.toISOString(),
    ageVerifiedAt: user.ageVerifiedAt?.toISOString?.() ?? null,
    nsfwDefault: user.nsfwDefault ?? false,
    stats: {
      followers: user._count.followers,
      following: user._count.following,
      posts: 0,
    },
  };

  const isOwner = !!viewer && viewer.id === user.id;

  // folgt viewer diesem Profil?
  const isFollowing = viewer
    ? !!(await prisma.follow.findUnique({
        where: {
          followerId_followeeId: { followerId: viewer.id, followeeId: user.id },
        },
        select: { followerId: true },
      }))
    : false;

  return (
    <div className="space-y-4">
      <ProfileHeader
        profile={ui}
        isOwner={isOwner}
        initialIsFollowing={isFollowing}
        locale={locale} // ✅
      />
    </div>
  );
}
