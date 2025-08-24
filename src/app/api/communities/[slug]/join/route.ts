// src/app/api/communities/[slug]/join/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import type { Role } from '@prisma/client';

export const runtime = 'nodejs';

export async function POST(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getAuth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role as Role | undefined;

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const slug = params.slug.toLowerCase();
    const community = await prisma.community.findUnique({
      where: { slug },
      select: { id: true, createdById: true, joinPolicy: true },
    });
    if (!community) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    // Policy prüfen
    switch (community.joinPolicy) {
      case 'INVITE_ONLY':
        return NextResponse.json({ ok: false, error: 'INVITE_ONLY' }, { status: 403 });
      case 'DOMME_ONLY':
        if (userRole !== 'DOMME') {
          return NextResponse.json({ ok: false, error: 'ROLE_NOT_ALLOWED' }, { status: 403 });
        }
        break;
      case 'SUB_ONLY':
        if (userRole !== 'SUBMISSIVE') {
          return NextResponse.json({ ok: false, error: 'ROLE_NOT_ALLOWED' }, { status: 403 });
        }
        break;
      case 'OPEN':
      default:
        // ok
        break;
    }

    // idempotentes Join
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId } },
      update: {},
      create: { communityId: community.id, userId, role: 'MEMBER' },
    });

    const members = await prisma.communityMember.count({ where: { communityId: community.id } });
    return NextResponse.json({ ok: true, joined: true, members });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { slug: string } }) {
  try {
    const session = await getAuth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const slug = params.slug.toLowerCase();
    const community = await prisma.community.findUnique({
      where: { slug },
      select: { id: true, createdById: true },
    });
    if (!community) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    // Creator darf nicht leaven (optional, wie vorher)
    if (community.createdById === userId) {
      return NextResponse.json({ ok: false, error: 'CREATOR_CANNOT_LEAVE' }, { status: 400 });
    }

    await prisma.communityMember.delete({
      where: { communityId_userId: { communityId: community.id, userId } },
    });

    const members = await prisma.communityMember.count({ where: { communityId: community.id } });
    return NextResponse.json({ ok: true, joined: false, members });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
