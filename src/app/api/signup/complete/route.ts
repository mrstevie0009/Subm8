// src/app/api/signup/complete/route.ts
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { sendMail } from '@/lib/mailer';
import { make6DigitCode, hashCode } from '@/lib/emailVerify';

export const dynamic = 'force-dynamic';

type Body = {
  handle?: string;
  role?: string; // accept any string; we'll normalize
  email?: string;
  password?: string;

  // du sendest das bereits im Frontend, bisher ignoriert:
  dommeGiftDisclaimerAccepted?: boolean;
};

function isValidHandle(h: string) {
  return /^[a-z0-9_]{3,20}$/.test(h);
}
function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

const CODE_TTL_MIN = 10;

async function sendVerifyEmail(to: string, code: string) {
  await sendMail({
    to,
    subject: '✅ Verify your Subm8 email',
    text: `Your verification code is: ${code}\n\nThis code expires in ${CODE_TTL_MIN} minutes.`,
    html: `
      <div style="font-family:sans-serif;padding:16px">
        <h2>Verify your email</h2>
        <p>Your Subm8 verification code:</p>
        <div style="font-size:28px;letter-spacing:6px;font-weight:700;margin:12px 0">${code}</div>
        <p style="color:#666;font-size:14px">This code expires in ${CODE_TTL_MIN} minutes.</p>
      </div>
    `,
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;

    const handleRaw = (body?.handle ?? '').toString().toLowerCase();
    const roleRaw = (body?.role ?? '').toString();
    const emailRaw = (body?.email ?? '').toString().trim();
    const password = (body?.password ?? '').toString();

    const emailLower = emailRaw.toLowerCase();

    if (!isValidHandle(handleRaw)) {
      return Response.json({ ok: false, error: 'Invalid handle' }, { status: 400 });
    }
    if (!isValidEmail(emailLower)) {
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

    const dupEmail = await prisma.user.findUnique({ where: { email: emailLower }, select: { id: true } });
    if (dupEmail) {
      return Response.json({ ok: false, error: 'Email already in use' }, { status: 409 });
    }

    // hash & create
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        handle: handleRaw,
        displayName: handleRaw,
        role: dbRole,
        email: emailLower,
        passwordHash,
        nsfwDefault: false,

        // emailVerifiedAt bleibt NULL bis Code bestätigt wird
        emailVerifiedAt: null,
      },
      select: { id: true, email: true },
    });

    //Create verification code (delete older)
    const now = Date.now();
    const code = make6DigitCode();
    const verify = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerifyLastSentAt: new Date(now) },
    });

    await tx.emailVerificationCode.deleteMany({
      where: { userId: user.id },
    });

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

    // ✅ Send email (after DB write)
    await sendVerifyEmail(emailLower, code);

    // ✅ Response tells frontend to open modal (NO auto sign-in here)
    return Response.json({ ok: true, needsEmailVerify: true, verifyId: verify.id });
  } catch (e) {
    console.error('signup/complete error', e);
    return Response.json({ ok: false, error: 'Unexpected error' }, { status: 500 });
  }
}