// src/app/api/payout/request/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

const MIN_PAYOUT_CENTS = 1000; // €10.00

const PAXUM_PAYOUT_FEE_CENTS = 150; // €1.50
const COSMO_PAYOUT_FEE_CENTS = 150; // €1.50

const PAYOUT_METHODS = ["STRIPE_CONNECT", "PAXUM", "COSMO"] as const;
type PayoutMethod = (typeof PAYOUT_METHODS)[number];

type StripePayoutMode = "AUTO_PAYOUT" | "TRANSFER_ONLY";

function feeFor(method: PayoutMethod) {
  if (method === "PAXUM") return PAXUM_PAYOUT_FEE_CENTS;
  if (method === "COSMO") return COSMO_PAYOUT_FEE_CENTS;
  return 0;
}

function isMethod(v: unknown): v is PayoutMethod {
  return typeof v === "string" && (PAYOUT_METHODS as readonly string[]).includes(v);
}

function isStripeMode(v: unknown): v is StripePayoutMode {
  return v === "AUTO_PAYOUT" || v === "TRANSFER_ONLY";
}

type RequestBody = {
  stripeMode?: StripePayoutMode;
  /**
   * Optional: wenn bereits ein PayoutRequest existiert (z.B. AUTO_PAYOUT -> 409),
   * kann der Client den selben Request "finalisieren", ohne erneut zu transferieren.
   */
  payoutId?: string;
};

type JsonErr = {
  error: string;
  code?: string;
  payoutId?: string;
  stripeAccountId?: string;
  stripeTransferId?: string;
  canTransferOnly?: boolean;
};

function isDeletedStripeAccount(acct: unknown): acct is { deleted: true } {
  return !!acct && typeof acct === "object" && (acct as { deleted?: unknown }).deleted === true;
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser().catch(() => null);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Parse optional body (works also when body is empty / not JSON)
    let stripeMode: StripePayoutMode = "AUTO_PAYOUT";
    let payoutId: string | null = null;

    try {
      const body = (await req.json().catch(() => null)) as unknown;
      if (body && typeof body === "object") {
        const b = body as RequestBody;
        if (isStripeMode(b.stripeMode)) stripeMode = b.stripeMode;
        if (typeof b.payoutId === "string" && b.payoutId.trim().length > 0) payoutId = b.payoutId.trim();
      }
    } catch {
      // ignore
    }

    // Load user payout settings
    const u = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        payoutMethod: true,
        stripeAccountId: true,
        payoutPaxumEmail: true,
        payoutCosmoWalletId: true,
      },
    });

    const method: PayoutMethod = isMethod(u?.payoutMethod) ? u!.payoutMethod : "STRIPE_CONNECT";

    // If payoutId provided: continue/finalize that payoutRequest (Stripe Connect only)
    if (payoutId) {
      const existing = await prisma.payoutRequest.findUnique({
        where: { id: payoutId },
        select: {
          id: true,
          userId: true,
          method: true,
          destination: true,
          requestedCents: true,
          feeCents: true,
          payoutCents: true,
          status: true,
          createdAt: true,
          stripeTransferId: true,
          stripePayoutId: true,
          stripePayoutStatus: true,
          failedReason: true,
        },
      });

      if (!existing || existing.userId !== me.id) {
        return NextResponse.json({ error: "PayoutRequest nicht gefunden." }, { status: 404 });
      }

      if (existing.method !== "STRIPE_CONNECT") {
        return NextResponse.json({ error: "payoutId kann nur für STRIPE_CONNECT verwendet werden." }, { status: 400 });
      }

      if (!u?.stripeAccountId) {
        return NextResponse.json({ error: "Stripe Connect ist nicht verbunden." }, { status: 400 });
      }

      const connectedAccountId = u.stripeAccountId;

      // If already PAID/PROCESSING, just return state (idempotent)
      if (existing.status === "PAID" || existing.status === "PROCESSING") {
        return NextResponse.json({
          ok: true,
          payoutId: existing.id,
          method: existing.method,
          destination: existing.destination,
          requestedCents: existing.requestedCents,
          feeCents: existing.feeCents,
          payoutCents: existing.payoutCents,
          status: existing.status,
          createdAt: existing.createdAt,
          stripeTransferId: existing.stripeTransferId,
          stripePayoutId: existing.stripePayoutId,
          stripePayoutStatus: existing.stripePayoutStatus,
        });
      }

      // If user confirmed TRANSFER_ONLY: finalize without creating a new transfer
      if (stripeMode === "TRANSFER_ONLY") {
        // We expect stripeTransferId to already exist from the first attempt.
        // If not, we can still create it once here.
        let transferId = existing.stripeTransferId ?? null;

        if (!transferId) {
          // create transfer once (idempotent key ties to payoutId)
          const transfer = await stripe.transfers.create(
            {
              amount: existing.payoutCents,
              currency: "eur",
              destination: connectedAccountId,
              transfer_group: `payout_${existing.id}`,
              metadata: {
                payoutRequestId: existing.id,
                userId: me.id,
                kind: "creator_transfer",
                stripeMode: "TRANSFER_ONLY",
              },
            },
            { idempotencyKey: `payout_transfer_${existing.id}` }
          );
          transferId = transfer.id;

          await prisma.payoutRequest.update({
            where: { id: existing.id },
            data: { stripeTransferId: transferId },
          });
        }

        await prisma.payoutRequest.update({
          where: { id: existing.id },
          data: {
            status: "PAID",
            processedAt: new Date(),
            failedReason: null,
            stripePayoutId: null,
            stripePayoutStatus: "transfer_only",
          },
        });

        return NextResponse.json({
          ok: true,
          payoutId: existing.id,
          method: existing.method,
          destination: existing.destination,
          requestedCents: existing.requestedCents,
          feeCents: existing.feeCents,
          payoutCents: existing.payoutCents,
          status: "PAID",
          createdAt: existing.createdAt,
          stripeTransferId: transferId,
          stripePayoutId: null,
          stripePayoutStatus: "transfer_only",
        });
      }

      // AUTO_PAYOUT requested, but we already know this payoutId was created earlier.
      // Re-check if payouts are enabled now; if yes, create connected payout.
      const acct = await stripe.accounts.retrieve(connectedAccountId);
        if (isDeletedStripeAccount(acct)) {
        await prisma.payoutRequest.update({
            where: { id: existing.id},
            data: { status: "FAILED", failedReason: "Stripe Account ungültig.", processedAt: new Date() },
        });
        return NextResponse.json({ error: "Stripe Account ungültig." }, { status: 400 });
        }

      const canAutoPayout =
        Boolean((acct as Stripe.Account).details_submitted) && Boolean((acct as Stripe.Account).payouts_enabled);

      if (!canAutoPayout) {
        const payload: JsonErr = {
          error: "Stripe Onboarding unvollständig (payouts nicht aktiviert).",
          code: "PAYOUTS_NOT_ENABLED",
          payoutId: existing.id,
          stripeAccountId: connectedAccountId,
          stripeTransferId: existing.stripeTransferId ?? undefined,
          canTransferOnly: true,
        };
        return NextResponse.json(payload, { status: 409 });
      }

      // Ensure transfer exists before payout
      let transferId = existing.stripeTransferId ?? null;
      if (!transferId) {
        const transfer = await stripe.transfers.create(
          {
            amount: existing.payoutCents,
            currency: "eur",
            destination: connectedAccountId,
            transfer_group: `payout_${existing.id}`,
            metadata: {
              payoutRequestId: existing.id,
              userId: me.id,
              kind: "creator_transfer",
              stripeMode: "AUTO_PAYOUT",
            },
          },
          { idempotencyKey: `payout_transfer_${existing.id}` }
        );
        transferId = transfer.id;

        await prisma.payoutRequest.update({
          where: { id: existing.id },
          data: { stripeTransferId: transferId },
        });
      }

      const payout = await stripe.payouts.create(
        {
          amount: existing.payoutCents,
          currency: "eur",
          method: "standard",
          metadata: {
            payoutRequestId: existing.id,
            userId: me.id,
            kind: "creator_connected_payout",
            transferId,
            stripeMode: "AUTO_PAYOUT",
          },
        },
        { stripeAccount: connectedAccountId, idempotencyKey: `payout_connected_${existing.id}` }
      );

      await prisma.payoutRequest.update({
        where: { id: existing.id },
        data: {
          stripePayoutId: payout.id,
          stripePayoutStatus: payout.status ?? null,
          status: "PROCESSING",
          failedReason: null,
        },
      });

      return NextResponse.json({
        ok: true,
        payoutId: existing.id,
        method: existing.method,
        destination: existing.destination,
        requestedCents: existing.requestedCents,
        feeCents: existing.feeCents,
        payoutCents: existing.payoutCents,
        status: "PROCESSING",
        createdAt: existing.createdAt,
        stripeTransferId: transferId,
        stripePayoutId: payout.id,
        stripePayoutStatus: payout.status ?? null,
      });
    }

    // No payoutId: start a new payout request as before

    const availablePayments = await prisma.payment.findMany({
      where: {
        payeeId: me.id,
        status: "SUCCEEDED",
        payoutRequestId: null,
      },
      select: { id: true, amountNetToDommeCents: true },
    });

    const availableCents = availablePayments.reduce((sum, p) => sum + (p.amountNetToDommeCents ?? 0), 0);

    if (availableCents <= 0) {
      return NextResponse.json({ error: "Kein auszahlbares Guthaben." }, { status: 400 });
    }

    const requestedCents = availableCents;
    const feeCents = feeFor(method);
    const payoutCents = requestedCents - feeCents;

    if (payoutCents < MIN_PAYOUT_CENTS) {
      return NextResponse.json(
        {
          error: `Nach Gebühren ist der Mindestbetrag €${(MIN_PAYOUT_CENTS / 100).toFixed(2)} (Fee: €${(
            feeCents / 100
          ).toFixed(2)}).`,
          requestedCents,
          feeCents,
          payoutCents,
          method,
        },
        { status: 400 }
      );
    }

    let destination = "";
    if (method === "STRIPE_CONNECT") {
      if (!u?.stripeAccountId) {
        return NextResponse.json({ error: "Stripe Connect ist nicht verbunden." }, { status: 400 });
      }
      destination = `Stripe Connect ${u.stripeAccountId}`;
    } else if (method === "PAXUM") {
      if (!u?.payoutPaxumEmail) return NextResponse.json({ error: "Paxum E-Mail fehlt." }, { status: 400 });
      destination = `Paxum ${u.payoutPaxumEmail}`;
    } else if (method === "COSMO") {
      if (!u?.payoutCosmoWalletId) return NextResponse.json({ error: "Cosmo Wallet ID fehlt." }, { status: 400 });
      destination = `Cosmo ${u.payoutCosmoWalletId}`;
    }

    // 1) Create payout request + reserve payments
    const payoutRequest = await prisma.payoutRequest.create({
      data: {
        userId: me.id,
        amountCents: requestedCents,
        currency: "EUR",
        method,
        destination,
        requestedCents,
        feeCents,
        payoutCents,
        feePayer: "USER",
        status: method === "STRIPE_CONNECT" ? "PROCESSING" : "REQUESTED",
      },
      select: {
        id: true,
        method: true,
        destination: true,
        requestedCents: true,
        feeCents: true,
        payoutCents: true,
        createdAt: true,
        status: true,
      },
    });

    if (availablePayments.length) {
      await prisma.payment.updateMany({
        where: { id: { in: availablePayments.map((p) => p.id) } },
        data: { payoutRequestId: payoutRequest.id },
      });
    }

    // Stripe Connect flow
    if (method === "STRIPE_CONNECT") {
      const connectedAccountId = u!.stripeAccountId!;

      // retrieve account once
      const acct = await stripe.accounts.retrieve(connectedAccountId);
if (isDeletedStripeAccount(acct)) {
  await prisma.payoutRequest.update({
    where: { id: payoutRequest.id},
    data: { status: "FAILED", failedReason: "Stripe Account ungültig.", processedAt: new Date() },
  });
  return NextResponse.json({ error: "Stripe Account ungültig." }, { status: 400 });
}

      // Transfer platform -> connected (idempotent)
      const transfer = await stripe.transfers.create(
        {
          amount: payoutCents,
          currency: "eur",
          destination: connectedAccountId,
          transfer_group: `payout_${payoutRequest.id}`,
          metadata: {
            payoutRequestId: payoutRequest.id,
            userId: me.id,
            kind: "creator_transfer",
            stripeMode,
          },
        },
        { idempotencyKey: `payout_transfer_${payoutRequest.id}` }
      );

      // persist transfer immediately (so we can "finalize" later without double transfer)
      await prisma.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: { stripeTransferId: transfer.id },
      });

      // Transfer-only: finalize and stop
      if (stripeMode === "TRANSFER_ONLY") {
        await prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: {
            stripePayoutId: null,
            stripePayoutStatus: "transfer_only",
            status: "PAID",
            processedAt: new Date(),
            failedReason: null,
          },
        });

        return NextResponse.json({
          ok: true,
          payoutId: payoutRequest.id,
          method,
          destination,
          requestedCents,
          feeCents,
          payoutCents,
          status: "PAID",
          createdAt: payoutRequest.createdAt,
          stripeTransferId: transfer.id,
          stripePayoutId: null,
          stripePayoutStatus: "transfer_only",
        });
      }

      // AUTO_PAYOUT: check payout readiness
      const canAutoPayout =
        Boolean((acct as Stripe.Account).details_submitted) && Boolean((acct as Stripe.Account).payouts_enabled);

      if (!canAutoPayout) {
        // IMPORTANT: transfer already happened; we keep payoutRequest around for "finalize"
        await prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: {
            status: "FAILED",
            failedReason: "Payouts nicht aktiviert (kein Bank-Payout möglich).",
            processedAt: new Date(),
            stripePayoutStatus: "payouts_not_enabled",
          },
        });

        const payload: JsonErr = {
          error: "Stripe Onboarding unvollständig (payouts nicht aktiviert).",
          code: "PAYOUTS_NOT_ENABLED",
          payoutId: payoutRequest.id,
          stripeAccountId: connectedAccountId,
          stripeTransferId: transfer.id,
          canTransferOnly: true,
        };

        return NextResponse.json(payload, { status: 409 });
      }

      // Connected payout -> bank
      const payout = await stripe.payouts.create(
        {
          amount: payoutCents,
          currency: "eur",
          method: "standard",
          metadata: {
            payoutRequestId: payoutRequest.id,
            userId: me.id,
            kind: "creator_connected_payout",
            transferId: transfer.id,
            stripeMode: "AUTO_PAYOUT",
          },
        },
        { stripeAccount: connectedAccountId, idempotencyKey: `payout_connected_${payoutRequest.id}` }
      );

      await prisma.payoutRequest.update({
        where: { id: payoutRequest.id },
        data: {
          stripePayoutId: payout.id,
          stripePayoutStatus: payout.status ?? null,
          status: "PROCESSING",
          failedReason: null,
        },
      });

      return NextResponse.json({
        ok: true,
        payoutId: payoutRequest.id,
        method,
        destination,
        requestedCents,
        feeCents,
        payoutCents,
        status: "PROCESSING",
        createdAt: payoutRequest.createdAt,
        stripeTransferId: transfer.id,
        stripePayoutId: payout.id,
        stripePayoutStatus: payout.status ?? null,
      });
    }

    // Non-stripe methods: just create request
    return NextResponse.json({
      ok: true,
      payoutId: payoutRequest.id,
      method: payoutRequest.method,
      destination: payoutRequest.destination,
      requestedCents: payoutRequest.requestedCents,
      feeCents: payoutRequest.feeCents,
      payoutCents: payoutRequest.payoutCents,
      status: payoutRequest.status,
      createdAt: payoutRequest.createdAt,
    });
  } catch (e) {
    console.error("POST /api/payout/request error:", e);
    return NextResponse.json({ error: "Auszahlung fehlgeschlagen" }, { status: 500 });
  }
}
