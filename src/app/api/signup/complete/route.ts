// src/app/api/signup/complete/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { sendMail } from '@/lib/mailer';
import { make6DigitCode, hashCode } from '@/lib/emailVerify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  handle?: string;
  role?: string; // 'DOMME' | 'SUBMISSIVE' (any casing)
  email?: string;
  password?: string;
  dommeGiftDisclaimerAccepted?: boolean;
};

function isValidHandle(h: string) {
  return /^[a-z0-9_]{3,20}$/.test(h);
}
function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

const CODE_TTL_MIN = 10;
const RESEND_COOLDOWN_SEC = 15;
const BRAND = 'Subm8';

async function sendVerifyEmail(to: string, code: string) {
  await sendMail({
    to,
    subject: `✅ Verify your ${BRAND} email`,
    text: `Your verification code is: ${code}\n\nThis code expires in ${CODE_TTL_MIN} minutes.`,
    html: `
      <div style="font-family:sans-serif;padding:16px">
        <h2>Verify your email</h2>
        <p>Your ${BRAND} verification code:</p>
        <div style="font-size:28px;letter-spacing:6px;font-weight:700;margin:12px 0">${code}</div>
        <p style="color:#666;font-size:14px">This code expires in ${CODE_TTL_MIN} minutes.</p>
      </div>
    `,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const handleRaw = String(body?.handle ?? '').trim().toLowerCase();
    const roleRaw = String(body?.role ?? '').trim();
    const emailRaw = String(body?.email ?? '').trim();
    const password = String(body?.password ?? '');

    const emailLower = emailRaw.toLowerCase();

    if (!isValidHandle(handleRaw)) {
      return NextResponse.json({ ok: false, error: 'Invalid handle' }, { status: 400 });
    }
    if (!isValidEmail(emailLower)) {
      return NextResponse.json({ ok: false, error: 'Invalid email' }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ ok: false, error: 'Password too short' }, { status: 400 });
    }

    const roleUpper = roleRaw.toUpperCase();
    if (roleUpper !== 'DOMME' && roleUpper !== 'SUBMISSIVE') {
      return NextResponse.json({ ok: false, error: 'Invalid role' }, { status: 400 });
    }
    const dbRole: Role = roleUpper === 'DOMME' ? Role.DOMME : Role.SUBMISSIVE;

    // ✅ Domme Disclaimer server-side enforce
    if (dbRole === Role.DOMME && body?.dommeGiftDisclaimerAccepted !== true) {
      return NextResponse.json({ ok: false, error: 'Domme disclaimer required' }, { status: 400 });
    }

    // ---- Find existing user by email (case-insensitive safe path) ----
    // If your Prisma schema uses a case-insensitive collation on email, findUnique is fine.
    // Otherwise this still works because we store emailLower and always query lowercased.
    const existingByEmail = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true, handle: true, emailVerifiedAt: true, emailVerifyLastSentAt: true },
    });

    // ---- Check handle conflict (case-insensitive) ----
    const existingByHandle = await prisma.user.findFirst({
      where: { handle: { equals: handleRaw, mode: 'insensitive' } },
      select: { id: true, email: true },
    });

    // If handle exists and it's not the same user as existingByEmail -> conflict
    if (existingByHandle && (!existingByEmail || existingByHandle.id !== existingByEmail.id)) {
      return NextResponse.json({ ok: false, error: 'Handle already taken' }, { status: 409 });
    }

    // If email exists and is verified -> conflict
    if (existingByEmail?.emailVerifiedAt) {
      return NextResponse.json({ ok: false, error: 'Email already in use' }, { status: 409 });
    }

    // If email exists but unverified AND handle doesn't match -> conflict (prevents hijacking email)
    if (existingByEmail && existingByEmail.handle.toLowerCase() !== handleRaw) {
      return NextResponse.json(
        { ok: false, error: 'Email already pending verification for another handle' },
        { status: 409 }
      );
    }

    // ---- Cooldown (for both: new signup and "resume verify") ----
    const now = Date.now();
    const last = existingByEmail?.emailVerifyLastSentAt?.getTime() ?? 0;
    const minNext = last + RESEND_COOLDOWN_SEC * 1000;

    if (last && now < minNext) {
      const retryAfterSec = Math.ceil((minNext - now) / 1000);
      return NextResponse.json(
        { ok: false, cooldown: true, retryAfterSec, error: 'Cooldown' },
        { status: 429 }
      );
    }

    // ---- Create or update user ----
    const passwordHash = await bcrypt.hash(password, 12);

    const user = existingByEmail
      ? await prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            // keep handle/email stable; but allow password update during "resume"
            passwordHash,
            role: dbRole,
            displayName: handleRaw,
            emailVerifyLastSentAt: new Date(now),
          },
          select: { id: true, email: true },
        })
      : await prisma.user.create({
          data: {
            handle: handleRaw,
            displayName: handleRaw,
            role: dbRole,
            email: emailLower,
            passwordHash,
            nsfwDefault: false,
            emailVerifiedAt: null,
            emailVerifyLastSentAt: new Date(now),
          },
          select: { id: true, email: true },
        });

    // ---- Create verification code (replace old) ----
    const code = make6DigitCode();

    const verify = await prisma.$transaction(async (tx) => {
      await tx.emailVerificationCode.deleteMany({ where: { userId: user.id } });

      return tx.emailVerificationCode.create({
        data: {
          userId: user.id,
          email: emailLower,
          codeHash: hashCode(code),
          expiresAt: new Date(now + CODE_TTL_MIN * 60 * 1000),
        },
        select: { id: true },
      });
    });

    // ---- Send email best-effort (never fail signup) ----
    let emailSendFailed = false;
    try {
      await sendVerifyEmail(emailLower, code);
    } catch (err) {
      emailSendFailed = true;
      console.error('sendVerifyEmail failed', err);
    }

    return NextResponse.json({
      ok: true,
      needsEmailVerify: true,
      verifyId: verify.id,
      emailSendFailed,
    });
  } catch (e) {
    console.error('signup/complete error', e);
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}