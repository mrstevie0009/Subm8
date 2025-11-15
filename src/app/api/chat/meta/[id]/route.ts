// src/app/api/chat/meta/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
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

  // Minimaler Fetch (keine großen Includes)
  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      dommeId: true,
      subId: true,
      title: true,
      avatarUrl: true,
      _count: { select: { members: true } },
    },
  });

  if (!convo) {
    return Response.json(
      { ok: false, error: 'Not found' },
      { status: 404 },
    );
  }

  let member = false;
  let role: 'ADMIN' | 'MEMBER' | undefined;

  if (convo.type === $Enums.ConversationType.DM) {
    member = convo.dommeId === me.id || convo.subId === me.id;
  } else {
    // GROUP → Mitgliedschaft schlank prüfen
    const m = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: { conversationId: id, userId: me.id },
      },
      select: { role: true },
    });
    member = !!m;
    role = m?.role;
  }

  const payload = {
    ok: true as const,
    id: convo.id,
    type: convo.type,
    member,
    role,
    title: convo.title ?? null,
    avatarUrl:
      convo.avatarUrl && convo.avatarUrl.trim() ? convo.avatarUrl : null,
    memberCount: convo._count?.members ?? null,
  };

  if (!member) {
    return Response.json(
      { ...payload, ok: false as const, error: 'Forbidden' },
      { status: 403 },
    );
  }

  return Response.json(payload, {
    headers: { 'cache-control': 'private, no-store' },
  });
}
