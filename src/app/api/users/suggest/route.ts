// src/app/api/users/suggest/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { excludeAdminFromUsers } from '@/lib/adminFilter';

export async function GET(req: Request) {
  try {
    const session = await getAuth();
    const meId = session?.user?.id ?? null;

    const url = new URL(req.url);
    const limitRaw = parseInt(url.searchParams.get('limit') ?? '6', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 6;

    const where = excludeAdminFromUsers({
      isDeactivated: false,
      ...(meId ? { id: { not: meId } } : {}),
    });

    // Top-User nach Follower-Zahl (Admin & ich sind ausgeschlossen)
    const users = await prisma.user.findMany({
      where,
      take: limit,
      orderBy: [{ followers: { _count: 'desc' } }],
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        _count: { select: { followers: true } },
      },
    });

    let viewerFollowsSet = new Set<string>();
    if (meId && users.length > 0) {
      const rows = await prisma.follow.findMany({
        where: { followerId: meId, followeeId: { in: users.map(u => u.id) } },
        select: { followeeId: true },
      });
      viewerFollowsSet = new Set(rows.map(r => r.followeeId));
    }

    const payload = users.map(u => ({
      id: u.id,
      handle: u.handle,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      followers: u._count.followers,
      viewerFollows: viewerFollowsSet.has(u.id),
    }));

    return NextResponse.json({ ok: true, users: payload });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
