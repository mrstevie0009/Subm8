//src/app/api/auth/verify-email/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashCode } from "@/lib/emailVerify";
import crypto from "crypto";

const MAX_ATTEMPTS = 6;

export async function POST(req: Request) {
    type VerifyBody = { verifyId?: string; email?: string; code?: string };

    const body: VerifyBody = await req.json().catch(() => ({}));
    const verifyId = String(body.verifyId || "");
    const email = String(body.email || "").toLowerCase();
    const code = String(body.code || "").trim();

    if (!verifyId || !email || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
    }

    const row = await prisma.emailVerificationCode.findUnique({ where: { id: verifyId } });
    if (!row || row.email !== email) {
    return NextResponse.json({ ok: false, error: "Invalid code" }, { status: 400 });
    }

    if (row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Code expired" }, { status: 400 });
    }

    if (row.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json({ ok: false, error: "Too many attempts" }, { status: 429 });
    }

    const candidateHash = hashCode(code);

    // ✅ timing-safe compare (paranoid-sauber)
    const a = Buffer.from(row.codeHash, "hex");
    const b = Buffer.from(candidateHash, "hex");
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

    await prisma.emailVerificationCode.update({
    where: { id: row.id },
    data: { attempts: { increment: 1 } },
    });

    if (!ok) {
    return NextResponse.json({ ok: false, error: "Wrong code" }, { status: 400 });
    }

    await prisma.$transaction([
    prisma.user.update({
    where: { id: row.userId },
    data: { emailVerifiedAt: new Date() },
    }),
    prisma.emailVerificationCode.deleteMany({ where: { userId: row.userId } }),
    ]);

    return NextResponse.json({ ok: true });
}