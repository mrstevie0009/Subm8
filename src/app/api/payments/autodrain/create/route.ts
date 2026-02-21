// src/app/api/payments/autodrain/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { addCadence } from "@/lib/autodrain";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

// Platform Fee
const PLATFORM_FEE_BPS_TOPUP = 1000; // 10% on top

type Body = {
  toUserId?: string;
  amountCents?: number;
  currency?: string;
  cadence?: "DAILY" | "WEEKLY" | "MONTHLY";
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

function cadenceToStripeInterval(c: "DAILY" | "WEEKLY" | "MONTHLY"): "day" | "week" | "month" {
  if (c === "DAILY") return "day";
  if (c === "WEEKLY") return "week";
  return "month";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object";
}
function getStringProp(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  return typeof v === "string" ? v : null;
}

function getInvoiceIdFromSub(sub: Stripe.Subscription): string | null {
  const li = sub.latest_invoice;
  return typeof li === "string" ? li : li?.id ?? null;
}

function getPendingSetupIntentClientSecret(sub: Stripe.Subscription): string | null {
  const psi = sub.pending_setup_intent;
  if (!psi) return null;
  if (typeof psi === "string") return null;
  return psi.client_secret ?? null;
}

function getInvoiceMeta(inv: Stripe.Invoice): {
  invoiceId: string;
  invoiceStatus: Stripe.Invoice.Status | null;
  collectionMethod: Stripe.Invoice.CollectionMethod | null;
  paymentIntentId: string | null;
  paymentIntentExpanded: Stripe.PaymentIntent | null;
} {
  const invoiceId = inv.id;
  const invoiceStatus = inv.status ?? null;
  const collectionMethod = inv.collection_method ?? null;

  let paymentIntentId: string | null = null;
  let paymentIntentExpanded: Stripe.PaymentIntent | null = null;

  const raw: unknown = inv as unknown;
  if (isRecord(raw)) {
    const pi = raw["payment_intent"];

    if (typeof pi === "string") {
      paymentIntentId = pi;
    } else if (isRecord(pi)) {
      const id = getStringProp(pi, "id");
      paymentIntentId = id;
      paymentIntentExpanded = id ? (pi as unknown as Stripe.PaymentIntent) : null;
    }
  }

  return { invoiceId, invoiceStatus, collectionMethod, paymentIntentId, paymentIntentExpanded };
}

async function resolveClientSecretForSubscription(
  subId: string
): Promise<{
  clientSecret: string | null;
  kind: "payment_intent" | "setup_intent" | null;
  debug: {
    subStatus?: Stripe.Subscription.Status;
    hasPendingSetupIntent?: boolean;
    pendingSetupIntentId?: string | null;
    invoiceId?: string | null;
    invoiceStatus?: Stripe.Invoice.Status | null;
    collectionMethod?: Stripe.Invoice.CollectionMethod | null;
    paymentIntentExists?: boolean;
    paymentIntentId?: string | null;
    reason?: string;
  };
}> {
  const delays = [0, 250, 500, 900, 1300, 2000];

  for (const d of delays) {
    if (d) await sleep(d);

    const sub = await stripe.subscriptions.retrieve(subId, {
      expand: ["latest_invoice.payment_intent", "latest_invoice", "pending_setup_intent"],
    });

    const psi = sub.pending_setup_intent;
    if (psi && typeof psi !== "string" && psi.client_secret) {
      return {
        clientSecret: psi.client_secret,
        kind: "setup_intent",
        debug: {
          subStatus: sub.status,
          hasPendingSetupIntent: true,
          pendingSetupIntentId: psi.id,
          invoiceId: getInvoiceIdFromSub(sub),
        },
      };
    }

    const invoiceId = getInvoiceIdFromSub(sub);
    if (!invoiceId) continue;

    let inv = await stripe.invoices.retrieve(invoiceId, { expand: ["payment_intent"] });
    let meta = getInvoiceMeta(inv);

    if (meta.collectionMethod === "send_invoice") {
      return {
        clientSecret: null,
        kind: null,
        debug: {
          subStatus: sub.status,
          hasPendingSetupIntent: false,
          invoiceId: meta.invoiceId,
          invoiceStatus: meta.invoiceStatus,
          collectionMethod: meta.collectionMethod,
          paymentIntentExists: !!meta.paymentIntentId,
          paymentIntentId: meta.paymentIntentId,
        },
      };
    }

    if (!meta.paymentIntentId && meta.invoiceStatus === "draft") {
      inv = await stripe.invoices.finalizeInvoice(invoiceId, { expand: ["payment_intent"] });
      meta = getInvoiceMeta(inv);
    }

    const expanded = meta.paymentIntentExpanded;
    if (expanded?.client_secret) {
      return {
        clientSecret: expanded.client_secret,
        kind: "payment_intent",
        debug: {
          subStatus: sub.status,
          hasPendingSetupIntent: false,
          invoiceId: meta.invoiceId,
          invoiceStatus: meta.invoiceStatus,
          collectionMethod: meta.collectionMethod,
          paymentIntentExists: true,
          paymentIntentId: expanded.id,
        },
      };
    }

    if (meta.paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(meta.paymentIntentId);
      if (pi.client_secret) {
        return {
          clientSecret: pi.client_secret,
          kind: "payment_intent",
          debug: {
            subStatus: sub.status,
            hasPendingSetupIntent: false,
            invoiceId: meta.invoiceId,
            invoiceStatus: meta.invoiceStatus,
            collectionMethod: meta.collectionMethod,
            paymentIntentExists: true,
            paymentIntentId: pi.id,
          },
        };
      }
    }
  }

  return { clientSecret: null, kind: null, debug: { reason: "not_resolved_after_retries" } };
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;

  const toUserId = String(body.toUserId || "");
  const amountCents = Math.round(Number(body.amountCents || 0));
  const currency = String(body.currency || "EUR").toUpperCase();
  const cadence = body.cadence as Body["cadence"];
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;

  if (!toUserId || !Number.isFinite(amountCents) || amountCents <= 0 || !cadence) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }
  if (!["DAILY", "WEEKLY", "MONTHLY"].includes(cadence)) {
    return NextResponse.json({ ok: false, error: "Invalid cadence" }, { status: 400 });
  }
  if (toUserId === me.id) {
    return NextResponse.json({ ok: false, error: "Cannot enable autodrain to yourself" }, { status: 400 });
  }

  let dommeId: string | null = null;
  let subId: string | null = null;

  if (conversationId) {
    const convo = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { dommeId: toUserId, subId: me.id },
          { dommeId: me.id, subId: toUserId },
        ],
      },
      select: { id: true, dommeId: true, subId: true },
    });

    if (!convo) return NextResponse.json({ ok: false, error: "Conversation mismatch" }, { status: 403 });
    dommeId = convo.dommeId;
    subId = convo.subId;
  } else {
    const existingConvo = await prisma.conversation.findFirst({
      where: {
        OR: [
          { dommeId: toUserId, subId: me.id },
          { dommeId: me.id, subId: toUserId },
        ],
      },
      select: { id: true, dommeId: true, subId: true },
    });

    if (existingConvo) {
      dommeId = existingConvo.dommeId;
      subId = existingConvo.subId;
    } else {
      dommeId = toUserId;
      subId = me.id;
    }
  }

  if (me.id !== subId) {
    return NextResponse.json({ ok: false, error: "Only the submissive can enable autodrain" }, { status: 403 });
  }

  const now = new Date();
  const next = addCadence(now, cadence);

  const existing = await prisma.autoDrainSubscription.findFirst({
    where: { dommeId: dommeId!, subId: subId!, active: true, amountCents, currency, cadence },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ ok: false, error: "Already active" }, { status: 409 });

  const meDb = await loadMeCustomer(me.id);
  const customerId = await ensureStripeCustomer(meDb);

  // ✅ NEU: Hole Default Payment Method vom Customer
  const customer = await stripe.customers.retrieve(customerId);
  const defaultPmId = 
    typeof customer !== 'object' || customer.deleted
      ? null
      : typeof customer.invoice_settings?.default_payment_method === 'string'
        ? customer.invoice_settings.default_payment_method
        : customer.invoice_settings?.default_payment_method?.id ?? null;

  const ad = await prisma.autoDrainSubscription.create({
    data: {
      dommeId: dommeId!,
      subId: subId!,
      amountCents,
      currency,
      cadence,
      nextChargeAt: next,
      lastChargeAt: null,
      active: false,
      stripeCustomerId: customerId,
      stripeStatus: "incomplete",
    },
    select: { id: true },
  });

  const product = await stripe.products.create({
    name: "Subm8 AutoDrain",
    metadata: { kind: "autodrain" },
  });

  const topupFeeCents = Math.round(amountCents * (PLATFORM_FEE_BPS_TOPUP / 10_000));
  const totalCents = amountCents + topupFeeCents;

  const price = await stripe.prices.create({
    currency: currency.toLowerCase(),
    unit_amount: totalCents,
    product: product.id,
    recurring: {
      interval: cadenceToStripeInterval(cadence),
      interval_count: 1,
    },
  });

  // ✅ NEU: Subscription Params mit optionalem default_payment_method
  const subParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items: [{ price: price.id }],
    payment_behavior: "default_incomplete",
    payment_settings: {
      payment_method_types: ["card"],
      save_default_payment_method: "on_subscription",
    },
    billing_cycle_anchor: Math.floor(Date.now() / 1000),
    proration_behavior: "none",
    metadata: {
      kind: "autodrain",
      autoDrainId: ad.id,
      dommeId: dommeId!,
      subId: subId!,
      saveForFuture: "1",
    },
    expand: ["latest_invoice.payment_intent", "pending_setup_intent"],
  };

  // ✅ NEU: Wenn Default Payment Method existiert, setze ihn
  if (defaultPmId) {
    subParams.default_payment_method = defaultPmId;
  }

  const sub = await stripe.subscriptions.create(
    subParams,
    { idempotencyKey: `autodrain_create:${ad.id}` }
  );

  const resolved = await resolveClientSecretForSubscription(sub.id);
  const clientSecret = resolved.clientSecret;

  if (!clientSecret) {
    await prisma.autoDrainSubscription.delete({ where: { id: ad.id } }).catch(() => {});
    await stripe.subscriptions.cancel(sub.id).catch(() => {});

    const isDev = process.env.NODE_ENV !== "production";
    const invoiceId = getInvoiceIdFromSub(sub);

    let invoiceStatus: Stripe.Invoice.Status | null = null;
    let collectionMethod: Stripe.Invoice.CollectionMethod | null = null;
    let paymentIntentExists: boolean | null = null;

    if (invoiceId) {
      try {
        const inv = await stripe.invoices.retrieve(invoiceId, { expand: ["payment_intent"] });
        const meta = getInvoiceMeta(inv);
        invoiceStatus = meta.invoiceStatus;
        collectionMethod = meta.collectionMethod;
        paymentIntentExists = !!meta.paymentIntentId;
      } catch {}
    }

    return NextResponse.json(
      {
        ok: false,
        error: "Missing payment intent",
        ...(isDev
          ? {
              debug: {
                subStatus: sub.status,
                pendingSetupIntentClientSecret: getPendingSetupIntentClientSecret(sub),
                invoiceStatus,
                collectionMethod,
                paymentIntentExists,
                resolvedKind: resolved.kind,
                resolvedDebug: resolved.debug,
              },
            }
          : undefined),
      },
      { status: 500 }
    );
  }

  await prisma.autoDrainSubscription.update({
    where: { id: ad.id },
    data: {
      stripeSubscriptionId: sub.id,
      stripeStatus: sub.status,
    },
  });

  // ✅ NEU: Customer Session mit payment_method_redisplay
  const customerSession = await stripe.customerSessions.create({
    customer: customerId,
    components: {
      payment_element: {
        enabled: true,
        features: {
          payment_method_redisplay: "enabled", // ✅ Zeigt gespeicherte Karten
          payment_method_remove: "enabled",
          payment_method_save: "enabled", // ✅ Match UI toggle
        },
      },
    },
  });

  return NextResponse.json({
    ok: true,
    autoDrainId: ad.id,
    stripeSubscriptionId: sub.id,
    currency,
    amountCents,
    cadence,
    clientSecret,
    customerSessionClientSecret: customerSession.client_secret,
    intentType: resolved.kind,
  });
}