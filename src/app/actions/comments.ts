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
    if (!postId || !text) return { ok: false, error: 'INVALID_INPUT' };

    // ❗ block-check
    try {
      await assertCanInteractForPostId(me.id, postId);
    } catch {
      return { ok: false, error: 'INTERACTION_BLOCKED' };
    }

    const created = await prisma.comment.create({
      data: {
        id: randomUUID(),
        postId,
        userId: me.id,
        text,
      },
      select: { id: true },
    });

    // Revalidate die Seite, von der der Request kam (best-effort)
    try {
      const hdrs = headers();
      const referer = (await hdrs).get('referer');
      if (referer) {
        const url = new URL(referer);
        revalidatePath(url.pathname, 'page');
      }
    } catch {
      // ignore
    }

    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: 'SERVER_ERROR' };
  }
}

/** Void adapter so <form action={...}> matches React's expected signature */
export async function addCommentActionVoid(formData: FormData): Promise<void> {
  await addCommentAction(formData);
}
