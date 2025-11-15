// src/app/api/profile/[handle]/follows/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import type { Prisma } from '@prisma/client';

type Tab = 'followers' | 'following' | 'vFollowers' | 'vFollowing';

// Welche User-Felder wir in der Liste brauchen
const selectUserPick = {
  id: true,
  handle: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  premiumUntil: true,
  isFirstAdopter: true,
} satisfies Prisma.UserSelect;

type UserPick = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'DOMME' | 'SUBMISSIVE' | string;
  premiumUntil: Date | string | null;
  isFirstAdopter: boolean | null;
};

type Params = { handle: string };
type Ctx = { params: Promise<Params> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { handle } = await params;
    const url = new URL(req.url);
    const tab = (url.searchParams.get('tab') || 'followers') as Tab;
    const takeRaw = Number(url.searchParams.get('take') || '30');
    const take = Math.max(1, Math.min(takeRaw, 50));
    const cursor = url.searchParams.get('cursor') ?? undefined; // follow-row id

    const me = await getCurrentUser().catch(() => null);

    const user = await prisma.user.findUnique({
      where: { handle: handle.toLowerCase() },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'USER_NOT_FOUND' },
        { status: 404 }
      );
    }

    const now = new Date();
    const verifiedWhere: Prisma.UserWhereInput = {
      OR: [{ premiumUntil: { gt: now } }, { isFirstAdopter: true }],
    };

    const orderBy: Prisma.FollowOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { id: 'desc' },
    ];

    // kleiner Helper, um optional cursor/skip typsicher zu spready-en
    const withCursor = <T extends Prisma.FollowFindManyArgs>(args: T): T & Partial<Pick<Prisma.FollowFindManyArgs, 'cursor'|'skip'>> =>
      cursor ? ({ ...args, cursor: { id: cursor }, skip: 1 }) : args;

    let items: Array<{
      id: string;
      handle: string;
      displayName: string;
      avatarUrl: string | null;
      role: 'DOMME' | 'SUBMISSIVE' | string;
      premiumUntil: Date | string | null;
      isFirstAdopter: boolean | null;
      initialFollowing: boolean;
    }> = [];

    let nextCursor: string | null = null;

    if (tab === 'followers' || tab === 'vFollowers') {
      // ⬇️ Follower-Zweig
      const rows = await prisma.follow.findMany(
        withCursor({
          where: {
            followeeId: user.id,
            ...(tab === 'vFollowers' ? { follower: verifiedWhere } : {}),
          },
          select: {
            id: true,
            createdAt: true,
            follower: { select: selectUserPick },
          },
          orderBy,
          take,
        })
      );

      const users: UserPick[] = rows.map((r) => r.follower);

      const ids = users.map((u) => u.id);
      let followingSet = new Set<string>();
      if (me && ids.length > 0) {
        const mine = await prisma.follow.findMany({
          where: { followerId: me.id, followeeId: { in: ids } },
          select: { followeeId: true },
        });
        followingSet = new Set(mine.map((m) => m.followeeId));
      }

      items = users.map((u) => ({
        id: u.id,
        handle: u.handle,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        role: u.role,
        premiumUntil: u.premiumUntil,
        isFirstAdopter: u.isFirstAdopter,
        initialFollowing: followingSet.has(u.id),
      }));

      nextCursor = rows.length === take ? rows[rows.length - 1]!.id : null;
    } else {
      // ⬇️ Following-Zweig
      const rows = await prisma.follow.findMany(
        withCursor({
          where: {
            followerId: user.id,
            ...(tab === 'vFollowing' ? { followee: verifiedWhere } : {}),
          },
          select: {
            id: true,
            createdAt: true,
            followee: { select: selectUserPick },
          },
          orderBy,
          take,
        })
      );

      const users: UserPick[] = rows.map((r) => r.followee);

      const ids = users.map((u) => u.id);
      let followingSet = new Set<string>();
      if (me && ids.length > 0) {
        const mine = await prisma.follow.findMany({
          where: { followerId: me.id, followeeId: { in: ids } },
          select: { followeeId: true },
        });
        followingSet = new Set(mine.map((m) => m.followeeId));
      }

      items = users.map((u) => ({
        id: u.id,
        handle: u.handle,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        role: u.role,
        premiumUntil: u.premiumUntil,
        isFirstAdopter: u.isFirstAdopter,
        initialFollowing: followingSet.has(u.id),
      }));

      nextCursor = rows.length === take ? rows[rows.length - 1]!.id : null;
    }

    return NextResponse.json({ ok: true, items, nextCursor });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
