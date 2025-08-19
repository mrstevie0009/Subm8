// src/app/api/chat/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  // Alle Konversationen, in denen ich domme oder sub bin
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ dommeId: me.id }, { subId: me.id }] },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      domme: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
      sub:   { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, text: true, createdAt: true, authorId: true },
      },
    },
  });

  // Unread counts (pro Konvo)
  const convoIds = convos.map(c => c.id);
  const unreadCounts = await prisma.message.groupBy({
    by: ['conversationId'],
    where: {
      conversationId: { in: convoIds },
      // nur Nachrichten, die NICHT von mir sind …
      authorId: { not: me.id },
      // … und die ich noch nicht gelesen habe
      reads: { none: { readerUserId: me.id } },
    },
    _count: { conversationId: true },
  });
  const unreadMap = new Map(unreadCounts.map(u => [u.conversationId, u._count.conversationId]));

  const items = convos.map(c => {
    const iAmDomme = c.domme.id === me.id;
    const other = iAmDomme ? c.sub : c.domme;
    const last = c.messages[0];
    const lastSnippet = last?.text?.trim() || 'Media';
    return {
      id: c.id,
      other: {
        id: other.id,
        username: other.handle,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
      },
      lastMessageAt: last?.createdAt?.toISOString() ?? c.createdAt.toISOString(),
      lastSnippet,
      unread: unreadMap.get(c.id) ?? 0,
    };
  });

  return Response.json({ ok: true, items });
}
