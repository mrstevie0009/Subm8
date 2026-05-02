// src/lib/budget.ts
import { prisma } from '@/lib/prisma';

export type BudgetCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type BudgetAction = 'BLOCK' | 'WARN' | 'NOTIFY';

export type BudgetStatus = {
  amountCents: number | null;
  cadence: BudgetCadence | null;
  action: BudgetAction;
  spentCents: number;
  periodStart: Date | null;
  percentUsed: number;      // 0–100+
  isOver: boolean;
  remainingCents: number;   // kann negativ sein wenn over
};

/** Berechnet das Ende einer Periode */
function periodEnd(start: Date, cadence: BudgetCadence): Date {
  const d = new Date(start);
  if (cadence === 'DAILY')   d.setDate(d.getDate() + 1);
  if (cadence === 'WEEKLY')  d.setDate(d.getDate() + 7);
  if (cadence === 'MONTHLY') d.setMonth(d.getMonth() + 1);
  return d;
}

/** Prüft ob eine neue Periode beginnen soll */
function shouldReset(periodStart: Date | null, cadence: BudgetCadence): boolean {
  if (!periodStart) return true;
  return new Date() >= periodEnd(periodStart, cadence);
}

/**
 * Liest den Budget-Status eines Users (mit Lazy-Reset).
 * Gibt null zurück wenn kein Budget gesetzt.
 */
export async function getBudgetStatus(userId: string): Promise<BudgetStatus | null> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      budgetAmountCents: true,
      budgetCadence: true,
      budgetAction: true,
      budgetPeriodStart: true,
      budgetSpentCents: true,
    },
  });

  if (!u || !u.budgetAmountCents || !u.budgetCadence) return null;

  const cadence = u.budgetCadence as BudgetCadence;
  const action = (u.budgetAction ?? 'WARN') as BudgetAction;

  // Lazy reset: wenn Periode abgelaufen
  let spentCents = u.budgetSpentCents ?? 0;
  let periodStart = u.budgetPeriodStart;

  if (shouldReset(periodStart, cadence)) {
    const now = new Date();
    await prisma.user.update({
      where: { id: userId },
      data: { budgetSpentCents: 0, budgetPeriodStart: now },
    });
    spentCents = 0;
    periodStart = now;
  }

  const percentUsed = Math.round((spentCents / u.budgetAmountCents) * 100);
  const isOver = spentCents >= u.budgetAmountCents;
  const remainingCents = u.budgetAmountCents - spentCents;

  return {
    amountCents: u.budgetAmountCents,
    cadence,
    action,
    spentCents,
    periodStart,
    percentUsed,
    isOver,
    remainingCents,
  };
}

/**
 * Bucht einen Betrag auf das Budget des Subs.
 * Wird nach erfolgreichem Payment aufgerufen.
 * Tut nichts wenn kein Budget gesetzt.
 */
export async function recordBudgetSpend(userId: string, amountCents: number): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      budgetAmountCents: true,
      budgetCadence: true,
      budgetPeriodStart: true,
      budgetSpentCents: true,
    },
  });

  if (!u?.budgetAmountCents || !u.budgetCadence) return;

  const cadence = u.budgetCadence as BudgetCadence;
  const now = new Date();

  // Reset falls nötig, dann addieren
  const needsReset = shouldReset(u.budgetPeriodStart, cadence);
  const newSpent = needsReset ? amountCents : (u.budgetSpentCents ?? 0) + amountCents;

  await prisma.user.update({
    where: { id: userId },
    data: {
      budgetSpentCents: newSpent,
      ...(needsReset ? { budgetPeriodStart: now } : {}),
    },
  });
}