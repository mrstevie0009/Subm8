// src/app/api/chat/start/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => null) as { toUserId?: string; toHandle?: string } | null;
  
  // ✅ PARALLEL: User lookup + existing conversation check
  const [other, existing] = await Promise.all([
    body?.toUserId
      ? prisma.user.findUnique({ where: { id: body.toUserId }, select: { id: true, role: true } })
      : body?.toHandle
      ? prisma.user.findUnique({ where: { handle: body.toHandle }, select: { id: true, role: true } })
      : null,
    
    // Pre-emptive lookup (wir wissen dommeId/subId noch nicht, aber können schon suchen)
    body?.toUserId || body?.toHandle
      ? (async () => {
          const tempOther = body?.toUserId
            ? await prisma.user.findUnique({ where: { id: body.toUserId }, select: { id: true, role: true } })
            : await prisma.user.findUnique({ where: { handle: body.toHandle! }, select: { id: true, role: true } });
          
          if (!tempOther || tempOther.id === me.id) return null;
          
          const iAmDomme = me.role === 'DOMME';
          const dommeId = iAmDomme ? me.id : tempOther.id;
          const subId = iAmDomme ? tempOther.id : me.id;
          
          return prisma.conversation.findFirst({
            where: { dommeId, subId },
            select: { id: true },
          });
        })()
      : null,
  ]);

  if (!other) return Response.json({ ok: false, error: 'User not found' }, { status: 404 });
  if (other.id === me.id) return Response.json({ ok: false, error: 'Cannot DM yourself' }, { status: 400 });

  if (existing) return Response.json({ ok: true, id: existing.id, created: false });

  // ✅ Create conversation
  const iAmDomme = me.role === 'DOMME';
  const dommeId = iAmDomme ? me.id : other.id;
  const subId = iAmDomme ? other.id : me.id;

  const convo = await prisma.conversation.create({
    data: { dommeId, subId, openedByDomme: iAmDomme },
    select: { id: true },
  });
  
  return Response.json({ ok: true, id: convo.id, created: true });
}