// src/app/api/cron/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function isVercelCron(req: NextRequest): boolean {
  return req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: NextRequest) {
  if (!isVercelCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // StepUpChallenge: älter als 1h löschen
  const challengeCutoff = new Date(now.getTime() - 60 * 60 * 1000);
  const deletedChallenges = await prisma.stepUpChallenge.deleteMany({
    where: { createdAt: { lt: challengeCutoff } },
  });

  // StepUpAttempt: älter als 24h löschen
  const attemptCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const deletedAttempts = await prisma.stepUpAttempt.deleteMany({
    where: { createdAt: { lt: attemptCutoff } },
  });

  // StripeEvent: älter als 30 Tage löschen
  const webhookCutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const deletedStripeEvents = await prisma.stripeEvent.deleteMany({
    where: { createdAt: { lt: webhookCutoff } },
  });

  console.log("cron/cleanup:", {
    deletedChallenges: deletedChallenges.count,
    deletedAttempts: deletedAttempts.count,
    deletedStripeEvents: deletedStripeEvents.count,
  });

  return NextResponse.json({
    ok: true,
    deletedChallenges: deletedChallenges.count,
    deletedAttempts: deletedAttempts.count,
    deletedStripeEvents: deletedStripeEvents.count,
  });
}