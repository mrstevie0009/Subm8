// src/app/api/communities/[slug]/invites/direct/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const me = await getCurrentUser().catch(() => null);
  if (!me) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { usernames, note } = body as { usernames: string[]; note?: string };

  if (!Array.isArray(usernames) || usernames.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'NO_TARGETS' },
      { status: 400 }
    );
  }

  const community = await prisma.community.findUnique({
    where: { slug },
    select: { id: true },
  });

  if (!community) {
    return NextResponse.json(
      { ok: false, error: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  const member = await prisma.communityMember.findUnique({
    where: {
      communityId_userId: {
        communityId: community.id,
        userId: me.id,
      },
    },
    select: { userId: true },
  });

  if (!member) {
    return NextResponse.json(
      { ok: false, error: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  const users = await prisma.user.findMany({
    where: { handle: { in: usernames.map((u) => u.toLowerCase()) } },
    select: { id: true, handle: true },
  });

  if (users.length === 0) {
    return NextResponse.json(
      { ok: false, error: 'TARGETS_NOT_FOUND' },
      { status: 404 }
    );
  }

  const creates = users.map((u) => ({
    communityId: community.id,
    createdById: me.id,
    type: 'DIRECT' as const,
    token: crypto.randomUUID().replace(/-/g, ''),
    targetUserId: u.id,
    note: note?.slice(0, 300),
  }));

  const created = await prisma.communityInvite.createMany({ data: creates });

  return NextResponse.json({ ok: true, created: created.count });
}
