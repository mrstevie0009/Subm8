// src/app/actions/comments.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { assertCanInteractForPostId } from '@/app/actions/blocks';

// 🔹 neu: unser Storage (Cloudflare R2 / lokal)
import { getStorage, buildKey } from '@/lib/storage';

// 🔹 behalten wir nur für das Size-Limit
import { envMaxUploadBytes } from '@/lib/uploadGuard';

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

        // Datei speichern (Bild / GIF / Video) → Cloudflare R2 / S3
    let mediaUrl: string | null = null;

    if (file && file.size > 0) {
      // 🔹 simples Size-Limit (z.B. 16 MB, kannst du anpassen)
      const maxBytes = envMaxUploadBytes(16);
      if (file.size > maxBytes) {
        return { ok: false, error: 'INVALID_INPUT' };
      }

      const contentType = file.type || 'application/octet-stream';

      // Key unter "post-media/..." – damit landet es in deiner R2-Bucket/CDN
      // (wenn du lieber "comment-media" willst, müsstest du buildKey um diesen Typ erweitern)
      const key = buildKey('post-media', file.name || `comment-${Date.now()}`);

      const storage = getStorage();
      const arrayBuffer = await file.arrayBuffer();

      const { publicUrl } = await storage.put({
        key,
        data: arrayBuffer,
        contentType,
        cacheControl: contentType.startsWith('video/')
          ? 'public, max-age=604800'              // 7 Tage für Videos
          : 'public, max-age=31536000, immutable' // 1 Jahr für Bilder/GIFs
      });

      mediaUrl = publicUrl; // ← Cloudflare-/CDN-URL
    }

    const created = await prisma.comment.create({
      data: {
        id: randomUUID(),
        postId,
        userId: me.id,
        text: text || '',
        parentId,
        mediaUrl,   
        mediaAlt,  
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
