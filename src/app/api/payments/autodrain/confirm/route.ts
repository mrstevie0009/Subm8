// src/app/api/payments/autodrain/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

type Body = { autoDrainId?: string };

function readSaveForFutureFromMetadata(meta: Stripe.Metadata | null | undefined): boolean {
  const v = meta?.saveForFuture ?? "0";
  return v === "1" || v === "true";
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}

function getStringProp(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  return typeof v === "string" ? v : null;
}

function extractPaymentMethodFromSubscription(sub: Stripe.Subscription): string | null {
  // 1) subscription.default_payment_method (string | PaymentMethod | null)
  const dpm = sub.default_payment_method;
  if (typeof dpm === "string") return dpm;
  if (dpm && typeof dpm !== "string") {
    return dpm.id ?? null;
  }

  // 2) fallback: latest_invoice.payment_intent.payment_method (expanded)
  const li = sub.latest_invoice;

  // stripe typings in some versions don't expose invoice.payment_intent,
  // but the API returns it when expanded; so read it via unknown-record.
  if (li && typeof li !== "string") {
    const liU: unknown = li;
    if (isRecord(liU)) {
      const piU = liU["payment_intent"];

      // payment_intent could be string or object
      if (typeof piU === "string") return null;
      if (piU && isRecord(piU)) {
        const pmU = piU["payment_method"];

        if (typeof pmU === "string") return pmU;
        if (pmU && isRecord(pmU)) return getStringProp(pmU, "id");
      }
    }
  }

  return null;
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const autoDrainId = String(body.autoDrainId || "");
  if (!autoDrainId) return NextResponse.json({ ok: false, error: "Missing autoDrainId" }, { status: 400 });

  const ad = await prisma.autoDrainSubscription.findUnique({
    where: { id: autoDrainId },
    select: { id: true, subId: true, stripeSubscriptionId: true, active: true, stripeCustomerId: true },
  });
  if (!ad) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (ad.subId !== me.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!ad.stripeSubscriptionId) return NextResponse.json({ ok: false, error: "No stripeSubscriptionId" }, { status: 400 });

  const sub = await stripe.subscriptions.retrieve(ad.stripeSubscriptionId, {
    expand: ["latest_invoice.payment_intent", "default_payment_method"],
  });

  const okActive = sub.status === "active" || sub.status === "trialing";
  if (!okActive) {
    return NextResponse.json({ ok: false, error: "Subscription not active yet", status: sub.status }, { status: 409 });
  }

  // ✅ If user opted-in: enforce "default payment method" like TipModal confirm does.
  const wantsSave = readSaveForFutureFromMetadata(sub.metadata);
  if (wantsSave) {
    const pmId = extractPaymentMethodFromSubscription(sub);
    const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id ?? null;

    if (pmId && customerId) {
      try {
        await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: pmId } });
      } catch {
        // ignore (do not block activation)
      }
    }
  }

  // DB active
  await prisma.autoDrainSubscription.update({
    where: { id: ad.id },
    data: { active: true, stripeStatus: sub.status },
  });

  return NextResponse.json({ ok: true, autoDrainId: ad.id, status: sub.status });
}