// src/lib/bruteforce.ts
import { prisma } from '@/lib/prisma';

type LoginThrottleUpdateData = Parameters<typeof prisma.loginThrottle.update>[0]['data'];

export const WINDOW_MIN = 15;
export const MAX_FAILS  = 10;
export const BLOCK_MIN  = 30;
export const HARD_FAILS_DAILY = 50;

function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}

/** robust: find -> create|update, mit try/catch und Logging */
export async function recordFailure(ip: string, identifier: string) {
  const idNorm = String(identifier).toLowerCase();
  const now = new Date();

  try {
    const existing = await prisma.loginThrottle.findFirst({
      where: { ip, identifier: idNorm },
      select: { id: true, fails: true, blockedUntil: true, permanent: true },
    });

    if (!existing) {
      await prisma.loginThrottle.create({
        data: { ip, identifier: idNorm, fails: 1 },
      });
      return;
    }

    // increment fails
    const nextFails = (existing.fails ?? 0) + 1;
    const updateData: LoginThrottleUpdateData = { fails: nextFails };

    // temp block
    if (nextFails >= MAX_FAILS) {
      updateData.blockedUntil = addMinutes(now, BLOCK_MIN);
    }

    // permanent block
    if (nextFails >= HARD_FAILS_DAILY && !existing.permanent) {
      updateData.permanent = true;
      updateData.blockedUntil = null;
    }

    await prisma.loginThrottle.update({
      where: { id: existing.id },
      data: updateData,
    });
  } catch (err) {
    // wichtig: nicht die Auth-Flow crashen lassen — aber sichtbar machen

    console.error('recordFailure error', { ip, identifier, err });
  }
}

export async function recordSuccess(ip: string, identifier: string) {
  const idNorm = String(identifier).toLowerCase();
  try {
    const existing = await prisma.loginThrottle.findFirst({
      where: { ip, identifier: idNorm },
      select: { id: true },
    });
    if (!existing) return;
    await prisma.loginThrottle.update({
      where: { id: existing.id },
      data: { fails: 0, blockedUntil: null },
    });
  } catch (err) {

    console.error('recordSuccess error', { ip, identifier, err });
  }
}

export async function isBlocked(ip: string, identifier: string): Promise<{ ok: boolean; reason?: 'temp'|'perm'; until?: Date | null; }> {
  const idNorm = identifier.toLowerCase();
  const row = await prisma.loginThrottle.findFirst({
    where: { ip, identifier: idNorm },
    select: { blockedUntil: true, permanent: true },
  });
  if (!row) return { ok: true };
  if (row.permanent) return { ok: false, reason: 'perm', until: null };
  if (row.blockedUntil && row.blockedUntil > new Date()) {
    return { ok: false, reason: 'temp', until: row.blockedUntil };
  }
  return { ok: true };
}

/** Für Admin: Liste der aktuell gesperrten */
export async function listBlocked(limit = 300) {
  const now = new Date();
  return prisma.loginThrottle.findMany({
    where: {
      OR: [
        { permanent: true },
        { blockedUntil: { gt: now } },
      ],
    },
    orderBy: [{ permanent: 'desc' }, { blockedUntil: 'desc' }],
    take: limit,
    select: { id: true, ip: true, identifier: true, fails: true, blockedUntil: true, permanent: true },
  });
}

/** Für Admin: Entsperren */
export async function unblockById(id: string) {
  await prisma.loginThrottle.update({
    where: { id },
    data: { fails: 0, blockedUntil: null, permanent: false },
  });
}
