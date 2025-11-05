// src/app/api/chat/meta/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;

  const me = await getCurrentUser();
  if (!me) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
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
    },
  });

  if (!convo) {
    return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  let member = false;
  let role: 'ADMIN' | 'MEMBER' | undefined;

  if (convo.type === $Enums.ConversationType.DM) {
    member = convo.dommeId === me.id || convo.subId === me.id;
  } else {
    // GROUP → Mitgliedschaft schlank prüfen (ohne alle Member zu ziehen)
    const m = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: id, userId: me.id } },
      select: { role: true },
    });
    member = !!m;
    role = m?.role;
  }

  const payload = {
    ok: true,
    id: convo.id,
    type: convo.type,            // 'DM' | 'GROUP'
    member,
    role,
    title: convo.title ?? null,  // hilfreich für Header
  };

  if (!member) {
    // Liefere type im Body mit, aber kennzeichne Forbidden via Status
    return Response.json({ ...payload, ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Kurze private Cache-Hints erlaubt
  return Response.json(payload, { headers: { 'cache-control': 'private, no-store' } });
}
