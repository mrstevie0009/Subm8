// src/app/api/payments/tips/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { getClientIp } from "@/lib/ip";
import { rateLimit } from "@/lib/rateLimitStore";

// Betrags-Grenzen (in Cent). Passe die Obergrenze an dein Risikoprofil an.
const MIN_TIP_CENTS = 100;       // 1,00 €
const MAX_TIP_CENTS = 50_000;   // 500,00 €

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

const CURRENCY = "eur";
const DB_CURRENCY = "EUR";
const TOPUP_PCT = 0.10;
const SPLIT_PCT = 0.10;

type CreateBody = {
  toUserId?: string;
  amountCents?: number;
  note?: string;
  conversationId?: string;
  saveForFuture?: boolean;
};

type MeCustomer = {
  id: string;
  email: string | null;
  stripeCustomerId: string | null;
};

async function loadMeCustomer(meId: string): Promise<MeCustomer> {
  const u = await prisma.user.findUnique({
    where: { id: meId },
    select: { id: true, email: true, stripeCustomerId: true },
  });
  if (!u) throw new Error("User not found");
  return { id: u.id, email: u.email ?? null, stripeCustomerId: u.stripeCustomerId ?? null };
}

async function ensureStripeCustomer(me: MeCustomer): Promise<string> {
  if (me.stripeCustomerId) return me.stripeCustomerId;

  const customer = await stripe.customers.create({
    email: me.email ?? undefined,
    metadata: { userId: me.id },
  });

  await prisma.user.update({
    where: { id: me.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// src/app/api/payments/tips/create/route.ts
export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  // ✅ Rate-Limit: max. 20 Tip-Intents pro 10 min pro User (+IP)
  const ip = await getClientIp();
  const gate = await rateLimit(`tip:${me.id}:${ip}`, 20, 10 * 60 * 1000);
  if (!gate.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many payment attempts. Please slow down." },
      { status: 429, headers: { "Retry-After": String(gate.retryAfterSec) } }
    );
  }

  const body = (await req.json().catch(() => ({}))) as CreateBody;

  const toUserId = String(body.toUserId || "");
  const baseAmountCents = Math.round(Number(body.amountCents || 0));
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : undefined;
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;

  if (!toUserId || !Number.isFinite(baseAmountCents) || baseAmountCents <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  //Betrags-Cap: verhindert 0-Cent-Spam und absurd hohe/fehlerhafte Beträge
  if (baseAmountCents < MIN_TIP_CENTS || baseAmountCents > MAX_TIP_CENTS) {
    return NextResponse.json(
      { ok: false, error: `Amount must be between ${MIN_TIP_CENTS} and ${MAX_TIP_CENTS} cents` },
      { status: 400 }
    );
  }

  //Selbst-Tipping verhindern (spart Stripe-Fees + Missbrauch)
  if (toUserId === me.id) {
    return NextResponse.json({ ok: false, error: "Cannot tip yourself" }, { status: 400 });
  }

  const payee = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true },
  });
  if (!payee) return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });

  const topupCents = Math.round(baseAmountCents * TOPUP_PCT);
  const splitCents = Math.round(baseAmountCents * SPLIT_PCT);
  const grossCents = baseAmountCents + topupCents;
  const amountNetToDommeCents = baseAmountCents - splitCents;
  const platformFeeCents = topupCents + splitCents;

  const id = randomUUID();

  const metadataJson = {
    baseAmountCents,
    note: note ?? null,
    conversationId: conversationId ?? null,
  };

  await prisma.payment.create({
    data: {
      id,
      payerId: me.id,
      payeeId: payee.id,
      amountGrossCents: grossCents,
      amountNetToDommeCents,
      platformFeeCents,
      processorFeeCents: 0,
      vatAmountCents: 0,
      currency: DB_CURRENCY,
      status: "CREATED",
      externalRef: null,
      paymentProvider: "Stripe",
      metadataJson,
    },
  });

  const meDb = await loadMeCustomer(me.id);
  const customerId = await ensureStripeCustomer(meDb);

  async function syncStripeCustomerEmail(customerId: string, email: string | null) {
    const e = (email || "").trim();
    if (!e) return null;
    await stripe.customers.update(customerId, { email: e }).catch(() => {});
    return e;
  }

  const receiptEmail = await syncStripeCustomerEmail(customerId, meDb.email);

  // ✅ NEU: Hole den Default Payment Method vom Customer
  const customer = await stripe.customers.retrieve(customerId);
  const defaultPmId = 
    typeof customer !== 'object' || customer.deleted
      ? null
      : typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id ?? null;

  const cs = await stripe.customerSessions.create({
    customer: customerId,
    components: {
      payment_element: { 
        enabled: true,
        features: {
          payment_method_save: 'enabled', 
          payment_method_remove: 'enabled', 
          payment_method_redisplay: 'enabled', //Zeigt gespeicherte Karten
        },
      },
    },
  });

  // Wenn Default Payment Method existiert, setze ihn im PaymentIntent
  const piParams: Stripe.PaymentIntentCreateParams = {
    amount: grossCents,
    currency: CURRENCY,
    customer: customerId,
    payment_method_types: ["card"],
    setup_future_usage: "off_session",
    receipt_email: receiptEmail ?? undefined,
    metadata: {
      paymentId: id,
      payerId: me.id,
      payeeId: payee.id,
      kind: "tip",
      saveForFuture: "1",
    },
  };

  // ✅ NEU: Wenn Default Payment Method existiert, verwende ihn
  if (defaultPmId) {
    piParams.payment_method = defaultPmId;
  }

  const pi = await stripe.paymentIntents.create(piParams);

  await prisma.payment.update({
    where: { id },
    data: { externalRef: pi.id, status: "PROCESSING" },
  });

  return NextResponse.json({
    ok: true,
    paymentId: id,
    currency: DB_CURRENCY,
    baseAmountCents,
    totalCents: grossCents,
    clientSecret: pi.client_secret,
    customerSessionClientSecret: cs.client_secret,
  });
}
