// src/app/api/chat/media/[...key]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';
import { prisma } from '@/lib/prisma';
import { presignGet } from '@/lib/r2sign';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const { key: segments } = await params;
  const decodedKey = segments.map(decodeURIComponent).join('/');
  // Key muss mit chat-media-private/ beginnen
  if (!decodedKey.startsWith('chat-media-private/')) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  // Message mit diesem Key finden + Conversation-Membership prüfen
  const message = await prisma.message.findFirst({
    where: { mediaKey: decodedKey },
    select: {
      conversation: {
        select: {
          dommeId: true,
          subId: true,
          type: true,
          members: {
            where: { userId: me.id },
            select: { userId: true },
          },
        },
      },
    },
  });

  if (!message) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });

  const convo = message.conversation;
  const isMember =
    convo.type === 'DM'
      ? convo.dommeId === me.id || convo.subId === me.id
      : convo.members.length > 0;

  if (!isMember) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const url = await presignGet(decodedKey, 60);
  return NextResponse.redirect(url);
}