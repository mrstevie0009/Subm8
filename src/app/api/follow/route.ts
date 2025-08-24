// src/app/api/follow/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const runtime = 'nodejs';

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type FollowBody = { targetUserId: string };
function isFollowBody(x: unknown): x is FollowBody {
  if (typeof x !== 'object' || x === null) return false;
  const obj = x as Record<string, unknown>;
  return typeof obj.targetUserId === 'string';
}

/** POST /api/follow  – jemanden folgen (idempotent) */
export async function POST(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return bad('Not authenticated', 401);

  const bodyUnknown = (await req.json().catch(() => null)) as unknown;
  if (!isFollowBody(bodyUnknown)) return bad('targetUserId missing');

  const { targetUserId } = bodyUnknown;
  if (targetUserId === me.id) return bad('Cannot follow yourself');

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) return bad('User not found', 404);

  await prisma.follow.upsert({
    where: { followerId_followeeId: { followerId: me.id, followeeId: targetUserId } },
    create: { followerId: me.id, followeeId: targetUserId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}

/** DELETE /api/follow?targetUserId=... – Follow entfernen (idempotent) */
export async function DELETE(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return bad('Not authenticated', 401);

  const url = new URL(req.url);
  const targetUserId = url.searchParams.get('targetUserId');
  if (!targetUserId) return bad('targetUserId missing');

  try {
    await prisma.follow.delete({
      where: { followerId_followeeId: { followerId: me.id, followeeId: targetUserId } },
    });
  } catch {
    // Falls kein Follow existiert, ignorieren (idempotent)
  }

  return NextResponse.json({ ok: true });
}
