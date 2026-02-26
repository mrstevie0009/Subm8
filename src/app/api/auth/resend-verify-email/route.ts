//src/app/api/auth/resend-verify-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { make6DigitCode, hashCode } from "@/lib/emailVerify";


const CODE_TTL_MIN = 10;
const purple = "#a259ff";
const brand = "Subm8";
const RESEND_COOLDOWN_SEC = 15;

async function sendVerifyEmail(to: string, code: string) {
await sendMail({
  to,
  subject: `✅ Verify your ${brand} email`,
  text: [
    `Verify your email for ${brand}`,
    ``,
    `Your verification code: ${code}`,
    `This code expires in ${CODE_TTL_MIN} minutes.`,
    ``,
    `If you didn’t request this, you can ignore this email.`,
  ].join("\n"),
  html: `
  <div style="margin:0;padding:0;background:#07070a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07070a;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.03);">
            <tr>
              <td style="padding:22px 22px 14px 22px;">
                <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;color:#ffffff;">
                  <div style="font-size:14px;color:rgba(255,255,255,0.72);margin-bottom:10px;">
                    ${brand} · Email verification
                  </div>

                  <div style="font-size:24px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;margin:0 0 10px 0;">
                    Verify your email
                  </div>

                  <div style="font-size:14px;line-height:1.5;color:rgba(255,255,255,0.80);margin:0 0 14px 0;">
                    Enter this 6-digit code to confirm your email address.
                  </div>

                  <div style="margin:16px 0 14px 0;padding:14px 14px;border-radius:16px;background:rgba(162,89,255,0.12);border:1px solid rgba(162,89,255,0.35);">
                    <div style="font-size:12px;color:rgba(255,255,255,0.75);margin-bottom:8px;">
                      Your verification code
                    </div>
                    <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
                                font-size:30px;font-weight:800;letter-spacing:0.35em;
                                color:#ffffff;text-align:center;">
                      ${code}
                    </div>
                  </div>

                  <div style="font-size:12px;color:rgba(255,255,255,0.60);line-height:1.5;">
                    Expires in ${CODE_TTL_MIN} minutes.
                    <span style="color:rgba(255,255,255,0.35);"> · </span>
                    If you didn’t request this, you can safely ignore this email.
                  </div>

                  <div style="margin-top:18px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.08);
                              font-size:12px;color:rgba(255,255,255,0.45);line-height:1.5;">
                    © ${new Date().getFullYear()} ${brand}.
                    <span style="color:${purple};">Stay safe.</span>
                  </div>
                </div>
              </td>
            </tr>
          </table>

          <div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
                      font-size:11px;color:rgba(255,255,255,0.35);margin-top:10px;">
            This is an automated message. Please do not reply.
          </div>
        </td>
      </tr>
    </table>
  </div>
  `,
});
}

export async function POST(req: Request) {
  type ResendBody = { email?: string; locale?: string };

  const body: ResendBody = await req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();

  if (!email) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerifiedAt: true, emailVerifyLastSentAt: true },
  });

  if (!user) {
    return NextResponse.json({ ok: true });
  }

  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true });
  }

    if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true });
  }

    const last = user.emailVerifyLastSentAt?.getTime() ?? 0;
    const now = Date.now();
    const minNext = last + RESEND_COOLDOWN_SEC * 1000;

    if (last && now < minNext) {
    const retryAfterSec = Math.ceil((minNext - now) / 1000);
    return NextResponse.json(
        { ok: false, cooldown: true, retryAfterSec },
        { status: 429 }
    );
    }

    const code = make6DigitCode();

    const created = await prisma.$transaction(async (tx) => {
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
        email,
        codeHash: hashCode(code),
        expiresAt: new Date(now + CODE_TTL_MIN * 60 * 1000),
        },
        select: { id: true },
    });
    });

  await sendVerifyEmail(email, code);

  return NextResponse.json({ ok: true, verifyId: created.id });
}