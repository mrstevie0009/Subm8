//src/app/api/communities/[slug]/members/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import type { Prisma } from '@prisma/client';

type Tab = 'members' | 'verified';

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

function encodeCursor(d: Date, userId: string) {
  return `${d.getTime()}_${userId}`;
}
function decodeCursor(token: string | null | undefined): { createdAt: Date; userId: string } | null {
  if (!token) return null;
  const [msStr, uid] = token.split('_');
  const ms = Number(msStr);
  if (!uid || !Number.isFinite(ms)) return null;
  return { createdAt: new Date(ms), userId: uid };
}

type Params = { slug: string };
type Ctx = { params: Promise<Params> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const tab = (url.searchParams.get('tab') || 'members') as Tab;
    const takeRaw = Number(url.searchParams.get('take') || '30');
    const take = Math.max(1, Math.min(takeRaw, 50));
    const cursorToken = url.searchParams.get('cursor');

    const me = await getCurrentUser().catch(() => null);

    const community = await prisma.community.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true },
    });
    if (!community) {
      return NextResponse.json({ ok: false, error: 'COMMUNITY_NOT_FOUND' }, { status: 404 });
    }

    const now = new Date();
    const verifiedWhere: Prisma.UserWhereInput = {
      OR: [{ premiumUntil: { gt: now } }, { isFirstAdopter: true }],
    };

    // Stabiler Sort + keyset pagination
    const orderBy: Prisma.CommunityMemberOrderByWithRelationInput[] = [
      { createdAt: 'desc' },
      { userId: 'desc' },
    ];

    const decoded = decodeCursor(cursorToken);

    const rows = await prisma.communityMember.findMany({
      where: {
        communityId: community.id,
        ...(tab === 'verified' ? { User: verifiedWhere } : {}),
        ...(decoded
          ? {
              OR: [
                { createdAt: { lt: decoded.createdAt } },
                {
                  AND: [
                    { createdAt: decoded.createdAt },
                    { userId: { lt: decoded.userId } },
                  ],
                },
              ],
            }
          : {}),
      },
      select: {
        createdAt: true,
        userId: true,
        User: { select: selectUserPick },
      },
      orderBy,
      take,
    });

    const users: UserPick[] = rows.map((r) => ({
      id: r.User.id,
      handle: r.User.handle,
      displayName: r.User.displayName,
      avatarUrl: r.User.avatarUrl,
      role: r.User.role,
      premiumUntil: r.User.premiumUntil,
      isFirstAdopter: r.User.isFirstAdopter,
    }));

    // initialFollowing (Follow-Button-Zustand)
    const ids = users.map((u) => u.id);
    let followingSet = new Set<string>();
    if (me && ids.length > 0) {
      const mine = await prisma.follow.findMany({
        where: { followerId: me.id, followeeId: { in: ids } },
        select: { followeeId: true },
      });
      followingSet = new Set(mine.map((m) => m.followeeId));
    }

    const items = users.map((u) => ({
      ...u,
      initialFollowing: followingSet.has(u.id),
    }));

    const last = rows[rows.length - 1] || null;
    const nextCursor = last ? encodeCursor(last.createdAt, last.userId) : null;

    return NextResponse.json({ ok: true, items, nextCursor });
  } catch {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
