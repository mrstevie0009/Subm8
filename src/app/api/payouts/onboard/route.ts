import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST(req: Request) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const url = new URL(req.url);
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${url.protocol}//${url.host}`;

  // Optional: nur Dommes erlauben (passe role-check an dein Schema an)
  const meDb = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, email: true, stripeAccountId: true, role: true },
  });
  if (!meDb) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  // Wenn du strict sein willst:
  // if (String(meDb.role).toUpperCase() !== "DOMME") {
  //   return NextResponse.json({ ok: false, error: "Only dommes can onboard payouts" }, { status: 403 });
  // }

  let accountId = meDb.stripeAccountId;

  if (!accountId) {
    const acct = await stripe.accounts.create({
      type: "express",
      email: meDb.email ?? undefined,
      metadata: { userId: meDb.id, kind: "domme_payouts" },

      // Manual payouts erlauben (damit Domme “Auszahlen” klickt)
      settings: {
        payouts: {
          schedule: { interval: "manual" },
        },
      },

      // Für Transfers & Payouts ist i.d.R. "transfers" die Capability.
      capabilities: {
        transfers: { requested: true },
      },
    });

    accountId = acct.id;

    await prisma.user.update({
      where: { id: meDb.id },
      data: { stripeAccountId: accountId },
    });
  }

  // Account Link (Onboarding)
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${appOrigin}/settings/payments?onboard=refresh`,
    return_url: `${appOrigin}/settings/payments?onboard=done`,
  });

  return NextResponse.json({ ok: true, url: accountLink.url, accountId });
}
