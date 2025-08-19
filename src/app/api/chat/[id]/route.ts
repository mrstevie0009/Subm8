// src/app/api/chat/[id]/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      dommeId: true,
      subId: true,
      domme: { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
      sub:   { select: { id: true, handle: true, displayName: true, avatarUrl: true } },
    },
  });
  if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (convo.dommeId !== me.id && convo.subId !== me.id) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const iAmDomme = convo.dommeId === me.id;
  const other = iAmDomme ? convo.sub : convo.domme;

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    take: 200, // einfache Begrenzung
    select: {
      id: true,
      createdAt: true,
      authorId: true,
      text: true,
      mediaUrl: true,
      mediaType: true,
      reads: { where: { readerUserId: me.id }, select: { readerUserId: true } },
    },
  });

  // (Optional) Auto-Mark-as-read: alle Messages des anderen ohne Read-Eintrag für mich
  const unreadIds = messages
    .filter(m => m.authorId !== me.id && m.reads.length === 0)
    .map(m => m.id);
  if (unreadIds.length) {
    await prisma.messageRead.createMany({
      data: unreadIds.map(mid => ({ messageId: mid, readerUserId: me.id })),
      skipDuplicates: true,
    });
  }

  return Response.json({
    ok: true,
    me: { id: me.id },
    other,
    messages: messages.map(m => ({
      id: m.id,
      at: m.createdAt.toISOString(),
      authorId: m.authorId,
      text: m.text,
      mediaUrl: m.mediaUrl,
      mediaType: m.mediaType,
      read: m.reads.length > 0 || m.authorId === me.id,
    })),
  });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  const convo = await prisma.conversation.findUnique({
    where: { id },
    select: { id: true, dommeId: true, subId: true },
  });
  if (!convo) return Response.json({ ok: false, error: 'Not found' }, { status: 404 });
  if (convo.dommeId !== me.id && convo.subId !== me.id) {
    return Response.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null) as { text?: string } | null;
  const text = (body?.text ?? '').toString().trim();
  if (!text) return Response.json({ ok: false, error: 'Empty message' }, { status: 400 });
  if (text.length > 4000) return Response.json({ ok: false, error: 'Too long' }, { status: 400 });

  const msg = await prisma.message.create({
    data: {
      conversationId: id,
      authorId: me.id,
      text,
    },
    select: { id: true, createdAt: true, authorId: true, text: true },
  });

  return Response.json({
    ok: true,
    message: {
      id: msg.id,
      at: msg.createdAt.toISOString(),
      authorId: msg.authorId,
      text: msg.text,
    },
  });
}
