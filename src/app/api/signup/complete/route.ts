// src/app/api/signup/complete/route.ts
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client'; // ⬅️ Enum direkt importieren

type Body = {
  handle: string;
  role: 'domme' | 'submissive';
  email: string;
  password: string;
};

export async function POST(req: Request) {
  try {
    const { handle, role, email, password } = (await req.json()) as Body;

    const h = (handle || '').toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(h)) {
      return Response.json({ ok: false, error: 'Invalid handle' }, { status: 400 });
    }
    if (!email || !password) {
      return Response.json({ ok: false, error: 'Missing email/password' }, { status: 400 });
    }

    const dupHandle = await prisma.user.findFirst({
      where: { handle: { equals: h, mode: 'insensitive' } },
      select: { id: true },
    });
    if (dupHandle) return Response.json({ ok: false, error: 'Handle already taken' }, { status: 409 });

    const dupEmail = await prisma.user.findUnique({ where: { email } });
    if (dupEmail) return Response.json({ ok: false, error: 'Email already in use' }, { status: 409 });

    const passwordHash = await bcrypt.hash(password, 12);

    // ⬅️ korrekt getyptes Enum-Mapping
    const dbRole: Role = role === 'domme' ? Role.DOMME : Role.SUBMISSIVE;

    await prisma.user.create({
      data: {
        handle: h,
        displayName: h,
        role: dbRole,
        email,
        passwordHash,        // ggf. an dein Schema anpassen
        nsfwDefault: false,
      },
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: 'Unexpected error' }, { status: 500 });
  }
}
