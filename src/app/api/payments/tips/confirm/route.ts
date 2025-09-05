import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { segpayCharge } from '@/lib/segpay';

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
  if (payment.status !== 'CREATED' && payment.status !== 'PROCESSING') {
    return NextResponse.json({ ok: true }); // idempotent
  }

  // simulate/perform provider charge
  const charge = await segpayCharge({
    amountCents: payment.amountGrossCents,
    currency: payment.currency,
    orderId: payment.id,
  });
  if (!charge.ok) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED', updatedAt: new Date() },
    });
    return NextResponse.json({ ok: false, error: charge.error || 'Charge failed' }, { status: 400 });
  }

  // Update Payment & erfasse Provider-Fee
  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'SUCCEEDED',
      processorFeeCents: charge.providerFeeCents ?? 0,
      externalRef: charge.providerRef ?? null,
      updatedAt: new Date(),
    },
  });

  // Tip-Eintrag (NETTO für Domme, da Plattform-Fee abgezogen wird)
  await prisma.tip.create({
    data: {
      fromUserId: updated.payerId,
      toUserId: updated.payeeId,
      amountCents: updated.amountNetToDommeCents,
      currency: updated.currency,
      status: 'SUCCEEDED',
      // Note/Konversation könnten in einem echten Flow aus "create" übernommen werden.
      // Für MVP weglassen oder bei Bedarf mit eigener Tabelle verknüpfen.
    },
  });

  return NextResponse.json({ ok: true });
}
