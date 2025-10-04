// src/app/api/veriff/start/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { getToken } from 'next-auth/jwt';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const RAW_BASE = process.env.VERIFF_API ?? 'https://stationapi.veriff.com';
const VERIFF_API_KEY = process.env.VERIFF_API_KEY!;
const BASE_URL = process.env.BASE_URL!;
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

// Sorgt dafür, dass wir genau einmal /v1 haben und keine doppelten Slashes.
function buildEndpoint(path: string) {
  const base = RAW_BASE.replace(/\/+$/, '');
  const withV1 = /\/v1$/.test(base) ? base : `${base}/v1`;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${withV1}${p}`;
}

export async function POST(req: NextRequest) {
  // 1) Session/Token holen
  const session = await getServerSession(authOptions);
  let userId: string | null = session?.user?.id ?? null;
  if (!userId) {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET });
    userId = (token?.uid as string | undefined) ?? null;
  }
  if (!userId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // 2) Params
  const { searchParams } = new URL(req.url);
  const back = searchParams.get('back') ?? `/${searchParams.get('locale') ?? 'en'}`;
  const locale = (searchParams.get('locale') ?? 'en').toLowerCase();

  // 3) Payload – NUR gültige Felder
  const payload = {
    verification: {
      vendorData: String(userId),
      lang: locale,
      callback: `${BASE_URL}/${locale}/verify/complete?back=${encodeURIComponent(back)}`
      // KEIN "redirect" Feld!
      // Webhook-URL NICHT hier angeben – die wird im Veriff-Dashboard konfiguriert.
    },
  };

  // 4) Call
  const url = buildEndpoint('/sessions'); // => <BASE>/v1/sessions
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-AUTH-CLIENT': VERIFF_API_KEY,
      },
      body: JSON.stringify(payload),
    });

    const text = await resp.text(); // Fehler sind manchmal HTML
    if (!resp.ok) {
      console.error('❌ Veriff API Error', resp.status, url, text);
      return NextResponse.json(
        { error: 'veriff_failed', status: resp.status, url, details: text },
        { status: 500 }
      );
    }

    const data = JSON.parse(text);
    const { id, url: startUrl } = data.verification ?? {};

   // Veriff-ID beim User vormerken (hilft beim Support/Debugging)
   if (id) {
     try {
       await prisma.user.update({
         where: { id: userId },
         data: { veriffId: String(id) },
       });
     } catch (e) {
       console.warn('⚠️ konnte veriffId nicht speichern:', e);
     }
   }

    return NextResponse.json({ id, url: startUrl });
  } catch (err) {
    console.error('❌ Exception in /api/veriff/start', url, err);
    return NextResponse.json(
      { error: 'server_exception', url, details: String(err) },
      { status: 500 }
    );
  }
}
