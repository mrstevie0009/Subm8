// src/app/api/payout/request/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/currentUser";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});
const MIN_PAYOUT_CENTS = 1000; // €10.00

type StripePayoutMode = "AUTO_PAYOUT" | "TRANSFER_ONLY";

type RequestBody = {
  stripeMode?: StripePayoutMode;
  payoutId?: string;
};

type JsonErr = {
  error: string;
  code?: string;
  payoutId?: string;
  stripeAccountId?: string;
  stripeTransferId?: string;
  canTransferOnly?: boolean;

  // NEW: balance timing hint
  retryAfterSeconds?: number;
};

function isStripeMode(v: unknown): v is StripePayoutMode {
  return v === "AUTO_PAYOUT" || v === "TRANSFER_ONLY";
}

function isDeletedStripeAccount(acct: unknown): acct is { deleted: true } {
  return !!acct && typeof acct === "object" && (acct as { deleted?: unknown }).deleted === true;
}

/**
 * ===========
 * Balance helpers (Connected Account)
 * ===========
 */
type StripeBalanceItem = { amount: number; currency: string };

function pickPreferredAvailable(arr: StripeBalanceItem[] | null | undefined): StripeBalanceItem | null {
  if (!arr || arr.length === 0) return null;
  const eur = arr.find((x) => (x.currency || "").toLowerCase() === "eur");
  return eur ?? arr[0] ?? null;
}

async function getAvailableEurCents(stripe: Stripe, connectedAccountId: string): Promise<number> {
  const bal = await stripe.balance.retrieve({}, { stripeAccount: connectedAccountId });
  const pick = pickPreferredAvailable(bal.available as unknown as StripeBalanceItem[]);
  const currency = (pick?.currency ?? "eur").toLowerCase();
  if (currency !== "eur") return 0; // EUR-only currently
  return pick?.amount ?? 0;
}

function isInsufficientFundsError(e: unknown): boolean {
  const err = e as { code?: unknown; message?: unknown; raw?: { code?: unknown; message?: unknown } };
  const code = String(err?.code ?? err?.raw?.code ?? "");
  const msg = String(err?.message ?? err?.raw?.message ?? "").toLowerCase();
  return (
    code === "balance_insufficient" ||
    code === "insufficient_funds" ||
    msg.includes("insufficient") ||
    msg.includes("balance")
  );
}

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser().catch(() => null);
    if (!me) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const meId = me.id;

    // Parse optional body
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

    // Load user settings (Stripe only)
    const u = await prisma.user.findUnique({
      where: { id: meId },
      select: {
        payoutMethod: true,
        stripeAccountId: true,

        // cached onboarding flags (from webhook/account.updated or previous fallback)
        stripeDetailsSubmitted: true,
        stripePayoutsEnabled: true,
      },
    });

    // enforce method server-side
    if (u?.payoutMethod && u.payoutMethod !== "STRIPE_CONNECT") {
      await prisma.user.update({
        where: { id: meId },
        data: { payoutMethod: "STRIPE_CONNECT" },
      });
    }

    if (!u?.stripeAccountId) {
      return NextResponse.json({ error: "Stripe Connect ist nicht verbunden." }, { status: 400 });
    }

    const connectedAccountId = u.stripeAccountId;

    // helper: prefer cached flags, fallback to Stripe retrieve (and refresh cache)
    async function ensureAutoPayoutOk(): Promise<
      | { ok: true }
      | { ok: false; deleted?: boolean; canTransferOnly?: boolean; payload?: JsonErr; status?: number }
    > {
      let canAutoPayout = Boolean(u?.stripeDetailsSubmitted) && Boolean(u?.stripePayoutsEnabled);

      if (canAutoPayout) return { ok: true };

      const a = await stripe.accounts.retrieve(connectedAccountId);
      if (isDeletedStripeAccount(a)) {
        return { ok: false, deleted: true };
      }

      const acct = a as Stripe.Account;
      canAutoPayout = Boolean(acct.details_submitted) && Boolean(acct.payouts_enabled);

      // refresh cache so UI / next call won't be "false negative"
      await prisma.user.update({
        where: { id: meId },
        data: {
          stripeDetailsSubmitted: Boolean(acct.details_submitted),
          stripePayoutsEnabled: Boolean(acct.payouts_enabled),
          stripeOnboardingLastAt: new Date(),
        },
      });

      if (!canAutoPayout) {
        return {
          ok: false,
          canTransferOnly: true,
          status: 409,
          payload: {
            error: "Stripe Onboarding unvollständig (payouts nicht aktiviert).",
            code: "PAYOUTS_NOT_ENABLED",
            stripeAccountId: connectedAccountId,
            canTransferOnly: true,
          },
        };
      }

      return { ok: true };
    }

    // ---- finalize existing request ----
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

      if (!existing || existing.userId !== meId) {
        return NextResponse.json({ error: "PayoutRequest nicht gefunden." }, { status: 404 });
      }

      if (existing.method !== "STRIPE_CONNECT") {
        return NextResponse.json({ error: "payoutId kann nur für STRIPE_CONNECT verwendet werden." }, { status: 400 });
      }

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

      if (stripeMode === "TRANSFER_ONLY") {
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
                userId: meId,
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

      // AUTO_PAYOUT: ensure payouts enabled (cached-first, Stripe fallback)
      const gate = await ensureAutoPayoutOk();
      if (!gate.ok) {
        if (gate.deleted) {
          await prisma.payoutRequest.update({
            where: { id: existing.id },
            data: { status: "FAILED", failedReason: "Stripe Account ungültig.", processedAt: new Date() },
          });
          return NextResponse.json({ error: "Stripe Account ungültig." }, { status: 400 });
        }

        // 409 PAYOUTS_NOT_ENABLED (allow UI fallback to TRANSFER_ONLY)
        const payload: JsonErr = {
          ...(gate.payload ?? { error: "Stripe Onboarding unvollständig (payouts nicht aktiviert)." }),
          payoutId: existing.id,
          stripeAccountId: connectedAccountId,
          stripeTransferId: existing.stripeTransferId ?? undefined,
          canTransferOnly: true,
        };
        return NextResponse.json(payload, { status: gate.status ?? 409 });
      }

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
              userId: meId,
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

      // balance timing guard before creating payout
      const availableNow = await getAvailableEurCents(stripe, connectedAccountId);
      if (availableNow < existing.payoutCents) {
        const payload: JsonErr = {
          error:
            "Das Guthaben ist bei Stripe noch nicht verfügbar (pending). Bitte in Kürze erneut versuchen oder TRANSFER_ONLY wählen.",
          code: "BALANCE_PENDING",
          payoutId: existing.id,
          stripeAccountId: connectedAccountId,
          stripeTransferId: transferId ?? undefined,
          canTransferOnly: true,
          retryAfterSeconds: 10,
        };
        return NextResponse.json(payload, { status: 202 });
      }

      try {
        const payout = await stripe.payouts.create(
          {
            amount: existing.payoutCents,
            currency: "eur",
            method: "standard",
            metadata: {
              payoutRequestId: existing.id,
              userId: meId,
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
      } catch (e) {
        // If Stripe throws insufficient funds, treat it like BALANCE_PENDING
        if (isInsufficientFundsError(e)) {
          await prisma.payoutRequest.update({
            where: { id: existing.id },
            data: {
              status: "PROCESSING",
              failedReason: null,
              stripePayoutStatus: "balance_pending",
            },
          });

          const payload: JsonErr = {
            error:
              "Transfer wurde erstellt, aber das Guthaben ist bei Stripe noch nicht verfügbar. Bitte in Kürze erneut versuchen oder TRANSFER_ONLY wählen.",
            code: "BALANCE_PENDING",
            payoutId: existing.id,
            stripeAccountId: connectedAccountId,
            stripeTransferId: transferId ?? undefined,
            canTransferOnly: true,
            retryAfterSeconds: 10,
          };

          return NextResponse.json(payload, { status: 202 });
        }

        throw e;
      }
    }

    // ---- create new payout request ----
    const availablePayments = await prisma.payment.findMany({
      where: { payeeId: meId, status: "SUCCEEDED", payoutRequestId: null },
      select: { id: true, amountNetToDommeCents: true },
    });

    const availableCents = availablePayments.reduce((sum, p) => sum + (p.amountNetToDommeCents ?? 0), 0);

    if (availableCents <= 0) {
      return NextResponse.json({ error: "Kein auszahlbares Guthaben." }, { status: 400 });
    }

    const requestedCents = availableCents;
    const feeCents = 0; // Stripe-only
    const payoutCents = requestedCents - feeCents;

    if (payoutCents < MIN_PAYOUT_CENTS) {
      return NextResponse.json(
        {
          error: `Mindestbetrag €${(MIN_PAYOUT_CENTS / 100).toFixed(2)}.`,
          requestedCents,
          feeCents,
          payoutCents,
          method: "STRIPE_CONNECT",
        },
        { status: 400 }
      );
    }

    const destination = `Stripe Connect ${connectedAccountId}`;

    const payoutRequest = await prisma.payoutRequest.create({
      data: {
        userId: meId,
        amountCents: requestedCents,
        currency: "EUR",
        method: "STRIPE_CONNECT",
        destination,
        requestedCents,
        feeCents,
        payoutCents,
        feePayer: "USER",
        status: "PROCESSING",
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

    // Always do the transfer (works even when payouts aren't enabled)
    const transfer = await stripe.transfers.create(
      {
        amount: payoutCents,
        currency: "eur",
        destination: connectedAccountId,
        transfer_group: `payout_${payoutRequest.id}`,
        metadata: {
          payoutRequestId: payoutRequest.id,
          userId: meId,
          kind: "creator_transfer",
          stripeMode,
        },
      },
      { idempotencyKey: `payout_transfer_${payoutRequest.id}` }
    );

    await prisma.payoutRequest.update({
      where: { id: payoutRequest.id },
      data: { stripeTransferId: transfer.id },
    });

    // TRANSFER_ONLY: mark as paid immediately
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
        method: "STRIPE_CONNECT",
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

    // AUTO_PAYOUT: ensure payouts enabled (cached-first, Stripe fallback)
    const gate = await ensureAutoPayoutOk();
    if (!gate.ok) {
      if (gate.deleted) {
        await prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: { status: "FAILED", failedReason: "Stripe Account ungültig.", processedAt: new Date() },
        });
        return NextResponse.json({ error: "Stripe Account ungültig." }, { status: 400 });
      }

      // mark failed (same as your previous behavior)
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
        ...(gate.payload ?? { error: "Stripe Onboarding unvollständig (payouts nicht aktiviert)." }),
        payoutId: payoutRequest.id,
        stripeAccountId: connectedAccountId,
        stripeTransferId: transfer.id,
        canTransferOnly: true,
      };

      return NextResponse.json(payload, { status: gate.status ?? 409 });
    }

    // AUTO_PAYOUT: balance timing guard (transfer may still be pending)
    try {
      const availableNow = await getAvailableEurCents(stripe, connectedAccountId);

      if (availableNow < payoutCents) {
        // Funds not available yet -> keep request in PROCESSING and let client retry finalize later
        await prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: {
            status: "PROCESSING",
            failedReason: null,
            stripePayoutStatus: "balance_pending",
          },
        });

        const payload: JsonErr = {
          error:
            "Transfer wurde erstellt, aber das Guthaben ist bei Stripe noch nicht verfügbar. Bitte in Kürze erneut versuchen.",
          code: "BALANCE_PENDING",
          payoutId: payoutRequest.id,
          stripeAccountId: connectedAccountId,
          stripeTransferId: transfer.id,
          canTransferOnly: true,
          retryAfterSeconds: 10,
        };

        // 202 Accepted = “not done yet”
        return NextResponse.json(payload, { status: 202 });
      }

      // create connected payout (bank payout)
      const payout = await stripe.payouts.create(
        {
          amount: payoutCents,
          currency: "eur",
          method: "standard",
          metadata: {
            payoutRequestId: payoutRequest.id,
            userId: meId,
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
        method: "STRIPE_CONNECT",
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
    } catch (e) {
      // If stripe throws insufficient funds, treat it like BALANCE_PENDING instead of hard fail
      if (isInsufficientFundsError(e)) {
        await prisma.payoutRequest.update({
          where: { id: payoutRequest.id },
          data: {
            status: "PROCESSING",
            failedReason: null,
            stripePayoutStatus: "balance_pending",
          },
        });

        const payload: JsonErr = {
          error:
            "Transfer wurde erstellt, aber das Guthaben ist bei Stripe noch nicht verfügbar. Bitte in Kürze erneut versuchen.",
          code: "BALANCE_PENDING",
          payoutId: payoutRequest.id,
          stripeAccountId: connectedAccountId,
          stripeTransferId: transfer.id,
          canTransferOnly: true,
          retryAfterSeconds: 10,
        };

        return NextResponse.json(payload, { status: 202 });
      }

      throw e; // other errors should bubble to your catch -> 500
    }
  } catch (e) {
    console.error("POST /api/payout/request error:", e);
    return NextResponse.json({ error: "Auszahlung fehlgeschlagen" }, { status: 500 });
  }
}