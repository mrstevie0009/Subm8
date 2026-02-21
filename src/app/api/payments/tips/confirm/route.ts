// src/app/api/payments/tips/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type ConfirmBody = { paymentId?: string };

const TOPUP_PCT = 0.10;

type TipPaymentMeta = {
  baseAmountCents?: number;
};

function parseMeta(input: unknown): TipPaymentMeta {
  const out: TipPaymentMeta = {};
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;
  const bac = obj.baseAmountCents;
  if (typeof bac === "number" && Number.isFinite(bac)) out.baseAmountCents = Math.round(bac);
  return out;
}

// Base aus gross rekonstruieren (Fallback), sodass b + round(b*0.10) == gross
function inferBaseFromGross(gross: number): number {
  const approx = Math.round(gross / (1 + TOPUP_PCT));
  const start = Math.max(0, approx - 5);
  const end = approx + 5;
  for (let b = start; b <= end; b++) {
    const topup = Math.round(b * TOPUP_PCT);
    if (b + topup === gross) return b;
  }
  return approx;
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as ConfirmBody;
  const paymentId = String(body.paymentId || "");
  if (!paymentId) return NextResponse.json({ ok: false, error: "paymentId missing" }, { status: 400 });

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.payerId !== me.id) {
    return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
  }

  const meta = parseMeta(payment.metadataJson);

  // 1) Webhook hat finalisiert -> sofort ok
  if (payment.status === "SUCCEEDED") {
    const gross = payment.amountGrossCents;
    const base = meta.baseAmountCents ?? inferBaseFromGross(gross);
    return NextResponse.json({
      ok: true,
      baseAmountCents: base,
      totalCents: gross,
      currency: payment.currency,
    });
  }

  // 2) Terminal states -> klarer Fehler
  if (payment.status === "FAILED") {
    return NextResponse.json({ ok: false, error: "Payment failed" }, { status: 400 });
  }
  if (payment.status === "CANCELED") {
    return NextResponse.json({ ok: false, error: "Payment canceled" }, { status: 400 });
  }

  // 3) Noch nicht finalisiert: EINMAL Stripe-Status prüfen (ohne selbst zu finalisieren)
  const paymentIntentId = payment.externalRef;
  if (!paymentIntentId) {
    return NextResponse.json({ ok: false, error: "Missing Stripe reference (externalRef)" }, { status: 400 });
  }

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  // OPTIONAL: wenn Karte gespeichert werden soll -> setze default payment method
  if (pi.status === "succeeded") {
    const pm = typeof pi.payment_method === "string" ? pi.payment_method : null;
    const customer = typeof pi.customer === "string" ? pi.customer : null;

    // nur wenn im PI metadata flag gesetzt wurde
    const wantsSave = (pi.metadata?.saveForFuture ?? "0") === "1";

    if (wantsSave && pm && customer) {
      try {
        await stripe.customers.update(customer, {
          invoice_settings: { default_payment_method: pm },
        });
      } catch {
        // ignore: nicht blockieren
      }
    }
  }

  // Stripe sagt "failed/canceled" -> DB nachziehen (nur Status) und Fehler zurück
  if (pi.status === "canceled") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
    return NextResponse.json({ ok: false, error: "Payment canceled" }, { status: 400 });
  }

  if (pi.status === "requires_payment_method") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return NextResponse.json({ ok: false, error: "Payment failed" }, { status: 400 });
  }

  // Stripe sagt "succeeded", aber DB ist noch nicht SUCCEEDED:
  // -> Webhook soll finalisieren. Wir setzen DB auf PROCESSING (falls nicht schon),
  // -> UI soll kurz pollen.
  if (pi.status === "succeeded") {
    if (payment.status !== "PROCESSING") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "PROCESSING" } });
    }
    return NextResponse.json({
      ok: false,
      status: "PROCESSING",
      error: "Finalizing on webhook",
    });
  }

  // Alles andere: in Arbeit (requires_action / processing / requires_confirmation etc.)
  if (payment.status !== "PROCESSING") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PROCESSING" } });
  }

  return NextResponse.json({
    ok: false,
    status: pi.status,
    error: "Payment not completed yet",
  });
}
