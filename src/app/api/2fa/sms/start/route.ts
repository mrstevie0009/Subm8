import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { sendSms } from '@/lib/sms';

export async function POST() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, phone: true },
  });

  if (!user?.phone) {
    return NextResponse.json({ error: 'No phone on file' }, { status: 400 });
  }

  // optional: alte Codes invalidieren
  await prisma.smsCode.deleteMany({
    where: { userId: user.id, purpose: '2FA_SETUP' },
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.smsCode.create({
    data: { userId: user.id, code, purpose: '2FA_SETUP', expiresAt },
  });

  // Fehler beim SMS-Senden nicht hart failen lassen, aber loggen
  await sendSms({
    to: user.phone,
    body: `Your Subm8 code: ${code} (valid 10 min)`,
  }).catch((e) => console.warn('sendSms failed:', e));

  return NextResponse.json({ ok: true });
}
