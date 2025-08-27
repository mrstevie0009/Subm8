'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'crypto';
import { revalidatePath /*, revalidateTag */ } from 'next/cache';
import { headers } from 'next/headers';

export type AddCommentResult =
  | { ok: true; id: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'INVALID_INPUT' | 'SERVER_ERROR' };

export async function addCommentAction(formData: FormData): Promise<AddCommentResult> {
  try {
    const me = await getCurrentUser();
    if (!me) return { ok: false, error: 'UNAUTHORIZED' };

    const postId = String(formData.get('postId') ?? '');
    const text = String(formData.get('text') ?? '').trim();
    if (!postId || !text) return { ok: false, error: 'INVALID_INPUT' };

    const created = await prisma.comment.create({
      data: {
        id: randomUUID(), // falls dein Prisma-Schema keine Default-ID hat
        postId,
        userId: me.id,
        text,
      },
      select: { id: true },
    });

    // 🔁 Revalidate the page the request came from (derived from Referer)
    try {
      const hdrs = await headers();               // <-- await here
      const referer = hdrs.get('referer');
      if (referer) {
        const url = new URL(referer);
        revalidatePath(url.pathname, 'page');
      }
    } catch {
      // ignore if headers() or URL parsing fails
    }

    // Alternative if your comments query uses a tag:
    // revalidateTag(`post:${postId}`);

    return { ok: true, id: created.id };
  } catch {
    return { ok: false, error: 'SERVER_ERROR' };
  }
}

/** Void adapter so <form action={...}> matches React's expected signature */
export async function addCommentActionVoid(formData: FormData): Promise<void> {
  await addCommentAction(formData);
}
