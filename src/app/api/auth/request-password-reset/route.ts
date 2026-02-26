//src/app/api/auth/request-password-reset/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/mailer';
import crypto from 'crypto';

const LOCALE_WHITELIST = new Set(['de', 'en']); // passe an, falls mehr Locales

export async function POST(req: Request) {
  const { email, locale } = await req.json();

  if (!email || typeof email !== 'string') {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Locale sicher bestimmen (Body > URL > Fallback)
  const url = new URL(req.url);
  const urlFirstSeg = url.pathname.split('/').filter(Boolean)[0]; // evtl. schon ein locale
  const rawLocale = typeof locale === 'string' ? locale : urlFirstSeg;
  const safeLocale = LOCALE_WHITELIST.has(rawLocale ?? '') ? (rawLocale as string) : 'en';

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');

    await prisma.$transaction([
      prisma.passwordResetToken.deleteMany({ where: { userId: user.id } }), // optional hardening
      prisma.passwordResetToken.create({
        data: {
          token,
          userId: user.id,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        },
      }),
    ]);

    // Basis-URL robust ermitteln
    const base =
      process.env.NEXT_PUBLIC_BASE_URL
      ?? process.env.NEXTAUTH_URL
      ?? `${url.origin}`;

    const origin = base.replace(/\/+$/,'');
    const link = `${origin}/${safeLocale}/reset-password?token=${encodeURIComponent(token)}`;

    await sendMail({
      to: email,
      subject: '🔒 Reset your Subm8 password',
      html: `
        <div style="font-family:sans-serif;padding:16px;">
          <h2>Reset your password</h2>
          <p>We received a request to reset your Subm8 account password.</p>
          <p><a href="${link}"
            style="display:inline-block;background:#a259ff;color:white;
                  padding:10px 18px;border-radius:8px;text-decoration:none">
            Reset password
          </a></p>
          <p style="color:#555;font-size:14px;">
            This link expires in 30 minutes.<br>
            If you didn’t request a reset, you can ignore this email.
          </p>
        </div>
      `,
      text: `Reset your password: ${link}`,
    });
  }

  return NextResponse.json({ ok: true });
}
