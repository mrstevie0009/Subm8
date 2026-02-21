// src/app/api/payments/methods/setup-intent/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

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

export async function POST() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const meDb = await loadMeCustomer(me.id);
  const customerId = await ensureStripeCustomer(meDb);

  const si = await stripe.setupIntents.create({
  customer: customerId,
  automatic_payment_methods: {
    enabled: true,
    allow_redirects: 'never',
  },
  usage: "off_session",
  metadata: { userId: me.id, kind: "payment_method_setup" },
});

  if (!si.client_secret) {
    return NextResponse.json({ ok: false, error: "Missing client secret" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, clientSecret: si.client_secret });
}
