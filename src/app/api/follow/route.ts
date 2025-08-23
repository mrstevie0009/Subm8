import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const { targetId } = (await req.json()) as { targetId?: string };
  if (!targetId || typeof targetId !== 'string') {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 });
  }
  if (targetId === session.user.id) {
    return NextResponse.json({ ok: false, error: 'self_follow' }, { status: 400 });
  }

  // Toggle follow
  const where = { followerId_followeeId: { followerId: session.user.id, followeeId: targetId } };
  const existing = await prisma.follow.findUnique({ where }).catch(() => null);

  if (existing) {
    await prisma.follow.delete({ where });
  } else {
    await prisma.follow.create({
      data: { followerId: session.user.id, followeeId: targetId },
    });
  }

  const followers = await prisma.follow.count({ where: { followeeId: targetId } });
  return NextResponse.json({ ok: true, following: !existing, followers });
}
