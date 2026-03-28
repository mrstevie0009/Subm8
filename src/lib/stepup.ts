// src/lib/stepup.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { createHash, randomBytes } from "node:crypto";

const STEPUP_TTL_MS = 5 * 60 * 1000;        // Token gültig 5 min
const RATE_WINDOW_MS = 15 * 60 * 1000;      // Rate-limit Fenster
const MAX_ATTEMPTS = 5;                      // Versuche pro Fenster
const CLEANUP_OLDER_THAN_MS = 60 * 60 * 1000; // Alte Tokens nach 1h löschen

export type StepUpResult =
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse };

/**
 * Generiert ein neues Step-up Token nach erfolgreicher Passwort-Prüfung.
 * Gibt das Klartext-Token zurück (nur einmalig, an Client schicken).
 */
export async function createStepUpToken(userId: string): Promise<string> {
  // Alte Tokens des Users aufräumen (fire-and-forget)
  const cutoff = new Date(Date.now() - CLEANUP_OLDER_THAN_MS);
  prisma.stepUpChallenge
    .deleteMany({ where: { userId, createdAt: { lt: cutoff } } })
    .catch(() => {});

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await prisma.stepUpChallenge.create({
    data: { tokenHash, userId, verifiedAt: new Date() },
  });

  return rawToken;
}

/**
 * Middleware für sensitive API-Routes.
 * Liest x-stepup-token Header, prüft Gültigkeit + Single-Use.
 */
export async function requireStepUp(req: NextRequest): Promise<StepUpResult> {
  const me = await getCurrentUser();
  if (!me) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Not signed in", code: "UNAUTHENTICATED" },
        { status: 401 }
      ),
    };
  }

  const rawToken = req.headers.get("x-stepup-token") ?? "";
  if (!rawToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Step-up verification required", code: "STEPUP_REQUIRED" },
        { status: 403 }
      ),
    };
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const challenge = await prisma.stepUpChallenge.findUnique({
    where: { tokenHash },
    select: { userId: true, verifiedAt: true, usedAt: true },
  });

  // Nicht gefunden oder falscher User
  if (!challenge || challenge.userId !== me.id) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Invalid step-up token", code: "STEPUP_INVALID" },
        { status: 403 }
      ),
    };
  }

  // Bereits verbraucht (Single-use Schutz)
  if (challenge.usedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Step-up token already used", code: "STEPUP_USED" },
        { status: 403 }
      ),
    };
  }

  // TTL abgelaufen
  if (Date.now() - challenge.verifiedAt.getTime() > STEPUP_TTL_MS) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Step-up verification expired", code: "STEPUP_EXPIRED" },
        { status: 403 }
      ),
    };
  }

  // Token als verbraucht markieren – BEVOR die eigentliche Aktion läuft
  await prisma.stepUpChallenge.update({
    where: { tokenHash },
    data: { usedAt: new Date() },
  });

  return { ok: true, userId: me.id };
}

/**
 * Rate-limit Check für Step-up Versuche.
 * Gibt false zurück wenn zu viele Versuche.
 */
export async function checkStepUpRateLimit(userId: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_WINDOW_MS);
  const count = await prisma.stepUpAttempt.count({
    where: { userId, createdAt: { gte: windowStart } },
  });
  return count < MAX_ATTEMPTS;
}

export async function recordStepUpAttempt(userId: string): Promise<void> {
  await prisma.stepUpAttempt.create({ data: { userId } });
}