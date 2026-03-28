// src/app/api/auth/stepup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";      // dein bestehender Helper
import { isBlocked, recordFailure, recordSuccess } from "@/lib/bruteforce"; // dein bestehender Guard
import { getClientIp } from "@/lib/ip";               // dein bestehender Helper
import {
  checkStepUpRateLimit,
  recordStepUpAttempt,
  createStepUpToken,
} from "@/lib/stepup";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "Not signed in", code: "UNAUTHENTICATED" },
      { status: 401 }
    );
  }

  // 1. Step-up-eigenes Rate-Limit (unabhängig vom Login-Brute-Force)
  const withinLimit = await checkStepUpRateLimit(me.id);
  if (!withinLimit) {
    return NextResponse.json(
      { ok: false, error: "Too many verification attempts. Try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  // 2. Body lesen
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";

  if (!password) {
    return NextResponse.json(
      { ok: false, error: "Password required", code: "MISSING_PASSWORD" },
      { status: 400 }
    );
  }

  // 3. Attempt loggen (vor der Prüfung, damit Rate-limit auch bei Fehler greift)
  await recordStepUpAttempt(me.id);

  // 4. Brute-Force-Schutz über deine bestehende IP-basierte Logik wiederverwenden
  const ip = await getClientIp();
  const block = await isBlocked(ip, me.id);
  if (!block.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many failed attempts. Try again later.", code: "IP_BLOCKED" },
      { status: 429 }
    );
  }

  // 5. Passwort aus DB laden
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { passwordHash: true, isDeactivated: true },
  });

  if (!user || user.isDeactivated) {
    return NextResponse.json(
      { ok: false, error: "Account not available", code: "ACCOUNT_UNAVAILABLE" },
      { status: 403 }
    );
  }

  if (!user.passwordHash) {
    // Google-only User – kann kein Passwort verifizieren
    return NextResponse.json(
      { ok: false, error: "Password verification not available for this account", code: "NO_PASSWORD" },
      { status: 400 }
    );
  }

  // 6. Passwort prüfen
  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    void recordFailure(ip, me.id).catch(() => {});
    return NextResponse.json(
      { ok: false, error: "Incorrect password", code: "WRONG_PASSWORD" },
      { status: 403 }
    );
  }

  // 7. Erfolg – Brute-Force-Counter zurücksetzen, Token ausstellen
  void recordSuccess(ip, me.id).catch(() => {});

  const token = await createStepUpToken(me.id);

  return NextResponse.json({ ok: true, token });
}