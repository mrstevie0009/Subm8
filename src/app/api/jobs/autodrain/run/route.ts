// src/app/api/jobs/autodrain/run/route.ts
import { prisma } from '@/lib/prisma';
import { addCadence } from '@/lib/autodrain';
import { randomUUID } from 'node:crypto';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { ok: false, error: "Disabled in production" },
      { status: 403 }
    );
  }

  try {
    const now = new Date();

    // max 100 fällige Subscriptions pro Lauf
    const subs = await prisma.autoDrainSubscription.findMany({
      where: { active: true, nextChargeAt: { lte: now } },
      take: 100,
      orderBy: { nextChargeAt: 'asc' },
      select: { id: true, dommeId: true, subId: true, amountCents: true, currency: true, cadence: true, nextChargeAt: true },
    });

    let processed = 0;

    for (const s of subs) {
      // 1) „Zahlung“ simulieren
      const receipt = `demo_${randomUUID()}`;
      const charge = await prisma.autoDrainCharge.create({
        data: {
          subscriptionId: s.id,
          amountCents: s.amountCents,
          currency: s.currency,
          status: 'SUCCESS',
          receiptId: receipt,
        },
        select: { id: true, at: true },
      });

      // 2) Nächste Fälligkeit berechnen (vom geplanten nextChargeAt aus)
      const next = addCadence(s.nextChargeAt ?? now, s.cadence);

      await prisma.autoDrainSubscription.update({
        where: { id: s.id },
        data: { lastChargeAt: charge.at, nextChargeAt: next },
      });

      // 3) Gespräch finden und Systemnachricht posten (als Domme-Autor)
      const convo = await prisma.conversation.findFirst({
        where: {
          dommeId: s.dommeId,
          subId: s.subId,
        },
        select: { id: true },
      });

      if (convo) {
        const payload = {
          id: charge.id,
          amountCents: s.amountCents,
          currency: s.currency,
          cadence: s.cadence,
          at: charge.at.toISOString(),
          receiptId: receipt,
          nextChargeAt: next.toISOString(),
        };
        await prisma.message.create({
          data: {
            conversationId: convo.id,
            authorId: s.dommeId, // wirkt, als käme es „vom Domme“
            text: `ADCHG::${JSON.stringify(payload)}`,
          },
        });
      }

      processed++;
    }

    return Response.json({ ok: true, processed });
  } catch (e) {
    console.error('GET /api/jobs/autodrain/run failed', e);
    return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
