'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { assertCanInteractForPostId } from '@/app/actions/blocks';

export type AddCommentResult =
  | { ok: true; id: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'INVALID_INPUT' | 'SERVER_ERROR' | 'INTERACTION_BLOCKED' };

export async function addCommentAction(formData: FormData): Promise<AddCommentResult> {
  try {
    const me = await getCurrentUser();
    if (!me) return { ok: false, error: 'UNAUTHORIZED' };

    const postId = String(formData.get('postId') ?? '');
    const text = String(formData.get('text') ?? '').trim();
    const parentIdRaw = formData.get('parentId');
    const parentId = parentIdRaw ? String(parentIdRaw) : null;

    if (!postId || !text) return { ok: false, error: 'INVALID_INPUT' };

    // Block prüfen
    try {
      await assertCanInteractForPostId(postId, me.id);
    } catch {
      return { ok: false, error: 'INTERACTION_BLOCKED' };
    }

    // Wenn es eine Antwort ist, sicherstellen, dass der Parent existiert und zum selben Post gehört
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { postId: true } });
      if (!parent || parent.postId !== postId) return { ok: false, error: 'INVALID_INPUT' };
    }

    const created = await prisma.comment.create({
      data: {
        id: randomUUID(),
        postId,
        userId: me.id,
        text,
        parentId, // <— wichtig für Replies/Notifications
      },
      select: { id: true },
    });

    // Seite revalidieren (best-effort)
    try {
      const hdrs = await headers();
      const referer = hdrs.get('referer');
      if (referer) {
        const url = new URL(referer);
        revalidatePath(url.pathname, 'page');
      }
    } catch {}

    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: 'SERVER_ERROR' };
  }
}

export async function addCommentActionVoid(formData: FormData): Promise<void> {
  await addCommentAction(formData);
}
