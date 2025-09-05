// src/lib/tax.ts
export function getVatRateForCountry(iso2?: string | null): number {
  if (!iso2) return 0;
  const c = iso2.toUpperCase();
  const map: Record<string, number> = {
    AT: 20, BE: 21, BG: 20, HR: 25, CY: 19, CZ: 21, DK: 25,
    EE: 22, FI: 24, FR: 20, DE: 19, EL: 24, GR: 24, HU: 27,
    IE: 23, IT: 22, LV: 21, LT: 21, LU: 17, MT: 18, NL: 21,
    PL: 23, PT: 23, RO: 19, SK: 20, SI: 22, ES: 21, SE: 25,
  };
  return map[c] ?? 0;
}

export type Evidence =
  | { type: 'IP_GEO'; country?: string | null }
  | { type: 'CARD_BIN'; country?: string | null }
  | { type: 'BILLING'; country?: string | null }
  | { type: 'USER_DECLARED'; country?: string | null };

export function resolveVatCountry(ev: Evidence[]): {
  country?: string;
  matchedBy: Array<Evidence['type']>;
  confidence: 'high' | 'low';
} {
  const byCountry = new Map<string, Set<Evidence['type']>>();
  for (const e of ev) {
    const c = (e.country || '').toUpperCase();
    if (!c) continue;
    if (!byCountry.has(c)) byCountry.set(c, new Set());
    byCountry.get(c)!.add(e.type);
  }
  let pick: { country: string; types: Set<Evidence['type']> } | null = null;
  for (const [country, types] of byCountry) {
    if (!pick || types.size > pick.types.size) pick = { country, types };
  }
  if (pick && pick.types.size >= 2) {
    return { country: pick.country, matchedBy: [...pick.types], confidence: 'high' };
  }
  // Fallback-Reihenfolge wenn nur 1 Evidence
  const order: Evidence['type'][] = ['BILLING', 'IP_GEO', 'CARD_BIN', 'USER_DECLARED'];
  for (const t of order) {
    const e = ev.find((x) => x.type === t && x.country);
    if (e?.country) return { country: e.country.toUpperCase(), matchedBy: [t], confidence: 'low' };
  }
  return { matchedBy: [], confidence: 'low' };
}
