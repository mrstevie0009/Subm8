//src/app/api/contracts/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { assertContractAccess } from '@/lib/contracts';

export const runtime = 'nodejs';

type Body = {
  action?: 'change_amount' | 'pause' | 'delete' | 'update_blackmail';
  totalCents?: number;
  externalTipCents?: number;
  blackmailInfo?: unknown;
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Body;

  const contract = await assertContractAccess(id, me.id);
  if (!contract) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const canManage = contract.ownerId === me.id;
  if (!canManage) return NextResponse.json({ ok: false, error: 'Only owner can manage' }, { status: 403 });

  if (body.action === 'change_amount') {
    const externalTipCents = Math.max(0, Math.round(Number(body.externalTipCents || 0)));
    const requestedTotal = Math.max(0, Math.round(Number(body.totalCents || 0)));

    await prisma.$transaction(async (tx) => {
      const fresh = await tx.contract.findUniqueOrThrow({ where: { id } });

      const nextPaid = fresh.paidCents + externalTipCents;
      const nextTotal = Math.max(nextPaid, requestedTotal);
      const delta = nextTotal - fresh.totalCents;

      await tx.contract.update({
        where: { id },
        data: {
          totalCents: nextTotal,
          paidCents: nextPaid,
        },
      });

      if (externalTipCents > 0) {
        await tx.contractEvent.create({
          data: {
            contractId: id,
            actorId: me.id,
            type: 'MANUAL_PAYMENT',
            amountCents: externalTipCents,
          },
        });
      }

      if (delta !== 0) {
        await tx.contractEvent.create({
          data: {
            contractId: id,
            actorId: me.id,
            type: 'TOTAL_CHANGED',
            amountCents: delta,
          },
        });
      }
    });

    return NextResponse.json({ ok: true });
  }

   if (body.action === 'update_blackmail') {
    // Nur für Blackmail-Contracts erlaubt
    if (contract.type !== 'BLACKMAIL') {
      return NextResponse.json({ ok: false, error: 'Not a blackmail contract' }, { status: 400 });
    }

    const fresh = await prisma.contract.findUniqueOrThrow({
      where: { id },
      select: { blackmailInfoJson: true, ownerId: true },
    });

    const isOwner = fresh.ownerId === me.id;
    const incoming = body.blackmailInfo as Record<string, Record<string, string>> | null;

    let nextInfo: Record<string, Record<string, string>>;

    if (isOwner) {
      // Owner (Domme/Receiver) darf alles überschreiben
      nextInfo = (incoming ?? {}) as Record<string, Record<string, string>>;
    } else {
      // Counterparty (Sub/Payer) darf nur neue Felder/Werte HINZUFÜGEN, niemals bestehende überschreiben oder löschen
      const existing =
        (fresh.blackmailInfoJson as Record<string, Record<string, string>> | null) ?? {};

      const sections = ['personal', 'work', 'closePerson'] as const;
      nextInfo = {} as Record<string, Record<string, string>>;

      for (const section of sections) {
        const existingSection = existing[section] ?? {};
        const incomingSection = incoming?.[section] ?? {};

        const merged: Record<string, string> = { ...existingSection };

        for (const [key, value] of Object.entries(incomingSection)) {
          // Nur hinzufügen wenn Feld noch nicht existiert oder leer war
          if (!merged[key] || merged[key].trim() === '') {
            merged[key] = value;
          }
          // Bestehende Werte werden NICHT überschrieben
        }

        nextInfo[section] = merged;
      }
    }

    await prisma.$transaction([
      prisma.contract.update({
        where: { id },
        data: { blackmailInfoJson: nextInfo },
      }),
      prisma.contractEvent.create({
        data: {
          contractId: id,
          actorId: me.id,
          type: 'INFO_UPDATED',
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  if (body.action === 'pause') {
    await prisma.$transaction([
      prisma.contract.update({
        where: { id },
        data: { status: 'PAUSED' },
      }),
      prisma.contractEvent.create({
        data: {
          contractId: id,
          actorId: me.id,
          type: 'PAUSED',
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  if (body.action === 'delete') {
    await prisma.$transaction([
      prisma.contract.update({
        where: { id },
        data: { status: 'DELETED' },
      }),
      prisma.contractEvent.create({
        data: {
          contractId: id,
          actorId: me.id,
          type: 'DELETED',
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false, error: 'Invalid action' }, { status: 400 });
}