// src/app/api/payments/methods/list/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

type ListOk = {
  ok: true;
  customerId: string | null;
  defaultPaymentMethodId: string | null;
  methods: Array<{
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  }>;
};

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const u = await prisma.user.findUnique({
    where: { id: me.id },
    select: { stripeCustomerId: true },
  });

  const customerId = u?.stripeCustomerId ?? null;

  if (!customerId) {
    const empty: ListOk = { ok: true, customerId: null, defaultPaymentMethodId: null, methods: [] };
    return NextResponse.json(empty);
  }

  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as Stripe.DeletedCustomer).deleted) {
    const empty: ListOk = { ok: true, customerId, defaultPaymentMethodId: null, methods: [] };
    return NextResponse.json(empty);
  }

  const c = customer as Stripe.Customer;
  const defaultPm =
    typeof c.invoice_settings?.default_payment_method === "string"
      ? c.invoice_settings.default_payment_method
      : c.invoice_settings?.default_payment_method?.id ?? null;

  const pms = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  const seen = new Set<string>();
  const unique: Stripe.PaymentMethod[] = [];
  const noFp: Stripe.PaymentMethod[] = [];

  for (const pm of pms.data) {
    const fp = pm.card?.fingerprint;

    if (!fp) {
      noFp.push(pm);
      continue;
    }

    if (seen.has(fp)) continue;
    seen.add(fp);
    unique.push(pm);
  }

  const chosen = unique.length > 0 ? unique : pms.data;

  const methods: ListOk["methods"] = chosen.map((pm) => ({
    id: pm.id,
    brand: pm.card?.brand ?? "card",
    last4: pm.card?.last4 ?? "0000",
    expMonth: pm.card?.exp_month ?? 0,
    expYear: pm.card?.exp_year ?? 0,
  }));

  const out: ListOk = { ok: true, customerId, defaultPaymentMethodId: defaultPm, methods };
  return NextResponse.json(out);
}
