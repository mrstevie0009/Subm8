import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'node:crypto';

const PLATFORM_FEE_PCT = 0.10;
const CURRENCY = 'EUR';

type CountryOnlyUser = { id: string; country?: string | null };

function countryFromHeaders(req: NextRequest): string | null {
  const h = req.headers;
  return (
    h.get('x-vercel-ip-country') ??
    h.get('cf-ipcountry') ??
    h.get('x-country') ??
    null
  );
}

// kleine EU-Map in BPS (Basis-Punkte)
const EU_VAT_BPS: Record<string, number> = {
  AT: 2000, BE: 2100, BG: 2000, CY: 1900, CZ: 2100, DE: 1900, DK: 2500, EE: 2200,
  ES: 2100, FI: 2400, FR: 2000, GR: 2400, HR: 2500, HU: 2700, IE: 2300, IT: 2200,
  LT: 2100, LU: 1600, LV: 2100, MT: 1800, NL: 2100, PL: 2300, PT: 2300, RO: 1900,
  SE: 2500, SI: 2200, SK: 2000,
};
function vatForCountry(country?: string | null) {
  if (!country) return { country: 'NON-EU', rateBps: 0 };
  const cc = country.toUpperCase();
  const rateBps = EU_VAT_BPS[cc] ?? 0;
  return { country: rateBps ? cc : 'NON-EU', rateBps };
}

export async function POST(req: NextRequest) {
  const meBase = await getCurrentUser();
  if (!meBase) {
    return NextResponse.json({ ok: false, error: 'Not signed in' }, { status: 401 });
  }

  // Hole country aus der DB (dein getCurrentUser enthält es nicht)
  const me = (await prisma.user.findUnique({
    where: { id: meBase.id },
    select: { id: true, country: true },
  })) as CountryOnlyUser | null;

  const body = (await req.json().catch(() => ({}))) as {
    toUserId?: string;
    amountCents?: number;
    note?: string;
    conversationId?: string;
  };

  const toUserId = String(body.toUserId || '');
  const amountCents = Number(body.amountCents || 0);
  const note = typeof body.note === 'string' ? body.note.slice(0, 200) : undefined;
  const conversationId = body.conversationId ? String(body.conversationId) : undefined;

  if (!toUserId || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid input' }, { status: 400 });
  }

  const payee = await prisma.user.findUnique({ where: { id: toUserId }, select: { id: true } });
  if (!payee) return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });

  const byIp = countryFromHeaders(req);
  const profileCountry = me?.country ?? null;
  const vat = vatForCountry(byIp ?? profileCountry);

  const vatCents = Math.round(amountCents * ((vat.rateBps ?? 0) / 10_000));
  const totalCents = amountCents + vatCents;

  // Plattform-Fee wird der Domme abgezogen (nicht dem Sub)
  const platformFeeCents = Math.round(amountCents * PLATFORM_FEE_PCT);
  const amountNetToDommeCents = amountCents - platformFeeCents;

  // ⚠️ Dein Payment-Modell hat kein @default(cuid()), daher ID selbst setzen
  const id = randomUUID();

  const payment = await prisma.payment.create({
    data: {
      id,
      payerId: me!.id,
      payeeId: payee.id,
      amountGrossCents: totalCents,     // Sub bezahlt Amount + VAT
      amountNetToDommeCents,            // Domme erhält nach Plattform-Fee
      platformFeeCents,                 // Plattform-Anteil
      processorFeeCents: 0,             // wird bei confirm gesetzt
      currency: CURRENCY,
      status: 'CREATED',
      externalRef: null,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    paymentId: payment.id,
    currency: CURRENCY,
    totalCents,
    amountNetToDommeCents,
    platformFeeCents,
    vatCountry: vat.country,
    vatRateBps: vat.rateBps,
    note,
    conversationId,
  });
}
