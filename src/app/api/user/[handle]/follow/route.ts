// src/app/api/user/[handle]/follow/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

type Action = 'follow' | 'unfollow';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  try {
    const { handle } = await params;

    const me = await getCurrentUser().catch(() => null);
    if (!me) {
      return NextResponse.json(
        { ok: false, error: 'UNAUTHENTICATED' },
        { status: 401 },
      );
    }

    const normalizedHandle = handle.toLowerCase();
    const target = await prisma.user.findFirst({
      where: { handle: { equals: normalizedHandle, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!target) {
      return NextResponse.json(
        { ok: false, error: 'USER_NOT_FOUND' },
        { status: 404 },
      );
    }
    if (target.id === me.id) {
      return NextResponse.json(
        { ok: false, error: 'CANNOT_FOLLOW_SELF' },
        { status: 400 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as
      | { action?: Action }
      | undefined;
    const action: Action | undefined = body?.action;

    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followeeId: {
          followerId: me.id,
          followeeId: target.id,
        },
      },
      select: { id: true },
    });

    let followed: boolean;

    if (action === 'follow' || (!action && !existing)) {
      // try-create (ignoriert unique violation & bleibt idempotent)
      await prisma.follow
        .create({ data: { followerId: me.id, followeeId: target.id } })
        .catch(() => null);
      followed = true;
    } else if (action === 'unfollow' || (!action && existing)) {
      await prisma.follow.deleteMany({
        where: { followerId: me.id, followeeId: target.id },
      });
      followed = false;
    } else {
      followed = !!existing;
    }

    const followersCount = await prisma.follow.count({
      where: { followeeId: target.id },
    });

    return NextResponse.json({ ok: true, followed, followersCount });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'INTERNAL' },
      { status: 500 },
    );
  }
}
