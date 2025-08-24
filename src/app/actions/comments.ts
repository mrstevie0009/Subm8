// src/app/actions/comments.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'crypto';

export async function addCommentAction(formData: FormData) {
  try {
    const me = await getCurrentUser();
    if (!me) return { ok: false as const, error: 'UNAUTHORIZED' };

    const postId = String(formData.get('postId') || '');
    const text = String(formData.get('text') || '').trim();
    if (!postId || !text) return { ok: false as const, error: 'INVALID_INPUT' };

    const created = await prisma.comment.create({
      data: {
        id: randomUUID(),        // ⬅️ wichtig, weil dein Prisma-Schema keine Default-ID hat
        postId,
        userId: me.id,
        text,
      },
      select: { id: true },
    });

    return { ok: true as const, id: created.id };
  } catch {
    return { ok: false as const, error: 'SERVER_ERROR' };
  }
}
