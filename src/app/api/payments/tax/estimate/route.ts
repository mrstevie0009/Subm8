import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

const EU_VAT_BPS: Record<string, number> = {
  AT: 2000, BE: 2100, BG: 2000, CY: 1900, CZ: 2100, DE: 1900, DK: 2500, EE: 2200,
  ES: 2100, FI: 2400, FR: 2000, GR: 2400, HR: 2500, HU: 2700, IE: 2300, IT: 2200,
  LT: 2100, LU: 1600, LV: 2100, MT: 1800, NL: 2100, PL: 2300, PT: 2300, RO: 1900,
  SE: 2500, SI: 2200, SK: 2000,
};

function countryFromHeadersOrQuery(req: NextRequest): string | null {
  const h = req.headers;
  const fromHdr =
    h.get('x-vercel-ip-country') ??
    h.get('cf-ipcountry') ??
    h.get('x-country') ??
    h.get('x-debug-country'); // für lokale Tests
  const fromQuery = req.nextUrl.searchParams.get('debugCountry');
  const v = (fromHdr || fromQuery || '').toUpperCase();
  return v || null;
}

export async function GET(req: NextRequest) {
  const amountCents = Number(new URL(req.url).searchParams.get('amountCents') || '0');
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'amountCents invalid' }, { status: 400 });
  }

  // 1) Versuch über IP/Proxy-Header
  const ipCountry = countryFromHeadersOrQuery(req);

  // 2) Fallback/Override: gespeichertes Profil-Land aus der DB
  let profileCountry: string | null = null;
  const me = await getCurrentUser().catch(() => null);
  if (me?.id) {
    // Direkt aus DB lesen, auch wenn getCurrentUser() das Feld nicht selektiert
    const row = await prisma.user.findUnique({
      where: { id: me.id },
      select: { country: true },
    });
    profileCountry = (row?.country ?? null) && row?.country?.toUpperCase?.() || null;
  }

  const detected = (ipCountry ?? profileCountry) ?? null;

  // Kein Land ermittelbar -> Client soll Auswahl anzeigen
  if (!detected) {
    return NextResponse.json({ ok: true, country: null });
  }

  const cc = detected.toUpperCase();
  const rateBps = EU_VAT_BPS[cc] ?? 0;

  // Außerhalb EU -> keine VAT
  if (!rateBps) {
    return NextResponse.json({ ok: true, country: 'NON-EU', rateBps: 0 });
  }

  return NextResponse.json({ ok: true, country: cc, rateBps });
}
