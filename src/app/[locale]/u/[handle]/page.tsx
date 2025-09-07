// src/app/[locale]/u/[handle]/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import ClientProfile from './ClientProfile';
import { notFound } from 'next/navigation';
import type { Role } from '@prisma/client';

type Params = { locale: string; handle: string };

// ClientProfile erwartet RoleUI = 'domme' | 'sub'
function toUiRole(role: Role): 'domme' | 'sub' {
  return role === 'DOMME' ? 'domme' : 'sub';
}

export default async function ProfilePage({ params }: { params: Params }) {
  const { handle } = params;
  const me = await getCurrentUser().catch(() => null);

  const user = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: {
      id: true,
      handle: true,
      displayName: true,
      role: true,
      avatarUrl: true,
      bannerUrl: true,
      bio: true,
      location: true,
      createdAt: true,
      _count: { select: { followers: true, following: true, Post: true } },
    },
  });

  if (!user) return notFound();

  const [viewerHasBlocked, isBlockedByProfile, isFollowing] = await Promise.all([
    me
      ? prisma.block.findFirst({ where: { blockerId: me.id, blockedId: user.id }, select: { blockerId: true } }).then(Boolean)
      : Promise.resolve(false),
    me
      ? prisma.block.findFirst({ where: { blockerId: user.id, blockedId: me.id }, select: { blockerId: true } }).then(Boolean)
      : Promise.resolve(false),
    me
      ? prisma.follow
          .findUnique({
            where: { followerId_followeeId: { followerId: me.id, followeeId: user.id } },
            select: { followerId: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
  ]);

  // Struktur, die ClientProfile erwartet (+ author-Alias für Alt-Code)
  const profile = {
    id: user.id,
    username: user.handle,
    displayName: user.displayName,
    role: toUiRole(user.role), // 'domme' | 'sub'
    avatarUrl: user.avatarUrl ?? undefined,
    bannerUrl: user.bannerUrl ?? undefined,
    bio: user.bio ?? undefined,
    location: user.location ?? undefined,
    createdAt: user.createdAt,
    stats: {
      followers: user._count.followers ?? 0,
      following: user._count.following ?? 0,
      posts: user._count.Post ?? 0,
    },

    // 🔧 Alias für evtl. Code, der profile.author.* nutzt
    author: {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      role: user.role,                // 'DOMME' | 'SUBMISSIVE'
      avatarUrl: user.avatarUrl ?? null,
    },
  };

  return (
    <ClientProfile
      profile={profile}
      isOwner={!!me && me.id === user.id}
      initialIsFollowing={isFollowing}
      viewerHasBlocked={viewerHasBlocked}
      isBlockedByProfile={isBlockedByProfile}
    />
  );
}
