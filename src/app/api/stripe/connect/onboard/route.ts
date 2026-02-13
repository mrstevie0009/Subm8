//src/app/api/stripe/connect/onboard/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser().catch(() => null);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { origin, locale } = await req.json().catch(() => ({ origin: null, locale: "en" }));
    const baseUrl =
      typeof origin === "string" && origin.startsWith("http")
        ? origin
        : process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) return NextResponse.json({ error: "Missing app url" }, { status: 500 });

    // ensure connect account exists
    const u = await prisma.user.findUnique({
      where: { id: me.id },
      select: { stripeAccountId: true, email: true },
    });

    let accountId = u?.stripeAccountId ?? null;

    if (!accountId) {
      const acct = await stripe.accounts.create({
        type: "express",
        email: u?.email ?? undefined,
        capabilities: {
          transfers: { requested: true },
        },
        // optional: country: "AT"
      });

      accountId = acct.id;
      await prisma.user.update({
        where: { id: me.id },
        data: { stripeAccountId: accountId },
      });
    }

    const refreshUrl = `${baseUrl}/${locale}/settings/payments?stripe=refresh`;
    const returnUrl = `${baseUrl}/${locale}/settings/payments?stripe=return`;

    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: link.url, accountId });
  } catch (e) {
    console.error("stripe connect onboard error:", e);
    return NextResponse.json({ error: "Stripe Onboarding fehlgeschlagen" }, { status: 500 });
  }
}
