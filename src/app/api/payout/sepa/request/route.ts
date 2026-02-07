// src/app/api/payout/sepa/request/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { prisma } from '@/lib/prisma';

const MIN_PAYOUT_CENTS = 1000; // €10 minimum

export async function POST() {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: me.id },
      select: {
        payoutIban: true,
        payoutAccountHolder: true,
        payoutBic: true,
      },
    });

    if (!user?.payoutIban || !user?.payoutAccountHolder) {
      return NextResponse.json({ error: 'IBAN/Kontoinhaber fehlt' }, { status: 400 });
    }

    // Calculate available balance (payments without payout)
    const availablePayments = await prisma.payment.findMany({
      where: {
        payeeId: me.id,
        status: 'SUCCEEDED',
        payoutRequestId: null,
      },
      select: {
        id: true,
        amountNetToDommeCents: true,
      },
    });

    const availableCents = availablePayments.reduce(
      (sum, p) => sum + (p.amountNetToDommeCents || 0), 
      0
    );

    if (availableCents < MIN_PAYOUT_CENTS) {
      return NextResponse.json({ 
        error: `Mindestbetrag: €${MIN_PAYOUT_CENTS / 100}` 
      }, { status: 400 });
    }

    // Create payout request
    const payoutRequest = await prisma.sepaPayoutRequest.create({
      data: {
        userId: me.id,
        amountCents: availableCents,
        currency: 'EUR',
        iban: user.payoutIban,
        accountHolder: user.payoutAccountHolder,
        bic: user.payoutBic,
        status: 'PENDING',
      },
    });

    // Link payments to payout
    await prisma.payment.updateMany({
      where: {
        id: { in: availablePayments.map((p) => p.id) },
      },
      data: {
        payoutRequestId: payoutRequest.id,
      },
    });

    return NextResponse.json({ 
      ok: true, 
      payoutId: payoutRequest.id, 
      amountCents: availableCents 
    });
  } catch (error) {
    console.error('Payout request error:', error);
    return NextResponse.json({ error: 'Auszahlung fehlgeschlagen' }, { status: 500 });
  }
}