// src/app/api/gif/search/route.ts
import { NextRequest, NextResponse } from 'next/server';

// ✅ API-Key nur server-seitig – kein NEXT_PUBLIC_
const TENOR_KEY = 'LIVDSRZULELA';
const TENOR_BASE = 'https://g.tenor.com/v1';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') ?? '').trim();
  const limitRaw = Number(searchParams.get('limit') ?? '24');
  const limit = Math.min(Math.max(isNaN(limitRaw) ? 24 : limitRaw, 1), 50);

  const endpoint = q
    ? `${TENOR_BASE}/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=${limit}&media_filter=minimal`
    : `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=${limit}&media_filter=minimal`;

  try {
    const r = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 }, // Trending 60s cachen
    });

    if (!r.ok) {
      return NextResponse.json({ results: [] }, { status: 200 });
    }

    const j = await r.json();
    return NextResponse.json(j);
  } catch {
    return NextResponse.json({ results: [] }, { status: 200 });
  }
}