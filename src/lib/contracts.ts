import { prisma } from '@/lib/prisma';

export function nextMonthlyInterestDate(from = new Date(), anchorDay = 1) {
  const d = new Date(from);
  const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), anchorDay, 0, 0, 0));

  if (next <= d) {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }

  return next;
}

export function daysUntil(date?: Date | null) {
  if (!date) return 0;
  const ms = date.getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export async function assertContractAccess(contractId: string, userId: string) {
  return prisma.contract.findFirst({
    where: {
      id: contractId,
      status: { not: 'DELETED' },
      OR: [{ ownerId: userId }, { counterpartyId: userId }],
    },
  });
}

export async function applyDueInterestForContract(contractId: string) {
  const now = new Date();

  const c = await prisma.contract.findUnique({
    where: { id: contractId },
  });

  if (!c || c.status !== 'ACTIVE') return;

  if (!c.nextInterestAt || c.nextInterestAt > now) return;
  if (c.interestPctMonthly <= 0) return;

  const leftCents = Math.max(0, c.totalCents - c.paidCents);
  if (leftCents <= 0) return;

  const interestCents = Math.round(leftCents * (c.interestPctMonthly / 100));
  if (interestCents <= 0) return;

  const next = nextMonthlyInterestDate(now, c.interestAnchorDay);

  await prisma.$transaction([
    prisma.contract.update({
      where: { id: c.id },
      data: {
        totalCents: { increment: interestCents },
        lastInterestAt: now,
        nextInterestAt: next,
      },
    }),
    prisma.contractEvent.create({
      data: {
        contractId: c.id,
        actorId: null,
        type: 'INTEREST_APPLIED',
        amountCents: interestCents,
        note: `${c.interestPctMonthly}% monthly interest`,
      },
    }),
  ]);
}

//Verknüpft ein Payment mit dem passenden Contract und bucht paidCents
export async function linkPaymentToContract(
  payerId: string,
  payeeId: string,
  amountNetCents: number,
  paymentId: string,
  eventType: 'TIP_PAYMENT' | 'AUTODRAIN_PAYMENT' = 'TIP_PAYMENT'
) {
  const contract = await prisma.contract.findFirst({
    where: {
      status: 'ACTIVE',
      ownerId: payeeId,
      counterpartyId: payerId,
    },
  });

  if (!contract) return null;

  const next = Math.min(contract.paidCents + amountNetCents, contract.totalCents);

  await prisma.$transaction([
    prisma.contract.update({
      where: { id: contract.id },
      data: { paidCents: next },
    }),
    prisma.contractEvent.create({
      data: {
        contractId: contract.id,
        actorId: payerId,
        type: eventType,
        amountCents: amountNetCents,
        paymentId,
      },
    }),
  ]);

  return contract.id;
}