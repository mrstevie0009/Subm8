import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { sendSms } from '@/lib/sms';
import { make6DigitCode, hashCode } from '@/lib/emailVerify';

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

  await prisma.smsCode.deleteMany({
    where: { userId: user.id, purpose: '2FA_SETUP' },
  });

  const code = make6DigitCode();           
  const codeHash = hashCode(code);         
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await prisma.smsCode.create({
    data: { userId: user.id, code: codeHash, purpose: '2FA_SETUP', expiresAt },
  });

  await sendSms({
    to: user.phone,
    body: `Your Subm8 code: ${code} (valid 10 min)`,
  }).catch((e) => console.warn('sendSms failed:', e));

  return NextResponse.json({ ok: true });
}