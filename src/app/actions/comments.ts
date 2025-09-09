// src/app/actions/comments.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { assertCanInteractForPostId } from '@/app/actions/blocks';
import { guardAndSave, envMaxUploadBytes } from '@/lib/uploadGuard';

export type AddCommentResult =
  | { ok: true; id: string }
  | { ok: false; error: 'UNAUTHORIZED' | 'INVALID_INPUT' | 'SERVER_ERROR' | 'INTERACTION_BLOCKED' };

export async function addCommentAction(formData: FormData): Promise<AddCommentResult> {
  try {
    const me = await getCurrentUser();
    if (!me) return { ok: false, error: 'UNAUTHORIZED' };

    const postId = String(formData.get('postId') ?? '');
    const rawText = String(formData.get('text') ?? '');
    const text = rawText.trim();
    const parentIdRaw = formData.get('parentId');
    const parentId = parentIdRaw ? String(parentIdRaw) : null;

    // optionales Bild/GIF (keine Videos)
    const file = (formData.get('media') as File | null) ?? null;
    const mediaAltRaw = String(formData.get('mediaAlt') ?? '').trim();
    const mediaAlt = mediaAltRaw ? mediaAltRaw.slice(0, 200) : null;

    // Mindestens Text ODER Bild
    if (!postId || (!text && !file)) return { ok: false, error: 'INVALID_INPUT' };

    // Block prüfen
    try {
      await assertCanInteractForPostId(postId, me.id);
    } catch {
      return { ok: false, error: 'INTERACTION_BLOCKED' };
    }

    // Parent prüfen (Antwort)
    if (parentId) {
      const parent = await prisma.comment.findUnique({ where: { id: parentId }, select: { postId: true } });
      if (!parent || parent.postId !== postId) return { ok: false, error: 'INVALID_INPUT' };
    }

    // Datei speichern (nur Bilder/GIFs – uploadGuard erzwingt das per Magic Bytes)
    let mediaUrl: string | null = null;
    if (file && file.size > 0) {
      const res = await guardAndSave(file, {
        maxSize: envMaxUploadBytes(8), // Default 8 MB (via ENV überschreibbar)
        publicSubdir: 'comment-media',
      });
      if (!res.ok) {
        return { ok: false, error: 'INVALID_INPUT' };
      }
      mediaUrl = res.publicPath;
    }

    const created = await prisma.comment.create({
      data: {
        id: randomUUID(),
        postId,
        userId: me.id,
        // Prisma erwartet string, also bei Bild-only: ''
        text: text || '',
        parentId,
        mediaUrl,   // ⬅️ jetzt bekannt im Schema
        mediaAlt,   // ⬅️ jetzt bekannt im Schema
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
    } catch {
      // ignore
    }

    return { ok: true, id: created.id };
  } catch (e) {
    console.error('addCommentAction failed:', e);
    return { ok: false, error: 'SERVER_ERROR' };
  }
}

export async function addCommentActionVoid(formData: FormData): Promise<void> {
  await addCommentAction(formData);
}
