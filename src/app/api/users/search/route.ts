// src/app/api/users/search/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get('q') || '').trim();
  const q = raw.replace(/^@+/, '');
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 20), 1), 50);
  if (!q) return NextResponse.json({ ok: true, items: [] });

  const myId = session.user.id;

  // Blockliste holen
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: myId }, { blockedId: myId }] },
    select: { blockerId: true, blockedId: true },
  });
  const blockedIds = new Set<string>();
  for (const b of blocks) blockedIds.add(b.blockerId === myId ? b.blockedId : b.blockerId);
  const blockedArr = Array.from(blockedIds);

  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: myId } },
        blockedArr.length ? { id: { notIn: blockedArr } } : {},
        { isDeactivated: false }, // optional sinnvoll
      ],
      OR: [
        { handle: { startsWith: q, mode: 'insensitive' } },    // @handle
        { displayName: { contains: q, mode: 'insensitive' } }, // Name
      ],
    },
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      premiumUntil: true, // falls du es später brauchst
      isFirstAdopter: true,
    },
    take: limit,
    orderBy: [
      { handle: 'asc' },       // gültige Felder: handle/displayName
      { displayName: 'asc' },
    ],
  });

  const items = users.map(u => ({
    id: String(u.id),
    handle: u.handle,
    displayName: u.displayName || u.handle,
    avatarUrl: u.avatarUrl,
    role: u.role,
  }));

  return NextResponse.json({ ok: true, items });
}
