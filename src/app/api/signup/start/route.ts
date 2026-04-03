// src/app/api/signup/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
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
    const body = (await req.json().catch(() => null)) as {
      handle?: string;
      role?: string;
    } | null;

    const handle = String(body?.handle ?? '').trim().toLowerCase();
    if (!isValidHandle(handle)) {
      return NextResponse.json({ ok: false, error: 'Invalid handle' }, { status: 400 });
    }

    let role: Role;
    try {
      role = parseRole(body?.role);
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }

    const exists = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    });

    if (exists) {
      return NextResponse.json({ ok: false, error: 'Handle already taken' }, { status: 409 });
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set('signup_handle', handle, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
      secure: process.env.NODE_ENV === 'production',
    });

    res.cookies.set('signup_role', role, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
      secure: process.env.NODE_ENV === 'production',
    });

    return res;
  } catch (e) {
    console.error('POST /api/signup/start failed', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}