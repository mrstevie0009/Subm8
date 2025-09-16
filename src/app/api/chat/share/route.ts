// src/app/api/chat/share/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const conversationId = String(body?.conversationId || '');
    const postId = String(body?.postId || '');
    const locale = String(body?.locale || 'en');

    if (!conversationId || !postId) {
      return Response.json({ ok: false, error: 'Missing conversationId or postId' }, { status: 400 });
    }

    // Sicherheitscheck: gehöre ich zu dieser Konversation?
    const convo = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { dommeId: true, subId: true },
    });
    if (!convo || (convo.dommeId !== me.id && convo.subId !== me.id)) {
      return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const base = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '');
    const loc = locale || 'en';
    const url = base ? `${base}/${loc}/p/${postId}` : `/${loc}/p/${postId}`;

    // Einfache Text-Nachricht mit Link (wird in der UI automatisch verlinkt)
    await prisma.message.create({
      data: {
        conversationId,
        authorId: me.id,
        text: `Shared a post: ${url}`,
      },
    });

    return Response.json({ ok: true, url });
  } catch (e) {
    console.error('POST /api/chat/share failed', e);
    return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
