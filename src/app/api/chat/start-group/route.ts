// src/app/api/chat/start-group/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { $Enums } from '@prisma/client'; // 👈 Enums hier herholen

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok:false, error:'Not authenticated' }, { status:401 });

  const body = await req.json().catch(() => null) as { memberIds?: string[]; title?: string } | null;
  const ids = Array.isArray(body?.memberIds) ? body!.memberIds.filter(Boolean) : [];
  const unique = Array.from(new Set(ids.filter(id => id !== me.id)));
  if (unique.length < 2) {
    return Response.json({ ok:false, error:'Need at least 2 members' }, { status:400 });
  }

  const convo = await prisma.conversation.create({
    data: {
      type: $Enums.ConversationType.GROUP,          // 👈 statt 'GROUP'
      title: body?.title ?? null,
      createdById: me.id,
      members: {
        // Für ein paar Mitglieder ist create am simpelsten
        create: [
          { userId: me.id, role: $Enums.ConversationMemberRole.ADMIN },
          ...unique.map(uid => ({ userId: uid, role: $Enums.ConversationMemberRole.MEMBER })),
        ],
      },
    },
    select: { id: true },
  });

  return Response.json({ ok: true, id: convo.id, created: true });
}
