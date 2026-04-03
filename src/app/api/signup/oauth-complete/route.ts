// src/app/api/signup/oauth-complete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { cookies } from 'next/headers';
import { encode } from 'next-auth/jwt';
import { ensureAvailableHandle } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const isFakeMode = () => process.env.VERIFF_FAKE_MODE === 'true';

const OAUTH_PENDING_COOKIE = 'subm8_oauth_pending';
const OAUTH_PENDING_DATA_COOKIE = 'subm8_oauth_pending_data';

function isValidHandle(h: string) {
  return /^[a-z0-9_]{3,20}$/.test(h);
}

function parseRole(raw: unknown): Role {
  const v = String(raw ?? '').toUpperCase();
  if (v === 'DOMME') return 'DOMME';
  if (v === 'SUBMISSIVE') return 'SUBMISSIVE';
  throw new Error('Invalid role');
}

type PendingOAuthData = {
  email: string;
  provider: 'google';
  providerAccountId: string;
  name?: string | null;
  image?: string | null;
};

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

    const c = await cookies();
    const rawPending = c.get(OAUTH_PENDING_DATA_COOKIE)?.value;

    if (!rawPending) {
      return NextResponse.json({ ok: false, error: 'OAuth session missing' }, { status: 400 });
    }

    let pending: PendingOAuthData;
    try {
      pending = JSON.parse(decodeURIComponent(rawPending)) as PendingOAuthData;
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid OAuth session' }, { status: 400 });
    }

    if (!pending.email || !pending.providerAccountId || pending.provider !== 'google') {
      return NextResponse.json({ ok: false, error: 'Invalid OAuth payload' }, { status: 400 });
    }

    const email = pending.email.toLowerCase();

    const existingByEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingByEmail) {
      const res = NextResponse.json({ ok: true, redirectTo: '/' });
      res.cookies.delete(OAUTH_PENDING_COOKIE);
      res.cookies.delete(OAUTH_PENDING_DATA_COOKIE);
      res.cookies.delete('signup_handle');
      res.cookies.delete('signup_role');
      return res;
    }

    const existingByHandle = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
    });

    if (existingByHandle) {
    return NextResponse.json({ ok: false, error: 'Handle already taken' }, { status: 409 });
    }

    const finalHandle = await ensureAvailableHandle(handle);

    if (finalHandle !== handle) {
    return NextResponse.json({ ok: false, error: 'Handle already taken' }, { status: 409 });
    }

    const created = await prisma.user.create({
        data: {
            email,
            emailVerifiedAt: new Date(),
            handle: finalHandle,
            role,
            displayName: (pending.name?.trim() || finalHandle).slice(0, 40),
            avatarUrl: pending.image ?? null,
            nsfwDefault: false,
            passwordHash: null,
            ageVerified: isFakeMode(),
        },
      select: {
        id: true,
        handle: true,
        role: true,
        displayName: true,
        avatarUrl: true,
        email: true,
        ageVerified: true,
      },
    });

    await prisma.account.create({
      data: {
        userId: created.id,
        type: 'oauth',
        provider: 'google',
        providerAccountId: pending.providerAccountId,
      },
    });

    const token = await encode({
      token: {
        uid: created.id,
        handle: created.handle,
        role: created.role,
        name: created.displayName ?? null,
        picture: created.avatarUrl ?? null,
        email: created.email ?? null,
        ageVerified: created.ageVerified ?? false,
      },
      secret: process.env.NEXTAUTH_SECRET!,
      maxAge: 30 * 24 * 60 * 60,
    });

    const secure = process.env.NODE_ENV === 'production';
    const sessionCookieName = secure
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    const res = NextResponse.json({ ok: true });

    res.cookies.set(sessionCookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure,
      maxAge: 30 * 24 * 60 * 60,
    });

    res.cookies.delete(OAUTH_PENDING_COOKIE);
    res.cookies.delete(OAUTH_PENDING_DATA_COOKIE);
    res.cookies.delete('signup_handle');
    res.cookies.delete('signup_role');

    return res;
  } catch (e) {
    console.error('POST /api/signup/oauth-complete failed', e);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}