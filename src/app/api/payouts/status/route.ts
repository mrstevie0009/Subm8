//src/app/api/payouts/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

export const runtime = "nodejs";

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

export async function GET() {
  const me = await getCurrentUser().catch(() => null);

  if (!me) {
    return NextResponse.json({
      available: { amountCents: 0, currency: "EUR" },
      pending: { amountCents: 0, currency: "EUR" },
    });
  }

  const cutoff = cutoffDate();

  const payments = await prisma.payment.findMany({
    where: {
      payeeId: me.id,
      status: "SUCCEEDED",
      payoutRequestId: null,
      currency: "EUR",
    },
    select: {
      amountNetToDommeCents: true,
      createdAt: true,
      currency: true,
    },
  });

  const availableCents = payments
    .filter((p) => p.createdAt <= cutoff)
    .reduce((sum, p) => sum + (p.amountNetToDommeCents || 0), 0);

  const pendingCents = payments
    .filter((p) => p.createdAt > cutoff)
    .reduce((sum, p) => sum + (p.amountNetToDommeCents || 0), 0);

  return NextResponse.json({
    available: { amountCents: availableCents, currency: "EUR" },
    pending: { amountCents: pendingCents, currency: "EUR" },
  });
}