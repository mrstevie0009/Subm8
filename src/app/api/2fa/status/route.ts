// src/app/api/2fa/status/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ needed: false, methods: [] });

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { twoFactorEnabled: true, twoFactorType: true, phone: true },
  });

  if (!user) return NextResponse.json({ needed: false, methods: [] });

  const methods: Array<'passkey'|'sms'> = [];
  if (user.twoFactorEnabled && user.twoFactorType === 'WEBAUTHN') methods.push('passkey');
  if (user.twoFactorEnabled && user.twoFactorType === 'SMS') methods.push('sms');

  // Optional: Wenn mehrere Passkeys existieren, WEBAUTHN ist evtl. nicht als twoFactorType gesetzt.
  if (!methods.includes('passkey')) {
    const count = await prisma.webAuthnCredential.count({ where: { userId: me.id } });
    if (count > 0) methods.push('passkey');
  }

  const needed = methods.length > 0;
  return NextResponse.json({ needed, methods });
}
