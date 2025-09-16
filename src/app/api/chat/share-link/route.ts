// src/app/api/chat/share-link/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
    }

    const body = await req.json().catch(() => null) as null | {
      conversationId?: string;
      postId?: string;
      url?: string;
      note?: string;
    };

    if (!body?.conversationId || !body?.url) {
      return NextResponse.json({ ok: false, error: 'conversationId and url required' }, { status: 400 });
    }

    // Sicherstellen, dass ich Mitglied der Konversation bin
    const convo = await prisma.conversation.findUnique({
      where: { id: body.conversationId },
      select: { id: true, dommeId: true, subId: true },
    });
    if (!convo || (convo.dommeId !== me.id && convo.subId !== me.id)) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    const textParts = [body.url.trim()];
    if (body.note && body.note.trim()) textParts.push('', body.note.trim());
    const text = textParts.join('\n');

    await prisma.message.create({
      data: {
        conversationId: convo.id,
        authorId: me.id,
        text,
        // mediaType/mediaUrl bleiben leer – Link wird als Text verschickt
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('POST /api/chat/share-link failed:', e);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
