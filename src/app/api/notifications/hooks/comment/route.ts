// src/app/api/notifications/hooks/comment/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

/**
 * Fire-and-forget Hook, der beim Erstellen eines Kommentars/Replies
 * aufgerufen wird. Aktuell keine Persistenz nötig, weil die
 * Notifications-Liste serverseitig aus bestehenden Relationen aggregiert wird.
 *
 * Body (JSON):
 * {
 *   postId: string;
 *   parentId: string | null;
 *   text: string | null;
 * }
 */
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      // Da der Hook clientseitig via sendBeacon/fetch kommt, reicht ein 200 mit ok:false.
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 200 });
    }

    // Payload validieren (soft)
    const json = await req.json().catch(() => ({}));
    const postId = typeof json?.postId === 'string' ? json.postId : null;
    const parentId = typeof json?.parentId === 'string' ? json.parentId : null;
    const text = typeof json?.text === 'string' ? json.text : null;

    // Hier könntest du später Realtime/WebPush/Jobs triggern.
    // Der Feed selbst benötigt nichts weiter, weil GET /api/notifications
    // die Events aus der DB ableitet.

    if (!postId) {
      return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 200 });
    }

    return NextResponse.json({ ok: true, postId, parentId, text });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('notifications/hooks/comment POST failed:', err);
    }
    // bewusster 200er, um den Client nicht zu stören (sendBeacon etc.)
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 200 });
  }
}
