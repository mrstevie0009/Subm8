//src/app/api/payments/autodrain/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import { addCadence } from "@/lib/autodrain";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

type Body = {
  toUserId?: string; // Domme
  amountCents?: number;
  currency?: string; // "EUR"
  cadence?: "DAILY" | "WEEKLY" | "MONTHLY";
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

function cadenceToStripeInterval(c: "DAILY" | "WEEKLY" | "MONTHLY"): "day" | "week" | "month" {
  if (c === "DAILY") return "day";
  if (c === "WEEKLY") return "week";
  return "month";
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

  // --- Rollen/Conversation prüfen (gleiche Logik wie bei deinem accept) ---
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
    if (!convo) {
      return NextResponse.json({ ok: false, error: "Conversation mismatch" }, { status: 403 });
    }
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

  // Erstelle/Reuse DB Record zunächst als "pending" (active=false) – erst nach Stripe Confirm aktiv schalten.
  const now = new Date();
  const next = addCadence(now, cadence);

  const existing = await prisma.autoDrainSubscription.findFirst({
    where: { dommeId: dommeId!, subId: subId!, active: true, amountCents, currency, cadence },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ ok: false, error: "Already active" }, { status: 409 });
  }

  const meDb = await loadMeCustomer(me.id);
  const customerId = await ensureStripeCustomer(meDb);

  const ad = await prisma.autoDrainSubscription.create({
    data: {
      dommeId: dommeId!,
      subId: subId!,
      amountCents,
      currency,
      cadence,
      nextChargeAt: next,
      lastChargeAt: null,
      active: false, // <-- pending bis Stripe bestätigt
      stripeCustomerId: customerId,
      stripeStatus: "incomplete",
    },
    select: { id: true },
  });

  // Stripe Product (TS-sicher, weil deine Stripe-Typen kein product_data in price_data erlauben)
  const product = await stripe.products.create({
    name: "Subm8 AutoDrain",
    metadata: { kind: "autodrain" },
  });

  // Stripe Subscription (incomplete) + PaymentIntent client_secret für PaymentElement
  const sub = await stripe.subscriptions.create({
    customer: customerId,
    payment_behavior: "default_incomplete",
    payment_settings: {
      // Speichert die PaymentMethod nach erfolgreicher Aktivierung fürs nächste Mal:
      save_default_payment_method: "on_subscription",
    },
    items: [
      {
        price_data: {
            currency: currency.toLowerCase(),
            unit_amount: amountCents,
            product: product.id,
            recurring: {
                interval: cadenceToStripeInterval(cadence),
                interval_count: 1,
            },
        },
      },
    ],
    metadata: {
      kind: "autodrain",
      autoDrainId: ad.id,
      dommeId: dommeId!,
      subId: subId!,
    },
    expand: ["latest_invoice.payment_intent"],
  });

  type InvoiceWithPI = Stripe.Invoice & {
    payment_intent?: string | Stripe.PaymentIntent | null;
  };

  const inv = (sub.latest_invoice as InvoiceWithPI | string | null) && typeof sub.latest_invoice !== "string"
    ? (sub.latest_invoice as InvoiceWithPI)
    : null;

  const pi =
    typeof inv?.payment_intent === "string"
      ? await stripe.paymentIntents.retrieve(inv.payment_intent)
      : inv?.payment_intent ?? null;

  const clientSecret = typeof pi === "object" && pi ? pi.client_secret : null;

  if (!clientSecret) {
    // Cleanup DB, damit kein "hängender" Eintrag bleibt
    await prisma.autoDrainSubscription.delete({ where: { id: ad.id } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "Missing payment intent" }, { status: 500 });
  }

  await prisma.autoDrainSubscription.update({
    where: { id: ad.id },
    data: {
      stripeSubscriptionId: sub.id,
      stripeStatus: sub.status,
    },
  });

  const customerSession = await stripe.customerSessions.create({
    customer: customerId,
    components: { payment_element: { enabled: true } },
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
  });
}
