// src/app/api/auth/request-password-reset/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import crypto from 'crypto';

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');

    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });

    const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await sendMail({
        to: email,
        subject: 'Reset your password',
        text: `Click the link to reset your password: ${link}`,
        html: `<p>Click the link to reset your password:</p><p><a href="${link}">${link}</a></p>`,
      });
    } catch (err) {
      console.warn('[password-reset] email sending failed:', err);
      // absichtlich KEIN throw → Antwort bleibt ok
    }
  }

  return NextResponse.json({ ok: true });
}
