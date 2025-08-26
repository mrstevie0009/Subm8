// src/app/api/tips/create/route.ts
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

type Body = {
  toUserId: string;
  amountCents: number;        // Nettobetrag für Domme (ohne Plattformgebühr)
  note?: string;
  conversationId?: string;
  currency?: string;          // optional, default "EUR"
};

const MIN = 100;              // 1,00 €
const MAX = 1_000_000;        // 10.000,00 €
const PLATFORM_RATE = 0.10;   // 10%

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const body = (await req.json()) as Body;
    const toUserId = String(body.toUserId || '');
    const amountCents = Math.floor(Number(body.amountCents || 0));
    const note = (body.note || '').trim().slice(0, 200);
    const currency = (body.currency || 'EUR').toUpperCase();
    const conversationId = body.conversationId ? String(body.conversationId) : undefined;

    // Validation
    if (!toUserId) return Response.json({ ok: false, error: 'Missing toUserId' }, { status: 400 });
    if (!Number.isFinite(amountCents) || amountCents < MIN || amountCents > MAX) {
      return Response.json({ ok: false, error: 'Invalid amount' }, { status: 400 });
    }
    if (toUserId === me.id) {
      return Response.json({ ok: false, error: 'Self tipping is not allowed' }, { status: 400 });
    }

    // Rollen prüfen (Sub -> Domme)
    const [fromUser, toUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: me.id }, select: { id: true, role: true } }),
      prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, role: true } }),
    ]);
    if (!fromUser || !toUser) {
      return Response.json({ ok: false, error: 'User not found' }, { status: 404 });
    }
    if (String(fromUser.role) !== 'SUBMISSIVE' || String(toUser.role) !== 'DOMME') {
      return Response.json({ ok: false, error: 'Roles not permitted for tipping' }, { status: 400 });
    }

    const platformFeeCents = Math.round(amountCents * PLATFORM_RATE);
    const totalCents = amountCents + platformFeeCents;

    const now = new Date();
    const paymentId = randomUUID();

    const result = await prisma.$transaction(async (tx) => {
      // Payment anlegen (MVP: direkt SUCCEEDED)
      const payment = await tx.payment.create({
        data: {
          id: paymentId,
          payerId: fromUser.id,
          payeeId: toUser.id,
          amountGrossCents: totalCents,
          amountNetToDommeCents: amountCents,
          platformFeeCents,
          currency,
          status: 'SUCCEEDED',
          updatedAt: now,
        },
        select: { id: true },
      });

      // Tip-Record (History)
      const tip = await tx.tip.create({
        data: {
          fromUserId: fromUser.id,
          toUserId: toUser.id,
          amountCents: amountCents,
          currency,
          status: 'SUCCEEDED',
          note: note || null,
          conversationId: conversationId || null,
        },
        select: { id: true },
      });

      // Ledger (Double-Entry)
      await tx.ledger.createMany({
        data: [
          {
            id: randomUUID(),
            paymentId: payment.id,
            entryType: 'DEBIT',
            account: 'SUB_CASH',
            amountCents: totalCents,
            currency,
          },
          {
            id: randomUUID(),
            paymentId: payment.id,
            entryType: 'CREDIT',
            account: 'DOMME_WALLET',
            amountCents: amountCents,
            currency,
          },
          {
            id: randomUUID(),
            paymentId: payment.id,
            entryType: 'CREDIT',
            account: 'PLATFORM_WALLET',
            amountCents: platformFeeCents,
            currency,
          },
        ],
      });

      // Domme-Wallet hochzählen
      await tx.wallet.upsert({
        where: { userId: toUser.id },
        create: { userId: toUser.id, balanceCents: amountCents, updatedAt: now },
        update: { balanceCents: { increment: amountCents }, updatedAt: now },
      });

      return { paymentId: payment.id, tipId: tip.id };
    });

    return Response.json({
      ok: true,
      ...result,
      amounts: {
        dommeNetCents: amountCents,
        platformFeeCents,
        totalCents,
        currency,
      },
    });
  } catch (e) {
    console.error('POST /api/tips/create failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
