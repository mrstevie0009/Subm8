//src/app/api/payments/autodrain/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

type Body = { autoDrainId?: string };

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;
  const autoDrainId = String(body.autoDrainId || "");
  if (!autoDrainId) return NextResponse.json({ ok: false, error: "Missing autoDrainId" }, { status: 400 });

  const ad = await prisma.autoDrainSubscription.findUnique({
    where: { id: autoDrainId },
    select: { id: true, subId: true, stripeSubscriptionId: true, active: true },
  });
  if (!ad) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (ad.subId !== me.id) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  if (!ad.stripeSubscriptionId) return NextResponse.json({ ok: false, error: "No stripeSubscriptionId" }, { status: 400 });

  const sub = await stripe.subscriptions.retrieve(ad.stripeSubscriptionId, {
    expand: ["latest_invoice.payment_intent"],
  });

  // Nach confirmPayment sollte Stripe auf "active" springen (oder trialing). Alles andere => noch nicht fertig.
  const okActive = sub.status === "active" || sub.status === "trialing";
  if (!okActive) {
    return NextResponse.json({ ok: false, error: "Subscription not active yet", status: sub.status }, { status: 409 });
  }

  // DB aktiv schalten
  if (!ad.active) {
    await prisma.autoDrainSubscription.update({
      where: { id: ad.id },
      data: { active: true, stripeStatus: sub.status },
    });
  } else {
    await prisma.autoDrainSubscription.update({
      where: { id: ad.id },
      data: { stripeStatus: sub.status },
    });
  }

  return NextResponse.json({ ok: true, autoDrainId: ad.id, status: sub.status });
}
