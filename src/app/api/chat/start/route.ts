// src/app/api/chat/start/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null) as { toUserId?: string; toHandle?: string } | null;
  let other = null;

  if (body?.toUserId) {
    other = await prisma.user.findUnique({ where: { id: body.toUserId } });
  } else if (body?.toHandle) {
    other = await prisma.user.findUnique({ where: { handle: body.toHandle } });
  }
  if (!other) return Response.json({ ok: false, error: 'User not found' }, { status: 404 });
  if (other.id === me.id) return Response.json({ ok: false, error: 'Cannot DM yourself' }, { status: 400 });

  const iAmDomme = me.role === 'DOMME';
  const dommeId = iAmDomme ? me.id : other.id;
  const subId   = iAmDomme ? other.id : me.id;

  // finde oder erzeuge
  const existing = await prisma.conversation.findFirst({
    where: { dommeId, subId },
    select: { id: true },
  });
  if (existing) return Response.json({ ok: true, id: existing.id, created: false });

  const convo = await prisma.conversation.create({
    data: { dommeId, subId, openedByDomme: iAmDomme },
    select: { id: true },
  });
  return Response.json({ ok: true, id: convo.id, created: true });
}
