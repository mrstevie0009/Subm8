import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

  const convo = await prisma.conversation.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      domme: { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true } },
      sub:   { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, authorId: true, text: true, createdAt: true }
      }
    }
  });

  if (!convo) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

  const meIsDomme = convo.domme.id === me.id;
  const other = meIsDomme ? convo.sub : convo.domme;

  return NextResponse.json({
    ok: true,
    conversation: {
      id: convo.id,
      other: {
        id: other.id,
        username: other.handle,
        displayName: other.displayName,
        avatarUrl: other.avatarUrl,
        role: other.role, // <-- 'DOMME' | 'SUBMISSIVE' direkt aus DB
      },
      messages: convo.messages.map(m => ({
        id: m.id,
        senderId: m.authorId,
        text: m.text,
        createdAt: m.createdAt
      }))
    }
  });
}
