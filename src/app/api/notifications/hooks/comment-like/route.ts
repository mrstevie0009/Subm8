// src/app/api/notifications/hooks/comment-like/route.ts
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

/**
 * Fire-and-forget Hook, wenn ein Kommentar geliked wird.
 *
 * Body (JSON):
 * {
 *   commentId: string;
 *   postId: string;
 * }
 */
export async function POST(req: Request) {
  try {
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 200 });
    }

    const json = await req.json().catch(() => ({}));
    const commentId = typeof json?.commentId === 'string' ? json.commentId : null;
    const postId = typeof json?.postId === 'string' ? json.postId : null;

    if (!commentId) {
      return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD' }, { status: 200 });
    }

    // Platz für spätere Realtime/WebPush/Job-Trigger …

    return NextResponse.json({ ok: true, commentId, postId });
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('notifications/hooks/comment-like POST failed:', err);
    }
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 200 });
  }
}
