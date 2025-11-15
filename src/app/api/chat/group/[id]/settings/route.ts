// src/app/api/chat/group/[id]/settings/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';

type Params = { id: string };
type Ctx = { params: Promise<Params> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const me = await getCurrentUser();
  if (!me) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      members: {
        where: { userId: me.id },
        select: {
          userId: true,
          // NOTE: ConversationMember.muted:boolean must exist im Schema
          muted: true,
        },
      },
    },
  });

  if (!convo) {
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  if (convo.type !== $Enums.ConversationType.GROUP) {
    return Response.json({ ok: false, error: 'NOT_A_GROUP' }, { status: 400 });
  }

  if (!convo.members.length) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const muted = !!convo.members[0]?.muted;

  return Response.json(
    { ok: true, settings: { muted } },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
