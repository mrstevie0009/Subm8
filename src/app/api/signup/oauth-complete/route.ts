// src/app/api/signup/oauth-complete/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  handle?: string;
  role?: string;
  email?: string;
};

function isValidHandle(h: string) {
  return /^[a-z0-9_]{3,20}$/.test(h);
}

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const handleRaw = String(body?.handle ?? '').trim().toLowerCase();
    const roleRaw = String(body?.role ?? '').trim();
    const emailRaw = String(body?.email ?? '').trim();
    const emailLower = emailRaw.toLowerCase();

    if (!isValidHandle(handleRaw)) {
      return NextResponse.json({ ok: false, error: 'Invalid handle' }, { status: 400 });
    }

    if (!isValidEmail(emailLower)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }

    const roleUpper = roleRaw.toUpperCase();
    if (roleUpper !== 'DOMME' && roleUpper !== 'SUBMISSIVE') {
      return NextResponse.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }
    const dbRole: Role = roleUpper === 'DOMME' ? Role.DOMME : Role.SUBMISSIVE;

    // Check handle
    const existingHandle = await prisma.user.findFirst({
      where: { handle: { equals: handleRaw, mode: 'insensitive' } },
      select: { id: true },
    });

    if (existingHandle) {
      return NextResponse.json({ ok: false, error: 'Handle already taken' }, { status: 409 });
    }

    // Check email
    const existingEmail = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json({ ok: false, error: 'Email already in use' }, { status: 409 });
    }

    // ✅ Create user (OAuth = no password, pre-verified email)
    await prisma.user.create({
      data: {
        handle: handleRaw,
        displayName: handleRaw,
        role: dbRole,
        email: emailLower,
        emailVerifiedAt: new Date(), // ✅ Google accounts are pre-verified
        nsfwDefault: false,
        passwordHash: null, // ❌ No password for OAuth users
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('signup/oauth-complete error', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}