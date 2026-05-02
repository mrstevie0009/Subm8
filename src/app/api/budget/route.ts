// src/app/api/budget/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { prisma } from '@/lib/prisma';
import { getBudgetStatus } from '@/lib/budget';
import type { BudgetCadence, BudgetAction } from '@/lib/budget';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const status = await getBudgetStatus(me.id);
  return NextResponse.json({ ok: true, budget: status });
}

export async function PATCH(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => ({}));

  const amountCents =
    body.amountCents === null || body.amountCents === undefined
      ? null
      : Math.max(0, Math.round(Number(body.amountCents)));
  const cadence =
    ['DAILY', 'WEEKLY', 'MONTHLY'].includes(body.cadence) ? (body.cadence as BudgetCadence) : null;
  const action =
    ['BLOCK', 'WARN', 'NOTIFY'].includes(body.action) ? (body.action as BudgetAction) : 'WARN';

  await prisma.user.update({
    where: { id: me.id },
    data: {
      budgetAmountCents: amountCents,
      budgetCadence: cadence,
      budgetAction: action,
      // Reset der Periode beim Speichern
      budgetPeriodStart: amountCents ? new Date() : null,
      budgetSpentCents: 0,
    },
  });

  return NextResponse.json({ ok: true });
}