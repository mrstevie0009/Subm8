// src/app/api/chat/group/[id]/report/route.ts
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

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const raw = (body?.reason ?? '').toString();

  // sanitize & limit
  const reason = raw
    .replace(/[\u0000-\u001F\u007F]/g, ' ') // control chars raus
    .trim()
    .slice(0, 2000);

  if (!reason) {
    return Response.json(
      { ok: false, error: 'Missing reason' },
      { status: 400 },
    );
  }

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

  const created = await prisma.conversationReport.create({
    data: { conversationId: id, reporterId: me.id, reason },
    select: { id: true, createdAt: true },
  });

  return Response.json({
    ok: true,
    id: created.id,
    createdAt: created.createdAt.toISOString(),
  });
}
