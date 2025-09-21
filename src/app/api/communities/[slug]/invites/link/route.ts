// src/app/api/communities/[slug]/invites/link/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

  const { slug } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const { expiresInDays, maxUses } = body as { expiresInDays?: number; maxUses?: number };

  const community = await prisma.community.findUnique({ where: { slug }, select: { id: true } });
  if (!community) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  // Permission: Mitgliedschaft reicht (einfacher Start)
  const member = await prisma.communityMember.findUnique({
    where: { communityId_userId: { communityId: community.id, userId: me.id } },
    select: { userId: true },
  });
  if (!member) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });

  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = typeof expiresInDays === 'number' && expiresInDays > 0
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  const inv = await prisma.communityInvite.create({
    data: {
      communityId: community.id,
      createdById: me.id,
      type: 'LINK',
      token,
      maxUses: typeof maxUses === 'number' ? Math.max(1, Math.floor(maxUses)) : null,
      expiresAt: expiresAt ?? undefined,
    },
    select: { token: true, expiresAt: true, maxUses: true },
  });

  const origin = new URL(req.url).origin;
  const url = `${origin}/invite/${inv.token}`;
  return NextResponse.json({ ok: true, url, token: inv.token, expiresAt: inv.expiresAt, maxUses: inv.maxUses });
}
