//src/app/api/autodrain/accept/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { addCadence } from '@/lib/autodrain';

export const dynamic = 'force-dynamic';

type Body = {
  toUserId: string; // Domme
  amountCents: number;
  currency: string;
  cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  conversationId?: string; // <-- optional gemacht
};

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const body = (await req.json().catch(() => null)) as Body | null;
    if (!body) return Response.json({ ok: false, error: 'Bad request' }, { status: 400 });

    const { toUserId, amountCents, currency, cadence, conversationId } = body;

    // Basis-Checks (ohne conversationId)
    if (!toUserId || !amountCents || !currency || !cadence) {
      return Response.json({ ok: false, error: 'Missing fields' }, { status: 400 });
    }
    if (toUserId === me.id) {
      return Response.json({ ok: false, error: 'Cannot enable autodrain to yourself' }, { status: 400 });
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return Response.json({ ok: false, error: 'Invalid amount' }, { status: 400 });
    }
    if (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(cadence)) {
      return Response.json({ ok: false, error: 'Invalid cadence' }, { status: 400 });
    }

    // --- Gespräch & Rollen ermitteln ---
    let dommeId: string | null = null;
    let subId: string | null = null;

    if (conversationId) {
      // exakter Match wie vorher
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
      if (!convo) {
        return Response.json({ ok: false, error: 'Conversation mismatch' }, { status: 403 });
      }
      dommeId = convo.dommeId;
      subId = convo.subId;
    } else {
      // Kein conversationId: versuche existierende Konvo zu finden …
      const existingConvo = await prisma.conversation.findFirst({
        where: {
          OR: [
            { dommeId: toUserId, subId: me.id },
            { dommeId: me.id, subId: toUserId },
          ],
        },
        select: { id: true, dommeId: true, subId: true },
      });

      if (existingConvo) {
        dommeId = existingConvo.dommeId;
        subId = existingConvo.subId;
      } else {
        // … oder fallback: weise Rollen logisch zu (toUser ist Domme, ich bin Sub)
        dommeId = toUserId;
        subId = me.id;
      }
    }

    // Nur der Sub darf aktivieren
    if (me.id !== subId) {
      return Response.json({ ok: false, error: 'Only the submissive can enable autodrain' }, { status: 403 });
    }

    // Gleiches aktives Abo schon vorhanden? -> reuse
    const existing = await prisma.autoDrainSubscription.findFirst({
      where: { dommeId: dommeId!, subId: subId!, active: true, amountCents, currency, cadence },
    });
    if (existing) {
      return Response.json({ ok: true, id: existing.id, nextChargeAt: existing.nextChargeAt.toISOString() });
    }

    const now = new Date();
    const next = addCadence(now, cadence);

    const sub = await prisma.autoDrainSubscription.create({
      data: {
        dommeId: dommeId!,
        subId: subId!,
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
