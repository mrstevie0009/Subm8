// src/app/api/communities/[slug]/join/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import type { Role } from '@prisma/client';

export const runtime = 'nodejs';

type Params = { slug: string };

export async function POST(req: Request, ctx: { params: Promise<Params> }) {
  try {
    const session = await getAuth();
    const userId = session?.user?.id;
    const userRole = session?.user?.role as Role | undefined;

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { slug } = await ctx.params;
    const community = await prisma.community.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, createdById: true, joinPolicy: true },
    });
    if (!community) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    // Invite-Code aus der URL (?invite=CODE) lesen
    const url = new URL(req.url);
    const inviteCode = url.searchParams.get('invite') || undefined;

    // Policy prüfen
    switch (community.joinPolicy) {
      case 'INVITE_ONLY': {
        if (!inviteCode) {
          return NextResponse.json({ ok: false, error: 'INVITE_ONLY' }, { status: 403 });
        }

        // Invite validieren
        const invite = await prisma.communityInvite.findFirst({
          where: {
            token: inviteCode,
            communityId: community.id,
            revokedAt: null,
          },
          select: {
            id: true,
            type: true,
            targetUserId: true,
            maxUses: true,
            usedCount: true,
            expiresAt: true,
          },
        });

        if (!invite) {
          return NextResponse.json({ ok: false, error: 'INVITE_INVALID' }, { status: 403 });
        }
        if (invite.expiresAt && invite.expiresAt <= new Date()) {
          return NextResponse.json({ ok: false, error: 'INVITE_EXPIRED' }, { status: 403 });
        }
        if (invite.maxUses != null && invite.usedCount >= invite.maxUses) {
          return NextResponse.json({ ok: false, error: 'INVITE_MAXED' }, { status: 403 });
        }
        if (invite.type === 'DIRECT' && invite.targetUserId && invite.targetUserId !== userId) {
          return NextResponse.json({ ok: false, error: 'INVITE_NOT_TARGET' }, { status: 403 });
        }

        // Schon Mitglied?
        const already = await prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId: community.id, userId } },
          select: { communityId: true },
        });

        // Nur wenn neu: Mitglied + usedCount++
        if (!already) {
          await prisma.$transaction([
            prisma.communityMember.create({
              data: { communityId: community.id, userId, role: 'MEMBER' },
            }),
            prisma.communityInvite.update({
              where: { id: invite.id },
              data: { usedCount: { increment: 1 } },
            }),
          ]);
        }

        const members = await prisma.communityMember.count({ where: { communityId: community.id } });
        return NextResponse.json({ ok: true, joined: true, members });
      }

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
        break;
    }

    // OPEN / rollen-konform: idempotent joinen
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

export async function DELETE(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const session = await getAuth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const { slug } = await ctx.params;
    const community = await prisma.community.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, createdById: true },
    });
    if (!community) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

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
