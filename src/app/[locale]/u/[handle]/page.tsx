// src/app/[locale]/u/[handle]/page.tsx
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import ClientProfile from './ClientProfile';
import { notFound } from 'next/navigation';
import type { Role } from '@prisma/client';

type Params = { locale: string; handle: string };
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
      websiteUrl: true,
      pinnedPostId: true,                 // ⇐ NEU
      _count: { select: { followers: true, following: true, Post: true } },
    },
  });

  if (!user) return notFound();

  const profile = {
    id: user.id,
    username: user.handle,
    displayName: user.displayName,
    role: toUiRole(user.role),
    avatarUrl: user.avatarUrl ?? undefined,
    bannerUrl: user.bannerUrl ?? undefined,
    bio: user.bio ?? undefined,
    location: user.location ?? undefined,
    createdAt: user.createdAt,
    websiteUrl: user.websiteUrl ?? null,
    pinnedPostId: user.pinnedPostId ?? null,  // ⇐ NEU
    stats: {
      followers: user._count.followers ?? 0,
      following: user._count.following ?? 0,
      posts: user._count.Post ?? 0,
    },
    author: {
      id: user.id,
      handle: user.handle,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl ?? null,
    },
  };

  return (
    <ClientProfile
      profile={profile}
      isOwner={!!me && me.id === user.id}
      initialIsFollowing={!!(await (async () => {
        if (!me) return false;
        const f = await prisma.follow.findUnique({
          where: { followerId_followeeId: { followerId: me.id, followeeId: user.id } },
          select: { followerId: true },
        });
        return !!f;
      })())}
      viewerHasBlocked={!!(me && (await prisma.block.findFirst({ where: { blockerId: me.id, blockedId: user.id } })))}
      isBlockedByProfile={!!(me && (await prisma.block.findFirst({ where: { blockerId: user.id, blockedId: me.id } })))}
    />
  );
}
