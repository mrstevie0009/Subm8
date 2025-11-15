// src/app/api/user/[handle]/posts/leaderboard/route.ts
import { prisma } from '@/lib/prisma';

type Params = { handle: string };

export async function GET(
  _req: Request,
  { params }: { params: Promise<Params> },
) {
  try {
    // Next 15: params erst awaiten
    const { handle: raw } = await params;
    const handle = (raw.startsWith('@') ? raw.slice(1) : raw).toLowerCase();

    const user = await prisma.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return Response.json(
        { ok: false, error: 'User not found' },
        { status: 404 },
      );
    }

    // Top 3 Tipper per Summe
    const grouped = await prisma.payment.groupBy({
      by: ['payerId'],
      where: { payeeId: user.id },
      _sum: { amountGrossCents: true },
      _count: { _all: true },
      orderBy: [{ _sum: { amountGrossCents: 'desc' } }],
      take: 3,
    });

    // Typ-Engführung, um ohne "any" auf _sum/_count zuzugreifen
    type G = {
      payerId: string;
      _sum: { amountGrossCents: number | null } | null;
      _count: { _all: number } | null;
    };
    const gTyped = grouped as unknown as G[];

    // Userdaten zu den payerIds nachladen (keine Relation 'payer' im Client)
    const payerIds = gTyped.map((g) => g.payerId);
    const payerUsers = await prisma.user.findMany({
      where: { id: { in: payerIds } },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    const payerById = new Map(payerUsers.map((u) => [u.id, u]));

    const top3 = gTyped.map((g) => ({
      user:
        payerById.get(g.payerId) ?? {
          id: g.payerId,
          handle: 'unknown',
          displayName: 'Unknown',
          avatarUrl: null,
        },
      totalCents: g._sum?.amountGrossCents ?? 0,
      count: g._count?._all ?? 0,
    }));

    // Letzte Zahlungen für die Tabelle
    const latest = await prisma.payment.findMany({
      where: { payeeId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        createdAt: true,
        amountGrossCents: true,
        payerId: true, // <- keine Relation 'payer' benutzen
      },
    });

    const latestPayerIds = Array.from(new Set(latest.map((p) => p.payerId)));
    const latestUsers = await prisma.user.findMany({
      where: { id: { in: latestPayerIds } },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
      },
    });
    const latestById = new Map(latestUsers.map((u) => [u.id, u]));

    const rows = latest.map((p) => ({
      id: p.id,
      at: p.createdAt.toISOString(),
      amountCents: p.amountGrossCents,
      user:
        latestById.get(p.payerId) ?? {
          id: p.payerId,
          handle: 'unknown',
          displayName: 'Unknown',
          avatarUrl: null,
        },
    }));

    return Response.json({ ok: true, top3, rows });
  } catch (err) {
    console.error('Leaderboard route error', err);
    return Response.json(
      { ok: false, error: 'Unexpected error' },
      { status: 500 },
    );
  }
}
