// src/app/api/admin/finance/summary/route.ts
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminIdentity } from '@/lib/admin';

export async function GET(req: NextRequest) {
  const admin = await getAdminIdentity();
  if (!admin) return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : new Date(Date.now() - 29*24*3600*1000);
  const to   = searchParams.get('to') ? new Date(searchParams.get('to')!)   : new Date();

  const payments = await prisma.payment.findMany({
    where: { status: 'SUCCEEDED', createdAt: { gte: from, lte: new Date(new Date(to).setHours(23,59,59,999)) } },
    select: {
      amountGrossCents: true, platformFeeCents: true, processorFeeCents: true, vatAmountCents: true, currency: true,
    },
  });

  const totals = payments.reduce((a, p) => {
    a.gross += p.amountGrossCents;
    a.platform += p.platformFeeCents;
    a.processor += p.processorFeeCents;
    a.vat += p.vatAmountCents;
    return a;
  }, { gross: 0, platform: 0, processor: 0, vat: 0 });

  return Response.json({ ok: true, totals, count: payments.length, currency: 'EUR' }, { headers: { 'cache-control': 'no-store' } });
}
