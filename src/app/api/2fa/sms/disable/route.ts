import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export async function POST() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { twoFactorEnabled: true, twoFactorType: true },
  });

  // 2FA nur abbauen, wenn SMS aktiv war
  if (user?.twoFactorEnabled && user.twoFactorType === 'SMS') {
    await prisma.user.update({
      where: { id: me.id },
      data: { twoFactorEnabled: false, twoFactorType: null },
    });
  }

  // Offene Challenges/Codes bereinigen
  await prisma.smsChallenge.deleteMany({ where: { userId: me.id } }).catch(() => {});
  await prisma.smsCode.deleteMany({ where: { userId: me.id, purpose: '2FA_SETUP' } }).catch(() => {});

  return NextResponse.json({ ok: true });
}
