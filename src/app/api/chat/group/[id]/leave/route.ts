// src/app/api/chat/group/[id]/leave/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums } from '@prisma/client';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok:false, error:'Not authenticated' }, { status:401 });

  const convo = await prisma.conversation.findUnique({
    where: { id }, select: { id:true, type:true, members:{ select:{ userId:true } } }
  });
  if (!convo) return Response.json({ ok:false, error:'Not found' }, { status:404 });
  if (convo.type !== $Enums.ConversationType.GROUP) return Response.json({ ok:false, error:'NOT_A_GROUP' }, { status:400 });

  const isMember = convo.members.some(m => m.userId === me.id);
  if (!isMember) return Response.json({ ok:false, error:'Forbidden' }, { status:403 });

  await prisma.conversationMember.deleteMany({
    where: { conversationId: id, userId: me.id },
  });

  return Response.json({ ok:true });
}
