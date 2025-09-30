// src/app/api/2fa/passkey/authentication-verify/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/currentUser';
import { verifyAuthentication } from '@/lib/webauthn';

const COOKIE = 'webauthn_auth_chal';

export async function POST(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const jar = await cookies(); // ← WICHTIG
  const chal = jar.get(COOKIE)?.value || '';
  if (!chal) return NextResponse.json({ error: 'Missing challenge' }, { status: 400 });

  const body = await req.json();
  const out = await verifyAuthentication(me.id, body, chal);

  const res = NextResponse.json(out.verified ? { ok: true } : { ok: false }, { status: out.verified ? 200 : 400 });
  jar.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 }); // ← löschen
  return res;
}
