//src/app/api/auth/brute-status/route.ts
import { NextResponse } from 'next/server';
import { isBlocked } from '@/lib/bruteforce';
import { getClientIp } from '@/lib/ip';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const identifier = (searchParams.get('identifier') || '').trim();
  if (!identifier) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const ip = await getClientIp();
  try {
    const status = await isBlocked(ip, identifier);
    // status: { ok: boolean, reason?: 'temp'|'perm', until?: Date|null }
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    console.error('brute-status error', { err, ip, identifier });
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
