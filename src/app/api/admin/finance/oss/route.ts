// src/app/api/admin/finance/oss/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminIdentity } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminIdentity();
  if (!admin) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 29*24*3600*1000);
  const to   = searchParams.get('to') ? new Date(searchParams.get('to')!)   : new Date();

  const rows = await prisma.payment.groupBy({
    by: ['buyerCountry'],
    where: { status: 'SUCCEEDED', createdAt: { gte: from, lte: new Date(new Date(to).setHours(23,59,59,999)) } },
    _sum: { amountNetToDommeCents: true, platformFeeCents: true, vatAmountCents: true },
  });

  const data = rows.map(r => ({
    country: r.buyerCountry ?? '—',
    netBaseCents: (r._sum.amountNetToDommeCents ?? 0) + (r._sum.platformFeeCents ?? 0),
    vatCents: r._sum.vatAmountCents ?? 0,
  }));

  return Response.json({ ok: true, items: data }, { headers: { 'cache-control': 'no-store' } });
}
