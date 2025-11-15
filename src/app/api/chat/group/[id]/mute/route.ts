// src/app/api/chat/group/[id]/mute/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) {
    return Response.json(
      { ok: false, error: 'Not authenticated' },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as { muted?: boolean } | null;
  const want = !!body?.muted;

  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      members: { where: { userId: me.id }, select: { userId: true } },
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

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId: id, userId: me.id } },
    data: { muted: want },
  });

  return Response.json({ ok: true, muted: want });
}
