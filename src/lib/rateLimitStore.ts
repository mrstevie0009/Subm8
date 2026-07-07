// src/lib/rateLimitStore.ts

import { prisma } from '@/lib/prisma';

export type RateDecision =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterMs: number; retryAfterSec: number };

/**
 * Nimmt 1 „Token" für `key` innerhalb eines Fixed-Windows.
 * @param key       z.B. `signup:${ip}` oder `tip:${userId}`
 * @param max       Max. erlaubte Aktionen pro Fenster
 * @param windowMs  Fensterlänge in Millisekunden
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<RateDecision> {
  const now = Date.now();

  try {
    const existing = await prisma.rateLimitCounter.findUnique({
      where: { key },
      select: { count: true, windowEnd: true },
    });

    // Kein Eintrag oder Fenster abgelaufen -> Fenster (neu) starten
    if (!existing || existing.windowEnd.getTime() <= now) {
      const windowEnd = new Date(now + windowMs);
      await prisma.rateLimitCounter.upsert({
        where: { key },
        create: { key, count: 1, windowEnd },
        update: { count: 1, windowEnd },
      });
      return { ok: true, remaining: max - 1 };
    }

    // Fenster aktiv, Limit erreicht -> blocken
    if (existing.count >= max) {
      const retryAfterMs = existing.windowEnd.getTime() - now;
      return { ok: false, retryAfterMs, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
    }

    // Fenster aktiv, unter Limit -> hochzählen
    const updated = await prisma.rateLimitCounter.update({
      where: { key },
      data: { count: { increment: 1 } },
      select: { count: true },
    });
    return { ok: true, remaining: Math.max(0, max - updated.count) };
  } catch (err) {
    // Fail-OPEN mit Log: ein DB-Hänger soll den Endpoint nicht lahmlegen.
    // Für Payment-Pfade ggf. auf fail-closed ändern.
    console.error('rateLimit error', { key, err });
    return { ok: true, remaining: max };
  }
}