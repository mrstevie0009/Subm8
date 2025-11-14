//src/app/api/2fa/sms/verify/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export async function POST(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  if (!/^\d{6}$/.test(String(code ?? ''))) {
    return NextResponse.json({ error: 'Bad code' }, { status: 400 });
  }

  const entry = await prisma.smsCode.findFirst({
    where: { userId: me.id, purpose: '2FA_SETUP' },
    orderBy: { expiresAt: 'desc' },
  });

  if (!entry || entry.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Expired/invalid' }, { status: 400 });
  }

  if (entry.code !== String(code)) {
    await prisma.smsCode.update({
      where: { id: entry.id },
      data: { attempts: { increment: 1 } },
    });
    return NextResponse.json({ error: 'Wrong code' }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: me.id },
      data: { twoFactorEnabled: true, twoFactorType: 'SMS' },
    }),
    prisma.smsCode.deleteMany({ where: { userId: me.id, purpose: '2FA_SETUP' } }),
  ]);

  return NextResponse.json({ ok: true });
}
