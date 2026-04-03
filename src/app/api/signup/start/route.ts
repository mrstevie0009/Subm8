// src/app/api/signup/start/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

function isValidHandle(h: string) {
  return /^[a-z0-9_]{3,20}$/.test(h);
}
function parseRole(raw: unknown): Role {
  const v = String(raw ?? '').toUpperCase();
  if (v === 'DOMME') return 'DOMME';
  if (v === 'SUBMISSIVE') return 'SUBMISSIVE';
  throw new Error('Invalid role');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null) as { 
      handle?: string; 
      role?: string;
      oauthEmail?: string;
    } | null;
    
    const handle = String(body?.handle ?? '').toLowerCase();
    if (!isValidHandle(handle)) {
      return Response.json({ ok: false, error: 'Invalid handle' }, { status: 400 });
    }

    let role: Role;
    try {
      role = parseRole(body?.role);
    } catch {
      return Response.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }

    // handle frei?
    const exists = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
    if (exists) {
      return Response.json({ ok: false, error: 'Handle already taken' }, { status: 409 });
    }

    // Cookie setzen
    const c = await cookies();
    c.set('signup_handle', handle, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 900 });
    c.set('signup_role', role, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 900 });

    if (body?.oauthEmail) {
      c.set('signup_oauth_email', body.oauthEmail, { 
        httpOnly: true, 
        sameSite: 'lax', 
        path: '/', 
        maxAge: 900 
      });
    }

    return Response.json({ ok: true });
  } catch (e) {
    console.error('POST /api/signup/start failed', e);
    return Response.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}