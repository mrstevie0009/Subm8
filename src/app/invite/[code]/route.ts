// src/app/invite/[code]/route.ts    <-- wichtig: nicht unter /api/ !
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import type { Role } from '@prisma/client';

// 1) async + await cookies()
async function pickLocale() {
  const c = await cookies();
  return c.get('NEXT_LOCALE')?.value || 'en';
}

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { code: string } }) {
  // 2) Origin aus req.url statt headers()
  const url = new URL(req.url);
  const base = url.origin;

  // 3) locale awaiten
  const locale = await pickLocale();

  const session = await getAuth();
  const userId = session?.user?.id;
  const userRole = session?.user?.role as Role | undefined;

  if (!userId) {
    return NextResponse.redirect(`${base}/${locale}/login?next=${encodeURIComponent(url.pathname)}`);
  }

  const { code } = params;
  const inv = await prisma.communityInvite.findUnique({
    where: { token: code },
    include: { community: true },
  });

  const now = new Date();
  const invalid =
    !inv ||
    inv.revokedAt !== null ||
    (inv.expiresAt && inv.expiresAt < now) ||
    (inv.maxUses != null && inv.usedCount >= inv.maxUses);

  if (invalid) {
    return NextResponse.redirect(`${base}/${locale}/communities?error=invite_invalid`);
  }

  if (inv.type === 'DIRECT' && inv.targetUserId && inv.targetUserId !== userId) {
    return NextResponse.redirect(`${base}/${locale}/communities?error=invite_not_for_you`);
  }

  if (inv.community.joinPolicy === 'DOMME_ONLY' && userRole !== 'DOMME') {
    return NextResponse.redirect(`${base}/${locale}/communities/${inv.community.slug}?error=role_denied`);
  }
  if (inv.community.joinPolicy === 'SUB_ONLY' && userRole !== 'SUBMISSIVE') {
    return NextResponse.redirect(`${base}/${locale}/communities/${inv.community.slug}?error=role_denied`);
  }

  await prisma.communityMember.upsert({
    where: { communityId_userId: { communityId: inv.communityId, userId } },
    update: {},
    create: { communityId: inv.communityId, userId, role: 'MEMBER' },
  });

  if (inv.maxUses != null) {
    await prisma.communityInvite.update({
      where: { id: inv.id },
      data: { usedCount: inv.usedCount + 1 },
    });
  }

  return NextResponse.redirect(`${base}/${locale}/communities/${inv.community.slug}`);
}
