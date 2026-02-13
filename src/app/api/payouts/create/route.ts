//src/app/api/payouts/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

type Body = { amountCents?: number };

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
    select: { stripeAccountId: true },
  });
  const accountId = u?.stripeAccountId ?? null;
  if (!accountId) return NextResponse.json({ ok: false, error: "No connected account" }, { status: 400 });

  const acct = await stripe.accounts.retrieve(accountId);
  if (!acct.details_submitted || !acct.payouts_enabled) {
    return NextResponse.json({ ok: false, error: "Onboarding incomplete (payouts not enabled)" }, { status: 409 });
  }

  // Check available balance
  const bal = await stripe.balance.retrieve({}, { stripeAccount: accountId });
  const eur = bal.available.find((x) => x.currency.toLowerCase() === "eur");
  const first = eur ?? bal.available[0];
  const available = first?.amount ?? 0;
  const currency = (first?.currency ?? "eur").toLowerCase();

  if (currency !== "eur") {
    return NextResponse.json({ ok: false, error: `Unsupported currency: ${currency}` }, { status: 400 });
  }
  if (amountCents > available) {
    return NextResponse.json({ ok: false, error: "Insufficient available balance" }, { status: 400 });
  }

  // Create payout (manual payout flow) :contentReference[oaicite:2]{index=2}
  const payout = await stripe.payouts.create(
    {
      amount: amountCents,
      currency,
      method: "standard",
      metadata: { userId: me.id, kind: "creator_payout" },
    },
    { stripeAccount: accountId }
  );

  return NextResponse.json({
    ok: true,
    payoutId: payout.id,
    status: payout.status,
  });
}
