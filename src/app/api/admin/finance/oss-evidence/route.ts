// src/app/api/admin/finance/oss-evidence/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminIdentity } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminIdentity();
  if (!admin) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 29*24*3600*1000);
  const to   = searchParams.get('to') ? new Date(searchParams.get('to')!)   : new Date();

  const txs = await prisma.payment.findMany({
    where: { status: 'SUCCEEDED', createdAt: { gte: from, lte: new Date(new Date(to).setHours(23,59,59,999)) } },
    select: { id: true, buyerCountry: true, createdAt: true, evidences: true },
    orderBy: { createdAt: 'asc' },
  });

  const rows = txs.map(t => {
    const byCountry = new Map<string, Set<string>>();
    for (const e of t.evidences) {
      const c = (e.country || '').toUpperCase();
      if (!c) continue;
      if (!byCountry.has(c)) byCountry.set(c, new Set());
      byCountry.get(c)!.add(e.type);
    }
    let ok = false;
    for (const types of byCountry.values()) if (types.size >= 2) { ok = true; break; }
    return {
      id: t.id,
      date: t.createdAt.toISOString().slice(0,10),
      buyerCountry: t.buyerCountry ?? '—',
      types: [...new Set(t.evidences.map(e => e.type))],
      countries: [...new Set(t.evidences.map(e => (e.country || '').toUpperCase()).filter(Boolean))],
      ok,
    };
  });

  const total = rows.length;
  const compliant = rows.filter(r => r.ok).length;

  return Response.json({ ok: true, totals: { total, compliant, compliantPct: total ? Math.round(compliant * 100 / total) : 0 }, rows }, { headers: { 'cache-control': 'no-store' } });
}
