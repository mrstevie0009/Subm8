// src/app/api/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import type Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { addCadence } from "@/lib/autodrain";
import { linkPaymentToContract } from "@/lib/contracts";
import { recordBudgetSpend } from "@/lib/budget";

export const runtime = "nodejs";

/**
 * Struktur der Metadaten, die du in Payment.metadataJson ablegst.
 */
type TipPaymentMeta = {
  baseAmountCents?: number;
  note?: string | null;
  conversationId?: string | null;
};

function parseMeta(input: unknown): TipPaymentMeta {
  const out: TipPaymentMeta = {};
  if (!input || typeof input !== "object") return out;
  const obj = input as Record<string, unknown>;

  const bac = obj.baseAmountCents;
  if (typeof bac === "number" && Number.isFinite(bac)) out.baseAmountCents = Math.round(bac);

  const note = obj.note;
  if (typeof note === "string") out.note = note;
  else if (note === null) out.note = null;

  const cid = obj.conversationId;
  if (typeof cid === "string") out.conversationId = cid;
  else if (cid === null) out.conversationId = null;

  return out;
}

/**
 * Gebührenlogik wie in deinen Routes.
 */
const TOPUP_PCT = 0.10;
const SPLIT_PCT = 0.10;

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

async function getChargeAndFeeCents(pi: Stripe.PaymentIntent): Promise<{ chargeId: string | null; feeCents: number }> {
  const chargeId = typeof pi.latest_charge === "string" ? pi.latest_charge : (pi.latest_charge?.id ?? null);
  if (!chargeId) return { chargeId: null, feeCents: 0 };

  // Charge expand -> balance_transaction für fee
  const ch = await stripe.charges.retrieve(chargeId, { expand: ["balance_transaction"] });
  const bt = ch.balance_transaction as Stripe.BalanceTransaction | null;

  return { chargeId, feeCents: bt?.fee ?? 0 };
}

/**
 * Für Connect-Payout Events:
 * payout.metadata enthält bei uns payoutRequestId (aus /api/payout/request)
 */
function getPayoutRequestIdFromPayout(p: Stripe.Payout): string | null {
  const v = (p.metadata as Record<string, string | undefined> | null | undefined)?.payoutRequestId;
  return typeof v === "string" && v.length > 0 ? v : null;
}

function getInvoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const raw = inv as unknown as Record<string, unknown>;
  const sub = raw["subscription"];

  if (typeof sub === "string") return sub;
  if (sub && typeof sub === "object" && "id" in sub && typeof sub.id === "string") return sub.id;

  return null;
}

function getInvoicePaymentIntentId(inv: Stripe.Invoice): string | null {
  const raw = inv as unknown as Record<string, unknown>;
  const pi = raw["payment_intent"];

  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && "id" in pi && typeof pi.id === "string") return pi.id;

  return null;
}

async function handleAutodrainInvoicePaid(inv: Stripe.Invoice) {
  const stripeSubscriptionId = getInvoiceSubscriptionId(inv);
  if (!stripeSubscriptionId) return;

  const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const autoDrainId = sub.metadata?.autoDrainId;

  if (!autoDrainId) return;

  const ad = await prisma.autoDrainSubscription.findUnique({
    where: { id: autoDrainId },
    select: {
      id: true,
      dommeId: true,
      subId: true,
      amountCents: true,
      currency: true,
      cadence: true,
      nextChargeAt: true,
      active: true,
    },
  });

  if (!ad) return;

  const invoiceId = inv.id;
  const paymentIntentId = getInvoicePaymentIntentId(inv);

  // Idempotenz: Invoice darf nur einmal als Payment landen
  const existingPayment = await prisma.payment.findFirst({
    where: {
      metadataJson: {
        path: ["stripeInvoiceId"],
        equals: invoiceId,
      },
    },
    select: { id: true },
  });

  if (existingPayment) return;

  const now = new Date();

  const topupFeeCents = Math.round(ad.amountCents * TOPUP_PCT);
  const splitFeeCents = Math.round(ad.amountCents * SPLIT_PCT);
  const totalCents = ad.amountCents + topupFeeCents;
  const dommeNetCents = ad.amountCents - splitFeeCents;
  const platformFeeTotalCents = topupFeeCents + splitFeeCents;

  let stripeChargeId: string | null = null;
  let processorFeeCents = 0;

  if (paymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ["latest_charge.balance_transaction"],
    });

    stripeChargeId =
      typeof pi.latest_charge === "string"
        ? pi.latest_charge
        : pi.latest_charge?.id ?? null;

    const charge =
      typeof pi.latest_charge !== "string" ? pi.latest_charge : null;

    const bt =
      charge && typeof charge.balance_transaction !== "string"
        ? charge.balance_transaction
        : null;

    processorFeeCents = bt?.fee ?? 0;
  }

  const next = addCadence(ad.nextChargeAt ?? now, ad.cadence);

  const { paymentId: newPaymentId } = await prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        id: randomUUID(),
        payerId: ad.subId,
        payeeId: ad.dommeId,
        amountGrossCents: totalCents,
        amountNetToDommeCents: dommeNetCents,
        platformFeeCents: platformFeeTotalCents,
        processorFeeCents,
        currency: ad.currency,
        status: "SUCCEEDED",
        externalRef: paymentIntentId ?? invoiceId,
        paymentProvider: "Stripe",
        stripeChargeId,
        metadataJson: {
          kind: "autodrain",
          autoDrainId: ad.id,
          stripeSubscriptionId,
          stripeInvoiceId: invoiceId,
          stripePaymentIntentId: paymentIntentId,
          cadence: ad.cadence,
        },
      },
      select: { id: true },
    });

    const charge = await tx.autoDrainCharge.create({
      data: {
        subscriptionId: ad.id,
        amountCents: ad.amountCents,
        currency: ad.currency,
        status: "SUCCESS",
        receiptId: invoiceId,
      },
      select: { id: true, at: true },
    });

    await tx.autoDrainSubscription.update({
      where: { id: ad.id },
      data: {
        active: true,
        stripeStatus: sub.status,
        lastChargeAt: charge.at,
        nextChargeAt: next,
      },
    });

    await tx.ledger.createMany({
      data: [
        {
          id: randomUUID(),
          paymentId: payment.id,
          entryType: "DEBIT",
          account: "SUB_CASH",
          amountCents: totalCents,
          currency: ad.currency,
        },
        {
          id: randomUUID(),
          paymentId: payment.id,
          entryType: "CREDIT",
          account: "DOMME_WALLET",
          amountCents: dommeNetCents,
          currency: ad.currency,
        },
        {
          id: randomUUID(),
          paymentId: payment.id,
          entryType: "CREDIT",
          account: "PLATFORM_WALLET",
          amountCents: platformFeeTotalCents,
          currency: ad.currency,
        },
      ],
    });

    const convo = await tx.conversation.findFirst({
      where: {
        dommeId: ad.dommeId,
        subId: ad.subId,
      },
      select: { id: true },
    });

    if (convo) {
      await tx.message.create({
        data: {
          conversationId: convo.id,
          authorId: ad.dommeId,
          text: `ADCHG::${JSON.stringify({
            id: charge.id,
            paymentId: payment.id,
            amountCents: ad.amountCents,
            currency: ad.currency,
            cadence: ad.cadence,
            at: charge.at.toISOString(),
            receiptId: invoiceId,
            nextChargeAt: next.toISOString(),
          })}`,
        },
      });
    }

    return { paymentId: payment.id };
  });

  // NEU: Contract-Payment buchen falls aktiver Contract zwischen sub und domme
  await linkPaymentToContract(
    ad.subId,
    ad.dommeId,
    dommeNetCents,
    newPaymentId,
    'AUTODRAIN_PAYMENT'
  );

  // Budget-Tracking für den Sub
  await recordBudgetSpend(ad.subId, ad.amountCents).catch(() => {});
}

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ ok: false, error: "Missing stripe-signature" }, { status: 400 });

  const raw = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      /**
       * ===========================
       *  PAYOUT TRACKING (CONNECT)
       * ===========================
       *
       * Wichtig:
       * - Das sind Payouts auf CONNECTED ACCOUNTS.
       * - Dein Webhook Endpoint muss in Stripe als "Listen to events on connected accounts"
       *   konfiguriert sein, sonst kommen payout.* Events nicht für connected accounts an.
       */
      case "payout.paid": {
        const po = event.data.object as Stripe.Payout;

        // Prefer mapping via payoutRequestId in metadata (иятий)
        const payoutRequestId = getPayoutRequestIdFromPayout(po);

        if (payoutRequestId) {
          await prisma.payoutRequest.updateMany({
            where: { id: payoutRequestId },
            data: {
              status: "PAID",
              stripePayoutId: po.id,
              stripePayoutStatus: po.status ?? null,
              processedAt: new Date(),
              failedReason: null,
            },
          });

          return NextResponse.json({ ok: true });
        }

        // Fallback: map by stripePayoutId if metadata missing
        await prisma.payoutRequest.updateMany({
          where: { stripePayoutId: po.id },
          data: {
            status: "PAID",
            stripePayoutStatus: po.status ?? null,
            processedAt: new Date(),
            failedReason: null,
          },
        });

        return NextResponse.json({ ok: true });
      }

      case "payout.failed": {
        const po = event.data.object as Stripe.Payout;

        const payoutRequestId = getPayoutRequestIdFromPayout(po);

        // best-effort failure message (fields depend on method / stripe version)
        const failureMessage =
          po.failure_message ??
          po.failure_code ??
          (po.status === "failed" ? "Stripe payout failed" : "Stripe payout error");

        if (payoutRequestId) {
          await prisma.payoutRequest.updateMany({
            where: { id: payoutRequestId },
            data: {
              status: "FAILED",
              stripePayoutId: po.id,
              stripePayoutStatus: po.status ?? null,
              processedAt: new Date(),
              failedReason: String(failureMessage).slice(0, 500),
            },
          });

          return NextResponse.json({ ok: true });
        }

        // Fallback: map by stripePayoutId if metadata missing
        await prisma.payoutRequest.updateMany({
          where: { stripePayoutId: po.id },
          data: {
            status: "FAILED",
            stripePayoutStatus: po.status ?? null,
            processedAt: new Date(),
            failedReason: String(failureMessage).slice(0, 500),
          },
        });

        return NextResponse.json({ ok: true });
      }

      case "account.updated": {
        // This event can be emitted for connected accounts (if your webhook is configured accordingly).
        const acct = event.data.object as Stripe.Account;

        const stripeAccountId = acct.id;

        // Update cached onboarding flags for the user owning this connected account
        await prisma.user.updateMany({
          where: { stripeAccountId },
          data: {
            stripeDetailsSubmitted: Boolean(acct.details_submitted),
            stripePayoutsEnabled: Boolean(acct.payouts_enabled),
            stripeChargesEnabled: Boolean(acct.charges_enabled),
            stripeOnboardingLastAt: new Date(),
          },
        });

        return NextResponse.json({ ok: true });
      }

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const inv = event.data.object as Stripe.Invoice;
        await handleAutodrainInvoicePaid(inv);
        return NextResponse.json({ ok: true });
      }

      /**
       * ===========================
       *  EXISTING TIP PAYMENTS
       * ===========================
       */
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = String(pi.metadata?.paymentId || "");
        if (!paymentId) return NextResponse.json({ ok: true });

        // Payment laden
        const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
        if (!payment) return NextResponse.json({ ok: true });

        // Idempotenz: wenn schon succeeded, nichts kaputt machen
        // (Wir können trotzdem fee/charge nachziehen, falls vorher 0 war.)
        const { chargeId, feeCents } = await getChargeAndFeeCents(pi);

        const meta = parseMeta(payment.metadataJson);
        const gross = payment.amountGrossCents;

        // Base für Tip ableiten
        const baseAmountCents = meta.baseAmountCents ?? inferBaseFromGross(gross);
        const note = meta.note ?? null;
        const conversationId = meta.conversationId ?? null;

        // Gebühren konsistent nachrechnen (so wie deine API)
        const topup = Math.round(baseAmountCents * TOPUP_PCT);
        const split = Math.round(baseAmountCents * SPLIT_PCT);
        const platformFeeTotal = topup + split;
        const grossRecalc = baseAmountCents + topup;

        // Payment aktualisieren (idempotent; überschreibt nichts Kritisches falsch)
        const updated = await prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: "SUCCEEDED",
            paymentProvider: "Stripe",
            externalRef: pi.id, // PaymentIntent ID
            stripeChargeId: chargeId ?? payment.stripeChargeId ?? null,
            processorFeeCents: feeCents || payment.processorFeeCents || 0,

            // Halte DB konsistent zu deiner Gebührenlogik:
            amountGrossCents: grossRecalc,
            platformFeeCents: platformFeeTotal,
            amountNetToDommeCents: baseAmountCents - split,
          },
        });

        // Tip idempotent anlegen:
        // - primär über methodRef = PaymentIntent ID
        const existingTip = await prisma.tip.findFirst({
          where: { methodRef: pi.id },
          select: { id: true },
        });

        if (!existingTip) {
          await prisma.tip.create({
            data: {
              fromUserId: updated.payerId,
              toUserId: updated.payeeId,
              amountCents: baseAmountCents,
              currency: updated.currency,
              status: "SUCCEEDED",
              note,
              conversationId,
              methodRef: pi.id,
            },
          });
        }

        //Contract-Payment buchen falls aktiver Contract existiert
        await linkPaymentToContract(
          updated.payerId,
          updated.payeeId,
          updated.amountNetToDommeCents,
          paymentId,
          'TIP_PAYMENT'
        );

        // Budget-Tracking für den Sub
        await recordBudgetSpend(updated.payerId, baseAmountCents).catch(() => {});

        return NextResponse.json({ ok: true });
      }

      case "payment_intent.processing": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = String(pi.metadata?.paymentId || "");
        if (!paymentId) return NextResponse.json({ ok: true });

        await prisma.payment.updateMany({
          where: { id: paymentId, status: { in: ["CREATED", "PROCESSING"] } },
          data: { status: "PROCESSING", externalRef: pi.id, paymentProvider: "Stripe" },
        });

        return NextResponse.json({ ok: true });
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = String(pi.metadata?.paymentId || "");
        if (!paymentId) return NextResponse.json({ ok: true });

        await prisma.payment.updateMany({
          where: { id: paymentId, status: { not: "SUCCEEDED" } },
          data: { status: "FAILED", externalRef: pi.id, paymentProvider: "Stripe" },
        });

        return NextResponse.json({ ok: true });
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const paymentId = String(pi.metadata?.paymentId || "");
        if (!paymentId) return NextResponse.json({ ok: true });

        await prisma.payment.updateMany({
          where: { id: paymentId, status: { not: "SUCCEEDED" } },
          data: { status: "CANCELED", externalRef: pi.id, paymentProvider: "Stripe" },
        });

        return NextResponse.json({ ok: true });
      }

      default:
        // alle anderen Events ignorieren
        return NextResponse.json({ ok: true });
    }
  } catch (e) {
    // Stripe retried bei non-2xx -> 500 liefern, damit Stripe nochmal zustellt
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Webhook error" },
      { status: 500 }
    );
  }
}
