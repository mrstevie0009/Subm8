// src/app/api/payouts/status/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

type Money = { amountCents: number; currency: string };

type StripeBalanceItem = {
  amount: number;
  currency: string;
};

function pickPreferred(arr: StripeBalanceItem[] | null | undefined): StripeBalanceItem | null {
  if (!arr || arr.length === 0) return null;
  const eur = arr.find((x) => (x.currency || "").toLowerCase() === "eur");
  return eur ?? arr[0] ?? null;
}

function toMoney(a: StripeBalanceItem | null): Money {
  return {
    amountCents: a?.amount ?? 0,
    currency: (a?.currency ?? "eur").toUpperCase(),
  };
}

export async function GET() {
  try {
    const me = await getCurrentUser().catch(() => null);
    if (!me) {
      return NextResponse.json({
        available: { amountCents: 0, currency: "EUR" },
        pending: { amountCents: 0, currency: "EUR" },
      });
    }

    const u = await prisma.user.findUnique({
      where: { id: me.id },
      select: { stripeAccountId: true },
    });

    const accountId = u?.stripeAccountId ?? null;
    if (!accountId) {
      return NextResponse.json({
        available: { amountCents: 0, currency: "EUR" },
        pending: { amountCents: 0, currency: "EUR" },
      });
    }

    try {
      const bal = await stripe.balance.retrieve({}, { stripeAccount: accountId });

      // bal.available / bal.pending exist on Stripe's response;
      // cast to our minimal shape to avoid version-specific Stripe TS types.
      const availablePick = pickPreferred(bal.available as unknown as StripeBalanceItem[]);
      const pendingPick = pickPreferred(bal.pending as unknown as StripeBalanceItem[]);

      return NextResponse.json({
        available: toMoney(availablePick),
        pending: toMoney(pendingPick),
      });
    } catch {
      return NextResponse.json({
        available: { amountCents: 0, currency: "EUR" },
        pending: { amountCents: 0, currency: "EUR" },
      });
    }
  } catch {
    return NextResponse.json({
      available: { amountCents: 0, currency: "EUR" },
      pending: { amountCents: 0, currency: "EUR" },
    });
  }
}
