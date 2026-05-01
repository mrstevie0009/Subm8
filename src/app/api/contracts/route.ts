//src/app/api/contracts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { applyDueInterestForContract, daysUntil, nextMonthlyInterestDate } from '@/lib/contracts';

export const runtime = 'nodejs';

type Body = {
  type?: 'debt' | 'blackmail';
  counterpartyId?: string;
  totalCents?: number;
  interestPct?: number;
  moneyDirection?: 'selectedUserPaysViewer' | 'viewerPaysSelectedUser';
  blackmailInfo?: unknown;
};

function mapType(t: string) {
  return t === 'BLACKMAIL' ? 'blackmail' : 'debt';
}

function mapStatus(s: string) {
  if (s === 'PAUSED') return 'paused';
  return 'active';
}

function eventLabel(type: string) {
  switch (type) {
    case 'CREATED': return 'Contract created';
    case 'TOTAL_CHANGED': return 'Amount changed';
    case 'MANUAL_PAYMENT': return 'External tip payment';
    case 'TIP_PAYMENT': return 'Debt payment';
    case 'AUTODRAIN_PAYMENT': return 'Autodrain payment';
    case 'INTEREST_APPLIED': return 'Interest';
    case 'INFO_UPDATED': return 'Blackmail info updated';
    case 'PRIVATE_MEDIA_ADDED': return 'Private media added';
    case 'PAUSED': return 'Contract paused';
    case 'DELETED': return 'Contract deleted';
    default: return type;
  }
}

export async function GET() {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const due = await prisma.contract.findMany({
    where: {
      status: 'ACTIVE',
      nextInterestAt: { lte: new Date() },
      OR: [{ ownerId: me.id }, { counterpartyId: me.id }],
    },
    select: { id: true },
    take: 20,
  });

  await Promise.all(due.map((c) => applyDueInterestForContract(c.id)));

  const rows = await prisma.contract.findMany({
    where: {
      status: { not: 'DELETED' },
      OR: [{ ownerId: me.id }, { counterpartyId: me.id }],
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      owner: {
        select: { id: true, handle: true, displayName: true, avatarUrl: true },
      },
      counterparty: {
        select: { id: true, handle: true, displayName: true, avatarUrl: true },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 100,
      },
      media: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          filename: true,
          mimeType: true,
          kind: true,
          sizeBytes: true,
          createdAt: true,
        },
      },
    },
  });

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const contracts = await Promise.all(rows.map(async (c) => {
    const other = c.ownerId === me.id ? c.counterparty : c.owner;
    const viewerCanManage = c.ownerId === me.id;

    // Payments aus ContractEvents extrahieren für 30-Tage-Splitting
    const paymentEvents = c.events.filter(
      (e) => e.type === 'TIP_PAYMENT' || e.type === 'AUTODRAIN_PAYMENT'
    );
    const paymentIds = paymentEvents
      .map((e) => e.paymentId)
      .filter((id): id is string => Boolean(id));

    let unlockedPaidCents = 0;
    let lockedPaidCents = 0;

    if (paymentIds.length > 0) {
      const payments = await prisma.payment.findMany({
        where: { id: { in: paymentIds }, status: 'SUCCEEDED' },
        select: { amountNetToDommeCents: true, createdAt: true },
      });

      for (const p of payments) {
        if (p.createdAt <= cutoff) {
          unlockedPaidCents += p.amountNetToDommeCents;
        } else {
          lockedPaidCents += p.amountNetToDommeCents;
        }
      }
    }

    // Manuelle Payments (off-platform) zählen immer als unlocked
    const manualCents = c.events
      .filter((e) => e.type === 'MANUAL_PAYMENT')
      .reduce((sum, e) => sum + e.amountCents, 0);
    unlockedPaidCents += manualCents;

    return {
      id: c.id,
      type: mapType(c.type),
      status: mapStatus(c.status),
      user: other,
      totalCents: c.totalCents,
      paidCents: c.paidCents,
      unlockedPaidCents,
      lockedPaidCents,
      interestPct: c.interestPctMonthly,
      nextInterestDays: daysUntil(c.nextInterestAt),
      createdAt: c.createdAt.toISOString(),
      history: c.events.map((e) => ({
        id: e.id,
        date: e.createdAt.toLocaleDateString(),
        type: eventLabel(e.type),
        amountCents: e.amountCents,
      })),
      blackmailInfo:
        (c.ownerId === me.id || c.counterpartyId === me.id)
          ? (c.blackmailInfoJson ?? undefined)
          : undefined,
      media: c.media,
      moneyDirection: viewerCanManage ? 'selectedUserPaysViewer' : 'viewerPaysSelectedUser',
      viewerCanManage,
    };
  }));

  return NextResponse.json({ ok: true, contracts });
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Body;

  const counterpartyId = String(body.counterpartyId || '');
  const totalCents = Math.round(Number(body.totalCents || 0));
  const interestPct = Math.max(0, Math.round(Number(body.interestPct || 0)));
  const type = body.type === 'blackmail' ? 'BLACKMAIL' : 'DEBT';

  if (!counterpartyId || counterpartyId === me.id || totalCents <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });
  }

  const ownerId =
    body.moneyDirection === 'viewerPaysSelectedUser'
      ? counterpartyId
      : me.id;

  const realCounterpartyId =
    body.moneyDirection === 'viewerPaysSelectedUser'
      ? me.id
      : counterpartyId;

  if (ownerId !== me.id) {
    return NextResponse.json(
      { ok: false, error: 'Only receiver can create/manage this contract for now' },
      { status: 403 }
    );
  }

  const nextInterestAt = nextMonthlyInterestDate(new Date(), 1);

  const contract = await prisma.$transaction(async (tx) => {
    const c = await tx.contract.create({
      data: {
        type,
        ownerId,
        counterpartyId: realCounterpartyId,
        totalCents,
        paidCents: 0,
        interestPctMonthly: interestPct,
        interestAnchorDay: 1,
        nextInterestAt,
        blackmailInfoJson: type === 'BLACKMAIL' ? (body.blackmailInfo as object) : undefined,
      },
    });

    await tx.contractEvent.create({
      data: {
        contractId: c.id,
        actorId: me.id,
        type: 'CREATED',
        amountCents: 0,
      },
    });

    return c;
  });

  return NextResponse.json({ ok: true, id: contract.id });
}