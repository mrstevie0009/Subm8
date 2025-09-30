// src/app/api/2fa/passkey/authentication-options/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { getAuthenticationOptions } from '@/lib/webauthn';

const COOKIE = 'webauthn_auth_chal';

export async function GET() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const opts = await getAuthenticationOptions(me.id);

  const res = NextResponse.json(opts);
  res.cookies.set(COOKIE, String(opts.challenge), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 5,
  });
  return res;
}
