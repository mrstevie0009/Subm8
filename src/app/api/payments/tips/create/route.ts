import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'node:crypto';

const CURRENCY = 'EUR';
const TOPUP_PCT = 0.10; // 10% on top (Sub zahlt extra)
const SPLIT_PCT = 0.10; // 10% vom Basisbetrag (Domme-Seite)

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    toUserId?: string;
    amountCents?: number;   // Basisbetrag, den die Domme will (z.B. 5000 = 50,00 €)
    note?: string;
    conversationId?: string;
  };

  const toUserId = String(body.toUserId || '');
  const baseAmountCents = Math.round(Number(body.amountCents || 0));
  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : undefined;
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;

  if (!toUserId || !Number.isFinite(baseAmountCents) || baseAmountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });
  }

  const payee = await prisma.user.findUnique({
    where: { id: toUserId },
    select: { id: true },
  });
  if (!payee) {
    return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
  }

  // Gebühren
  const topupCents = Math.round(baseAmountCents * TOPUP_PCT); // zahlt der Sub zusätzlich
  const splitCents = Math.round(baseAmountCents * SPLIT_PCT); // vom Domme-Basisbetrag
  const grossCents = baseAmountCents + topupCents;            // was insgesamt abgebucht wird
  const amountNetToDommeCents = baseAmountCents - splitCents; // Netto für Domme
  const platformFeeCents = topupCents + splitCents;           // Gesamte Plattformgebühr (Admin)

  // Falls Payment.id kein default hat
  const id = randomUUID();

  // note + conversationId + base in metadataJson ablegen, damit /confirm sie hat
  const metadata = {
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
      platformFeeCents,       // = topup + split
      processorFeeCents: 0,   // kommt bei confirm
      vatAmountCents: 0,      // VAT fällt weg
      currency: CURRENCY,
      status: 'CREATED',
      externalRef: null,
      // paymentProvider default "Segpay"
      metadataJson: metadata,
      // buyerCountry/buyerIp/cardBin optional -> lassen wir leer
      // createdAt default, updatedAt @updatedAt
    },
  });

  return NextResponse.json({
    ok: true,
    paymentId: id,
    currency: CURRENCY,
    totalCents: grossCents, // informativ; maßgeblich ist /confirm
  });
}
