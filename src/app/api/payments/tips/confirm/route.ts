// src/app/api/payments/tips/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// ── In-Memory Rate-Limit: max 20 Requests pro userId+paymentId pro Minute ──
const CONFIRM_RATE_WINDOW_MS = 60_000;
const CONFIRM_RATE_MAX = 20;
const confirmHits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (confirmHits.get(key) ?? []).filter((t) => now - t < CONFIRM_RATE_WINDOW_MS);
  hits.push(now);
  confirmHits.set(key, hits);
  if (Math.random() < 0.01) {
    for (const [k, v] of confirmHits) {
      if (v.every((t) => now - t > CONFIRM_RATE_WINDOW_MS)) confirmHits.delete(k);
    }
  }
  return hits.length > CONFIRM_RATE_MAX;
}

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

  // ── Rate-Limit ──
  if (isRateLimited(`${me.id}:${paymentId}`)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.payerId !== me.id) {
    return NextResponse.json({ ok: false, error: "Payment not found" }, { status: 404 });
  }

  const meta = parseMeta(payment.metadataJson);

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

  if (payment.status === "FAILED") {
    return NextResponse.json({ ok: false, status: "FAILED", error: "Payment failed" }, { status: 400 });
  }
  if (payment.status === "CANCELED") {
    return NextResponse.json({ ok: false, status: "CANCELED", error: "Payment canceled" }, { status: 400 });
  }

  const paymentIntentId = payment.externalRef;
  if (!paymentIntentId) {
    return NextResponse.json({ ok: false, error: "Missing Stripe reference (externalRef)" }, { status: 400 });
  }

  const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

  if (pi.status === "succeeded") {
    const pm = typeof pi.payment_method === "string" ? pi.payment_method : null;
    const customer = typeof pi.customer === "string" ? pi.customer : null;
    const wantsSave = (pi.metadata?.saveForFuture ?? "0") === "1";

    if (wantsSave && pm && customer) {
      try {
        await stripe.customers.update(customer, {
          invoice_settings: { default_payment_method: pm },
        });
      } catch {
        // ignore
      }
    }
  }

  if (pi.status === "canceled") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
    return NextResponse.json({ ok: false, error: "Payment canceled" }, { status: 400 });
  }

  if (pi.status === "requires_payment_method") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    return NextResponse.json({ ok: false, error: "Payment failed" }, { status: 400 });
  }

  if (pi.status === "succeeded") {
    if (payment.status !== "PROCESSING") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "PROCESSING" } });
    }
    return NextResponse.json({ ok: false, status: "PROCESSING", error: "Finalizing on webhook" });
  }

  if (payment.status !== "PROCESSING") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "PROCESSING" } });
  }

  return NextResponse.json({ ok: false, status: pi.status, error: "Payment not completed yet" });
}