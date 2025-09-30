// src/app/api/2fa/passkey/registration-options/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { getRegistrationOptions } from '@/lib/webauthn';

const COOKIE = 'webauthn_reg_chal';

export async function GET() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userName = me.email || me.handle || me.id;
  const opts = await getRegistrationOptions(me.id, userName);

  const res = NextResponse.json(opts);
  res.cookies.set(COOKIE, String(opts.challenge), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 5,
  });
  return res;
}
