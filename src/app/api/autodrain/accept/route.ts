// src/app/api/autodrain/accept/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { addCadence } from '@/lib/autodrain';

export const dynamic = 'force-dynamic';

type Body = {
  toUserId: string; // Domme
  amountCents: number;
  currency: string;
  cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  conversationId: string;
};

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return Response.json({ ok: false, error: 'Bad request' }, { status: 400 });

    const { toUserId, amountCents, currency, cadence, conversationId } = body;

    // Sicherheitschecks
    if (!toUserId || !amountCents || !currency || !cadence || !conversationId) {
      return Response.json({ ok: false, error: 'Missing fields' }, { status: 400 });
    }

    // Gespräch muss zwischen den beiden existieren
    const convo = await prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { dommeId: toUserId, subId: me.id },
          { dommeId: me.id, subId: toUserId },
        ],
      },
      select: { id: true, dommeId: true, subId: true },
    });
    if (!convo) return Response.json({ ok: false, error: 'Conversation mismatch' }, { status: 403 });

    // Wer ist sub / domme in diesem Fall?
    const dommeId = convo.dommeId;
    const subId = convo.subId;

    // Nur der Sub darf aktivieren
    if (me.id !== subId) {
      return Response.json({ ok: false, error: 'Only the submissive can enable autodrain' }, { status: 403 });
    }

    // Exists? – falls gleiches aktives Abo schon existiert, re-use
    const existing = await prisma.autoDrainSubscription.findFirst({
      where: { dommeId, subId, active: true, amountCents, currency, cadence },
    });
    if (existing) {
      return Response.json({ ok: true, id: existing.id, nextChargeAt: existing.nextChargeAt.toISOString() });
    }

    const now = new Date();
    const next = addCadence(now, cadence);

    const sub = await prisma.autoDrainSubscription.create({
      data: {
        dommeId,
        subId,
        amountCents,
        currency,
        cadence,
        nextChargeAt: next,
        lastChargeAt: null,
        active: true,
      },
      select: { id: true, nextChargeAt: true },
    });

    return Response.json({ ok: true, id: sub.id, nextChargeAt: sub.nextChargeAt.toISOString() });
  } catch (e) {
    console.error('POST /api/autodrain/accept failed', e);
    return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
