//src/app/api/stripe/connect/onboard/route.ts
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { requireStepUp } from "@/lib/stepup";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

export async function POST(req: Request) {
  try {
    const stepup = await requireStepUp(req as NextRequest);
    if (!stepup.ok) return stepup.response;

    const { origin, locale } = await req.json().catch(() => ({ origin: null, locale: "en" }));

    const baseUrl =
      typeof origin === "string" && origin.startsWith("http")
        ? origin
        : process.env.NEXT_PUBLIC_APP_URL;

    if (!baseUrl) return NextResponse.json({ error: "Missing app url" }, { status: 500 });

    // ensure connect account exists
    const u = await prisma.user.findUnique({
      where: { id: stepup.userId },
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
      where: { id: stepup.userId },
      data: {
        stripeAccountId: acct.id,
        stripeDetailsSubmitted: Boolean(acct.details_submitted),
        stripePayoutsEnabled: Boolean(acct.payouts_enabled),
        stripeChargesEnabled: Boolean(acct.charges_enabled),
        stripeOnboardingLastAt: new Date(),
      },
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
      const err = e as Stripe.errors.StripeError;
    console.error("stripe connect onboard error:", {
      type: err?.type,
      code: err?.code,
      message: err?.message,
      requestId: err?.requestId,
      statusCode: err?.statusCode,
      raw: err?.raw,
    });

    return NextResponse.json(
      {
        error: "Stripe Onboarding fehlgeschlagen",
        stripeMessage: err?.message ?? null,
        stripeCode: err?.code ?? null,
        requestId: err?.requestId ?? null,
      },
      { status: 500 }
    );
  }
}
