export type VatInfo = { country: string; rateBps: number };

// sehr kleine EU-Map – ergänzbar
const EU_VAT_BPS: Record<string, number> = {
  AT: 2000, BE: 2100, BG: 2000, CY: 1900, CZ: 2100, DE: 1900, DK: 2500, EE: 2200,
  ES: 2100, FI: 2400, FR: 2000, GR: 2400, HR: 2500, HU: 2700, IE: 2300, IT: 2200,
  LT: 2100, LU: 1600, LV: 2100, MT: 1800, NL: 2100, PL: 2300, PT: 2300, RO: 1900,
  SE: 2500, SI: 2200, SK: 2000,
};

export function vatForCountry(country?: string | null): VatInfo | null {
  if (!country) return null;
  const cc = country.toUpperCase();
  const rateBps = EU_VAT_BPS[cc];
  if (!rateBps) return null;
  return { country: cc, rateBps };
}
