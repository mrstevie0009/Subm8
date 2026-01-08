import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function GET() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const u = await prisma.user.findUnique({
    where: { id: me.id },
    select: { stripeAccountId: true },
  });

  const accountId = u?.stripeAccountId ?? null;
  if (!accountId) {
    return NextResponse.json({
      ok: true,
      hasAccount: false,
      onboardingComplete: false,
      payoutsEnabled: false,
      available: { amountCents: 0, currency: "EUR" },
    });
  }

  const acct = await stripe.accounts.retrieve(accountId);

  // balance des connected accounts
  const bal = await stripe.balance.retrieve(
    {},
    { stripeAccount: accountId }
  );

  // “available” kann mehrere currencies enthalten – wir nehmen EUR wenn vorhanden
  const eur = bal.available.find((x) => x.currency.toLowerCase() === "eur");
  const first = eur ?? bal.available[0];

  return NextResponse.json({
    ok: true,
    hasAccount: true,
    onboardingComplete: !!acct.details_submitted,
    payoutsEnabled: !!acct.payouts_enabled,
    requirementsDue: (acct.requirements?.currently_due ?? []).slice(0, 20),
    available: {
      amountCents: first?.amount ?? 0,
      currency: (first?.currency ?? "eur").toUpperCase(),
    },
  });
}
