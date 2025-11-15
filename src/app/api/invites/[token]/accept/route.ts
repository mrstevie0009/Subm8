// src/app/api/invites/[token]/accept/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const { token } = await params;

  const inv = await prisma.communityInvite.findUnique({
    where: { token },
    select: {
      id: true,
      type: true,
      targetUserId: true,
      communityId: true,
      expiresAt: true,
      revokedAt: true,
      maxUses: true,
      usedCount: true,
    },
  });
  if (!inv) {
    return NextResponse.json(
      { ok: false, error: 'INVALID' },
      { status: 404 },
    );
  }

  if (inv.revokedAt) {
    return NextResponse.json(
      { ok: false, error: 'REVOKED' },
      { status: 410 },
    );
  }
  if (inv.expiresAt && inv.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { ok: false, error: 'EXPIRED' },
      { status: 410 },
    );
  }
  if (inv.maxUses != null && inv.usedCount >= inv.maxUses) {
    return NextResponse.json(
      { ok: false, error: 'LIMIT_REACHED' },
      { status: 409 },
    );
  }
  if (inv.type === 'DIRECT' && inv.targetUserId !== me.id) {
    return NextResponse.json(
      { ok: false, error: 'NOT_TARGET' },
      { status: 403 },
    );
  }

  // Schon Mitglied?
  const already = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId: inv.communityId,
        userId: me.id,
      },
    },
    select: { communityId: true },
  });
  if (!already) {
    await prisma.communityMember.create({
      data: { communityId: inv.communityId, userId: me.id },
    });
  }

  await prisma.communityInvite.update({
    where: { id: inv.id },
    data: { usedCount: { increment: 1 } },
  });

  return NextResponse.json({ ok: true });
}
