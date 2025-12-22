import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const runtime = 'nodejs';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const me = await getCurrentUser();
    if (!me) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const { slug } = await params;
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    const targetUserId = (body?.userId || '').toString();
    if (!targetUserId) return NextResponse.json({ ok: false, error: 'BAD_REQUEST' }, { status: 400 });
    if (targetUserId === me.id) return NextResponse.json({ ok: false, error: 'CANNOT_KICK_SELF' }, { status: 400 });

    const community = await prisma.community.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true },
    });
    if (!community) return NextResponse.json({ ok: false, error: 'COMMUNITY_NOT_FOUND' }, { status: 404 });

    // must be admin
    const myMembership = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId: me.id } },
      select: { role: true },
    });
    if (myMembership?.role !== 'ADMIN') {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    // delete membership (idempotent-ish)
    await prisma.communityMember.delete({
      where: { communityId_userId: { communityId: community.id, userId: targetUserId } },
    }).catch(() => null);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
