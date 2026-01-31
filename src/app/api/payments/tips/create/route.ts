// src/app/api/payments/tips/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { randomUUID } from "node:crypto";
import Stripe from "stripe";

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

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;

  const toUserId = String(body.toUserId || "");
  const baseAmountCents = Math.round(Number(body.amountCents || 0));
  const note = typeof body.note === "string" ? body.note.slice(0, 200) : undefined;
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;

  if (!toUserId || !Number.isFinite(baseAmountCents) || baseAmountCents <= 0) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
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

  const cs = await stripe.customerSessions.create({
    customer: customerId,
    components: {
      payment_element: { enabled: true },
    },
  });

  const pi = await stripe.paymentIntents.create({
    amount: grossCents,
    currency: CURRENCY,
    customer: customerId,
    payment_method_types: ["card"],
    metadata: {
      paymentId: id,
      payerId: me.id,
      payeeId: payee.id,
      kind: "tip",
    },
  });

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
