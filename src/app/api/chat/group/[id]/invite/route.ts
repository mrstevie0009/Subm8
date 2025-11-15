// src/app/api/chat/group/[id]/invite/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums, ConversationType } from '@prisma/client';

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

  const body = (await req.json().catch(() => null)) as { memberIds?: string[] } | null;
  const ids = Array.isArray(body?.memberIds)
    ? Array.from(new Set(body!.memberIds.filter(Boolean)))
    : [];
  if (!ids.length) {
    return Response.json({ ok: false, error: 'Empty list' }, { status: 400 });
  }

  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, type: true, members: { select: { userId: true, role: true } } },
  });
  if (!convo) {
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }
  if (convo.type !== ConversationType.GROUP) {
    return Response.json({ ok: false, error: 'NOT_A_GROUP' }, { status: 400 });
  }

  const meRow = convo.members.find((m) => m.userId === me.id);
  if (!meRow) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const existing = new Set(convo.members.map((m) => m.userId));
  const toAdd = ids.filter((uid) => uid !== me.id && !existing.has(uid));
  if (!toAdd.length) {
    return Response.json({ ok: true, added: 0 });
  }

  await prisma.conversationMember.createMany({
    data: toAdd.map((uid) => ({
      conversationId: id,
      userId: uid,
      role: $Enums.ConversationMemberRole.MEMBER,
    })),
    skipDuplicates: true,
  });

  return Response.json({ ok: true, added: toAdd.length });
}
