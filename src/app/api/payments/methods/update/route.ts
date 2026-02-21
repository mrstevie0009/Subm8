// src/app/api/payments/methods/update/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

type SetDefaultBody = { action: "set_default"; paymentMethodId: string };
type SetDefaultFromSetupBody = { action: "set_default_from_setup"; setupIntentId: string };
type DetachBody = { action: "detach"; paymentMethodId: string };
type Body = SetDefaultBody | SetDefaultFromSetupBody | DetachBody;

function isBody(x: unknown): x is Body {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  
  if (o.action === "set_default") {
    return typeof o.paymentMethodId === "string" && o.paymentMethodId.length > 0;
  }
  
  if (o.action === "set_default_from_setup") {
    return typeof o.setupIntentId === "string" && o.setupIntentId.length > 0;
  }
  
  if (o.action === "detach") {
    return typeof o.paymentMethodId === "string" && o.paymentMethodId.length > 0;
  }
  
  return false;
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const raw: unknown = await req.json().catch(() => null);
  if (!isBody(raw)) {
    return NextResponse.json({ ok: false, error: "Invalid body" }, { status: 400 });
  }

  const u = await prisma.user.findUnique({
    where: { id: me.id },
    select: { stripeCustomerId: true },
  });
  const customerId = u?.stripeCustomerId ?? null;
  if (!customerId) return NextResponse.json({ ok: false, error: "No stripeCustomerId" }, { status: 400 });

  // ✅ NEU: set_default_from_setup (nach SetupIntent)
  if (raw.action === "set_default_from_setup") {
    const si = await stripe.setupIntents.retrieve(raw.setupIntentId);

    if (si.status !== "succeeded") {
      return NextResponse.json({ ok: false, error: "SetupIntent not succeeded" }, { status: 400 });
    }

    const pmId = typeof si.payment_method === "string" ? si.payment_method : si.payment_method?.id ?? null;
    if (!pmId) {
      return NextResponse.json({ ok: false, error: "No payment method in SetupIntent" }, { status: 400 });
    }

    // Setze als Default
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: pmId },
    });

    return NextResponse.json({ ok: true });
  }

  // ✅ BESTEHEND: set_default (mit paymentMethodId)
  if (raw.action === "set_default") {
    const pm = await stripe.paymentMethods.retrieve(raw.paymentMethodId);
    const pmCustomer = typeof pm.customer === "string" ? pm.customer : pm.customer?.id ?? null;

    if (pmCustomer !== customerId) {
      return NextResponse.json(
        { ok: false, error: "Payment method not owned by customer" },
        { status: 403 }
      );
    }

    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: raw.paymentMethodId },
    });

    return NextResponse.json({ ok: true });
  }

  // ✅ BESTEHEND: detach
  if (raw.action === "detach") {
    const pm = await stripe.paymentMethods.retrieve(raw.paymentMethodId);
    const pmCustomer = typeof pm.customer === "string" ? pm.customer : pm.customer?.id ?? null;

    if (pmCustomer !== customerId) {
      return NextResponse.json(
        { ok: false, error: "Payment method not owned by customer" },
        { status: 403 }
      );
    }

    await stripe.paymentMethods.detach(raw.paymentMethodId);
    return NextResponse.json({ ok: true });
  }

  // Sollte nie erreicht werden (TypeScript guard)
  return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 });
}