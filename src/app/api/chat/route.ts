// src/app/api/chat/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getCurrentUser();

  // 👇 Statt 401: leere Antwort (wie gehabt)
  if (!me) {
    return Response.json(
      { ok: true, items: [] },
      { status: 200, headers: { 'cache-control': 'private, no-store' } },
    );
  }

  // 1) Konversationen: nur leichte Felder + lastMessageId/At + Unread
  const convos = await prisma.conversation.findMany({
    where: { OR: [{ dommeId: me.id }, { subId: me.id }] },
    orderBy: { updatedAt: 'desc' }, // 🚀 wichtig
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      dommeId: true,
      subId: true,
      domme: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
      sub:   { select: { id: true, handle: true, displayName: true, avatarUrl: true } },

      lastMessageId: true,
      lastMessageAt: true,

      unreadForDomme: true,
      unreadForSub: true,
    },
  });

  // 2) Last-Messages in einem Rutsch
  const lastIds = convos.map(c => c.lastMessageId).filter(Boolean) as string[];

  const lastMsgs = lastIds.length
    ? await prisma.message.findMany({
        where: { id: { in: lastIds } },
        select: {
          id: true,
          text: true,
          createdAt: true,
          authorId: true,
          mediaType: true,
          mediaUrl: true,
        },
      })
    : [];

  const lastById = new Map(lastMsgs.map(m => [m.id, m]));

  // 3) Shape für Frontend
  const items = convos.map(c => {
    const iAmDomme = c.dommeId === me.id;
    const other = iAmDomme ? c.sub : c.domme;
    const last = c.lastMessageId ? lastById.get(c.lastMessageId) : undefined;

    let lastSnippet = 'Media';
    if (last?.text?.trim()) lastSnippet = last.text.trim();
    else if (last?.mediaType) {
      if (last.mediaType.startsWith('video/')) lastSnippet = 'Video';
      else if (last.mediaType.startsWith('image/')) lastSnippet = 'Photo';
    } else if (!c.lastMessageId) {
      lastSnippet = ''; // Konvo ohne Messages
    }

    return {
      id: c.id,
      other: {
        id: other.id,
        username: other.handle,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
      },
      lastMessageAt: (c.lastMessageAt ?? c.updatedAt ?? c.createdAt).toISOString(),
      lastSnippet,
      lastAuthorId: last?.authorId,
      unread: iAmDomme ? c.unreadForDomme : c.unreadForSub,
    };
  });

  return Response.json(
    { ok: true, items },
    { headers: { 'cache-control': 'private, no-store' } },
  );
}
