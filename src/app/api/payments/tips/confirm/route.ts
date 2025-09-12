import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { segpayCharge } from '@/lib/segpay';

const TOPUP_PCT = 0.10;
const SPLIT_PCT = 0.10;

/** Struktur der Metadaten, die wir in Payment.metadataJson ablegen */
type TipPaymentMeta = {
  baseAmountCents?: number;
  note?: string | null;
  conversationId?: string | null;
};

/** Sichere, typisierte Extraktion aus unknown (vermeidet `any`) */
function parseMeta(input: unknown): TipPaymentMeta {
  const out: TipPaymentMeta = {};
  if (!input || typeof input !== 'object') return out;
  const obj = input as Record<string, unknown>;

  const bac = obj.baseAmountCents;
  if (typeof bac === 'number' && Number.isFinite(bac)) {
    out.baseAmountCents = Math.round(bac);
  }

  const note = obj.note;
  if (typeof note === 'string') out.note = note;
  else if (note === null) out.note = null;

  const cid = obj.conversationId;
  if (typeof cid === 'string') out.conversationId = cid;
  else if (cid === null) out.conversationId = null;

  return out;
}

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

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { paymentId?: string };
  const paymentId = String(body.paymentId || '');
  if (!paymentId) return NextResponse.json({ ok: false, error: 'paymentId missing' }, { status: 400 });

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.payerId !== me.id) {
    return NextResponse.json({ ok: false, error: 'Payment not found' }, { status: 404 });
  }

  const meta = parseMeta(payment.metadataJson);

  // Idempotenz
  if (payment.status === 'SUCCEEDED') {
    const gross = payment.amountGrossCents;
    const base = meta.baseAmountCents ?? inferBaseFromGross(gross);
    return NextResponse.json({
      ok: true,
      baseAmountCents: base,
      totalCents: gross,
      currency: payment.currency,
    });
  }
  if (payment.status !== 'CREATED' && payment.status !== 'PROCESSING') {
    return NextResponse.json({ ok: true });
  }

  // Werte aus metadataJson (mit Fallbacks)
  const baseAmountCents = meta.baseAmountCents ?? inferBaseFromGross(payment.amountGrossCents);
  const note = meta.note ?? null;
  const conversationId = meta.conversationId ?? null;

  // Nachrechnen (konsistent mit /create)
  const topup = Math.round(baseAmountCents * TOPUP_PCT);
  const split = Math.round(baseAmountCents * SPLIT_PCT);
  const platformFeeTotal = topup + split;
  const gross = baseAmountCents + topup;

  // Charge
  const charge = await segpayCharge({
    amountCents: gross,
    currency: payment.currency,
    orderId: payment.id,
  });

  if (!charge.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ ok: false, error: charge.error || 'Charge failed' }, { status: 400 });
  }

  const processorFee = charge.providerFeeCents ?? 0;

  // Payment aktualisieren (Admin-Reporting konsistent)
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCEEDED',
      platformFeeCents: platformFeeTotal,
      processorFeeCents: processorFee,
      externalRef: charge.providerRef ?? null,
      amountGrossCents: gross,                        // Sub zahlte base + topup
      amountNetToDommeCents: baseAmountCents - split, // Domme netto (für spätere Payouts)
    },
  });

  // Tip-Row (Domme sieht BASISbetrag), inkl. note & conversationId
  await prisma.tip.create({
    data: {
      fromUserId: updated.payerId,
      toUserId: updated.payeeId,
      amountCents: baseAmountCents,
      currency: updated.currency,
      status: 'SUCCEEDED',
      note,
      conversationId,
      methodRef: updated.externalRef ?? undefined,
    },
  });

  return NextResponse.json({
    ok: true,
    baseAmountCents,
    totalCents: gross,
    currency: updated.currency,
  });
}
