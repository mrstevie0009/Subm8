// src/app/api/user/[handle]/stats/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { handle: string };
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const { handle: raw } = await ctx.params;              
    const handle = raw.startsWith('@') ? raw.slice(1) : raw;

    const user = await prisma.user.findFirst({
      where: { handle: { equals: handle.toLowerCase(), mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 });
    }

    const [followers, following] = await Promise.all([
      prisma.follow.count({ where: { followeeId: user.id } }),
      prisma.follow.count({ where: { followerId: user.id } }),
    ]);

    return NextResponse.json({ ok: true, followers, following });
  } catch {
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}
