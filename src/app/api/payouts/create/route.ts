import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});
const HOLD_DAYS = 30;

type Body = { amountCents?: number };

function cutoffDate() {
  const d = new Date();
  d.setDate(d.getDate() - HOLD_DAYS);
  return d;
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const raw = (await req.json().catch(() => ({}))) as Body;
  const amountCents = Math.round(Number(raw.amountCents || 0));

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid amount" }, { status: 400 });
  }

  const u = await prisma.user.findUnique({
    where: { id: me.id },
    select: { stripeAccountId: true, payoutMethod: true },
  });

  const accountId = u?.stripeAccountId ?? null;
  if (!accountId) return NextResponse.json({ ok: false, error: "No connected account" }, { status: 400 });

  const acct = await stripe.accounts.retrieve(accountId);
  if (!acct.details_submitted || !acct.payouts_enabled) {
    return NextResponse.json({ ok: false, error: "Onboarding incomplete (payouts not enabled)" }, { status: 409 });
  }

  const unlockedBefore = cutoffDate();

  const eligiblePayments = await prisma.payment.findMany({
    where: {
      payeeId: me.id,
      status: "SUCCEEDED",
      payoutRequestId: null,
      createdAt: { lte: unlockedBefore },
      currency: "EUR",
    },
    select: {
      id: true,
      amountNetToDommeCents: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const unlockedCents = eligiblePayments.reduce(
    (sum, p) => sum + (p.amountNetToDommeCents || 0),
    0
  );

  if (unlockedCents <= 0) {
    return NextResponse.json(
      { ok: false, error: "No unlocked balance. Earnings unlock after 30 days." },
      { status: 400 }
    );
  }

  // Ohne neue DB-Tabelle keine sauberen Partial-Payouts.
  if (amountCents !== unlockedCents) {
    return NextResponse.json(
      {
        ok: false,
        error: "Only full unlocked balance payout is supported.",
        unlockedCents,
      },
      { status: 400 }
    );
  }

  // Optionaler Stripe-Sanity-Check: Connected Account muss den Betrag wirklich verfügbar haben.
  const bal = await stripe.balance.retrieve({}, { stripeAccount: accountId });
  const eur = bal.available.find((x) => x.currency.toLowerCase() === "eur");
  const stripeAvailable = eur?.amount ?? 0;

  if (amountCents > stripeAvailable) {
    return NextResponse.json(
      {
        ok: false,
        error: "Stripe balance is not available yet.",
        unlockedCents,
        stripeAvailableCents: stripeAvailable,
      },
      { status: 400 }
    );
  }

  const payoutRequest = await prisma.payoutRequest.create({
    data: {
      userId: me.id,
      amountCents,
      currency: "EUR",
      method: "STRIPE_CONNECT",
      destination: accountId,
      requestedCents: amountCents,
      feeCents: 0,
      payoutCents: amountCents,
      feePayer: "USER",
      status: "PROCESSING",
    },
    select: { id: true },
  });

  try {
    const payout = await stripe.payouts.create(
      {
        amount: amountCents,
        currency: "eur",
        method: "standard",
        metadata: {
          userId: me.id,
          kind: "creator_payout",
          payoutRequestId: payoutRequest.id,
        },
      },
      { stripeAccount: accountId }
    );

    await prisma.$transaction([
      prisma.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: {
          stripePayoutId: payout.id,
          stripePayoutStatus: payout.status ?? null,
        },
      }),
      prisma.payment.updateMany({
        where: { id: { in: eligiblePayments.map((p) => p.id) } },
        data: { payoutRequestId: payoutRequest.id },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      payoutRequestId: payoutRequest.id,
      payoutId: payout.id,
      status: payout.status,
    });
  } catch (e) {
    await prisma.payoutRequest.update({
      where: { id: payoutRequest.id },
      data: {
        status: "FAILED",
        failedReason: e instanceof Error ? e.message.slice(0, 500) : "Stripe payout failed",
      },
    });

    return NextResponse.json({ ok: false, error: "Payout failed" }, { status: 500 });
  }
}