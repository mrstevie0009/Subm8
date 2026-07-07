// src/app/api/auth/reset-password/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/password';

export async function POST(req: Request) {
  const { token, password } = await req.json();

  if (!token || typeof token !== 'string' || !password || typeof password !== 'string') {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
  if (password.length < 10) {
      return NextResponse.json({ ok: false, error: "Password must be at least 10 characters" }, { status: 400 });
    }

  const entry = await prisma.passwordResetToken.findUnique({ where: { token } });
  if (!entry || entry.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
  }

  const pwHash = await hashPassword(password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash: pwHash },
    }),
    prisma.passwordResetToken.delete({ where: { token } }),
    prisma.session.deleteMany({ where: { userId: entry.userId } }),
  ]);

  return NextResponse.json({ ok: true });
}
