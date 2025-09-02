// src/app/api/signup/complete/route.ts
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';

export const dynamic = 'force-dynamic';

type Body = {
  handle?: string;
  role?: string; // accept any string; we'll normalize
  email?: string;
  password?: string;
};

function isValidHandle(h: string) {
  return /^[a-z0-9_]{3,20}$/.test(h);
}
function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body | null;

    const handleRaw = (body?.handle ?? '').toString().toLowerCase();
    const roleRaw   = (body?.role ?? '').toString();
    const email     = (body?.email ?? '').toString().trim();
    const password  = (body?.password ?? '').toString();

    if (!isValidHandle(handleRaw)) {
      return Response.json({ ok: false, error: 'Invalid handle' }, { status: 400 });
    }
    if (!isValidEmail(email)) {
      return Response.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }
    if (password.length < 8) {
      return Response.json({ ok: false, error: 'Password too short' }, { status: 400 });
    }

    // normalize & validate role (accepts 'DOMME'/'SUBMISSIVE' or 'domme'/'submissive')
    const roleUpper = roleRaw.toUpperCase();
    if (roleUpper !== 'DOMME' && roleUpper !== 'SUBMISSIVE') {
      return Response.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }
    const dbRole: Role = roleUpper === 'DOMME' ? Role.DOMME : Role.SUBMISSIVE;

    // uniqueness checks
    const dupHandle = await prisma.user.findFirst({
      where: { handle: { equals: handleRaw, mode: 'insensitive' } },
      select: { id: true },
    });
    if (dupHandle) {
      return Response.json({ ok: false, error: 'Handle already taken' }, { status: 409 });
    }

    const dupEmail = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (dupEmail) {
      return Response.json({ ok: false, error: 'Email already in use' }, { status: 409 });
    }

    // hash & create
    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        handle: handleRaw,
        displayName: handleRaw, // oder eigenen DisplayName setzen
        role: dbRole,           // ← jetzt korrekt gesetzt
        email,
        passwordHash,
        nsfwDefault: false,
      },
    });

    return Response.json({ ok: true });
  } catch (e) {
    console.error('signup/complete error', e);
    return Response.json({ ok: false, error: 'Unexpected error' }, { status: 500 });
  }
}
