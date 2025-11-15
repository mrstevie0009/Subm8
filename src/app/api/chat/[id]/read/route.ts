// src/app/api/chat/[id]/read/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    if (!me) {
      return Response.json(
        { ok: false, error: 'Not authenticated' },
        { status: 401 },
      );
    }

    // sicherstellen, dass ich Teilnehmer bin
    const convo = await prisma.conversation.findUnique({
      where: { id },
      select: { id: true, dommeId: true, subId: true },
    });
    if (!convo) {
      return Response.json(
        { ok: false, error: 'Not found' },
        { status: 404 },
      );
    }
    const iAmDomme = convo.dommeId === me.id;
    const iAmSub = convo.subId === me.id;
    if (!iAmDomme && !iAmSub) {
      return Response.json(
        { ok: false, error: 'Forbidden' },
        { status: 403 },
      );
    }

    // Zähler auf 0 setzen (Quelle der Wahrheit für /api/chat)
    await prisma.conversation.update({
      where: { id },
      data: iAmDomme ? { unreadForDomme: 0 } : { unreadForSub: 0 },
    });

    return Response.json(
      { ok: true },
      { headers: { 'cache-control': 'private, no-store' } },
    );
  } catch (e) {
    console.error('POST /api/chat/[id]/read failed:', e);
    return Response.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 },
    );
  }
}
