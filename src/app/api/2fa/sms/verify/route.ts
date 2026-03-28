import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { hashCode } from '@/lib/emailVerify';

const MAX_SMS_ATTEMPTS = 5;

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

  //Attempt-Limit prüfen bevor Vergleich
  if (entry.attempts >= MAX_SMS_ATTEMPTS) {
    await prisma.smsCode.delete({ where: { id: entry.id } });
    return NextResponse.json(
      { error: 'Too many attempts. Request a new code.', code: 'TOO_MANY_ATTEMPTS' },
      { status: 429 }
    );
  }

  //Hash-Vergleich statt Klartext
  if (entry.code !== hashCode(String(code))) {
    const newAttempts = entry.attempts + 1;
    if (newAttempts >= MAX_SMS_ATTEMPTS) {
      // Code sofort löschen nach letztem Fehlversuch
      await prisma.smsCode.delete({ where: { id: entry.id } });
    } else {
      await prisma.smsCode.update({
        where: { id: entry.id },
        data: { attempts: { increment: 1 } },
      });
    }
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