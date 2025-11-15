//src/app/api/invites/preview/[code]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { code: string };
type Ctx = { params: Promise<Params> };

export async function GET(_req: Request, { params }: Ctx) {
  const { code } = await params;
  if (!code) {
    return NextResponse.json({ ok: false, error: 'Missing code' }, { status: 400 });
  }

  // CommunityInvite nach token holen + Community mitsamt Member-Count
  const invite = await prisma.communityInvite.findUnique({
    where: { token: code },
    include: {
      community: {
        select: {
          id: true,
          slug: true,
          name: true,
          bannerUrl: true,
          description: true,
          _count: { select: { CommunityMember: true } }, // Member-Anzahl
        },
      },
    },
  });

  if (!invite || !invite.community) {
    return NextResponse.json({ ok: false, error: 'Invite not found' }, { status: 404 });
  }

  const remainingUses =
    typeof invite.maxUses === 'number'
      ? Math.max(0, invite.maxUses - (invite.usedCount ?? 0))
      : null;

  const payload = {
    code,
    href: `/invite/${code}`,
    community: {
      slug: invite.community.slug,
      name: invite.community.name,
      bannerUrl: invite.community.bannerUrl ?? null,
      avatarUrl: null, // Community hat laut Schema kein avatarUrl -> Placeholder im UI
      description: invite.community.description ?? null,
      memberCount: invite.community._count?.CommunityMember ?? 0,
    },
    expiresAt: invite.expiresAt ? invite.expiresAt.toISOString() : null,
    remainingUses,
  };

  return NextResponse.json({ ok: true, invite: payload });
}
