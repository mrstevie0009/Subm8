//src/app/[locale]/(protected)/u/[handle]/page.tsx
import * as React from 'react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import ClientProfile from './ClientProfile';
import { notFound } from 'next/navigation';
import type { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

type Params = { locale: string; handle: string };

function toUiRole(role: Role): 'domme' | 'sub' {
  return role === 'DOMME' ? 'domme' : 'sub';
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { handle } = await params;

  // User möglichst robust auflösen (case-insensitive Handle, @ erlauben)
  const raw = handle.startsWith('@') ? handle.slice(1) : handle;
  const normalized = raw.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { handle: { equals: normalized, mode: 'insensitive' } },
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
      pinnedPostId: true,
      _count: { select: { followers: true, following: true, Post: true } },
    },
  });

  if (!user) notFound();

  // Viewer parallel bestimmen + Relation-Flags parallel holen
  const me = await getCurrentUser().catch(() => null);

  const [viewerHasBlocked, isBlockedByProfile, isFollowing] = await Promise.all([
    me
      ? prisma.block
          .findFirst({
            where: { blockerId: me.id, blockedId: user.id },
            select: { blockerId: true },
          })
          .then(Boolean)
      : Promise.resolve(false),
    me
      ? prisma.block
          .findFirst({
            where: { blockerId: user.id, blockedId: me.id },
            select: { blockerId: true },
          })
          .then(Boolean)
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
    pinnedPostId: user.pinnedPostId ?? null,
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

  // Sofort Seiten-Shell rendern; Details/Posts laden per Client (Tabs)
  return (
    <React.Suspense fallback={null /* Route-level loading.tsx zeigt Skeleton */}>
      <ClientProfile
        profile={profile}
        isOwner={!!me && me.id === user.id}
        initialIsFollowing={isFollowing}
        viewerHasBlocked={viewerHasBlocked}
        isBlockedByProfile={isBlockedByProfile}
      />
    </React.Suspense>
  );
}
