// src/app/actions/posts.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';
import { guardAndSave, envMaxUploadBytes } from '@/lib/uploadGuard';
import { takeToken } from '@/lib/ratelimit';
import { postsPerMinute, rateIntervalMs } from '@/lib/config';
import { redirect } from 'next/navigation';

function toURL(base: string, params: Record<string, string | number | undefined>) {
  const url = new URL(base, 'http://dummy');
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length > 0) {
      url.searchParams.set(k, String(v));
    }
  }
  return url.pathname + (url.search ? url.search : '');
}

/* ---------------- Multimedia Helpers ---------------- */
type MediaKind = 'image' | 'video' | 'gif';
type UIMedia = { url: string; alt?: string | null; kind: MediaKind; mime?: string | null };

const MAX_MEDIA_ITEMS = 10; // Hard cap

function kindFromMime(mime: string): MediaKind {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('video/')) return 'video';
  if (m === 'image/gif') return 'gif';
  return 'image';
}

/**
 * Server Action: Post (mit optionalen Medien + Quote)
 * Erwartete FormData Felder:
 * - text
 * - media (ein oder mehrere Files)
 * - mediaAlt (optional; entweder einzeln oder mehrfach)
 * - quoteOfId (optional)
 * - returnTo (Redirect Ziel)
 */
export async function createPost(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  const returnToRaw = String(formData.get('returnTo') ?? '/');
  const returnTo = returnToRaw.startsWith('/') ? returnToRaw : '/';

  if (!me) {
    redirect(toURL(returnTo, { error: 'Nicht eingeloggt.' }));
  }

  // Rate Limit
  const cap = postsPerMinute(5);
  const interval = rateIntervalMs(60_000);
  const decision = takeToken(`post:${me!.id}`, cap, interval);
  if (!decision.ok) {
    redirect(
      toURL(returnTo, {
        error: `Zu viele Posts. Bitte warte ${Math.ceil(decision.retryAfterMs / 1000)}s.`,
      }),
    );
  }

  const text = String(formData.get('text') ?? '').trim();

  // Medien sammeln (multi-support)
  let mediaFiles = formData.getAll('media').filter((x) => x instanceof File) as File[];
  if (mediaFiles.length === 0) {
    const single = formData.get('media');
    if (single instanceof File) mediaFiles = [single];
  }
  mediaFiles = mediaFiles.filter((f) => f && f.size > 0).slice(0, MAX_MEDIA_ITEMS);

  // Alt-Texte
  const mediaAltAll = formData
    .getAll('mediaAlt')
    .map((v) => String(v ?? '').trim())
    .filter((v) => v.length > 0);

  const singleMediaAlt = String(formData.get('mediaAlt') ?? '').trim();
  const hasAltArray = mediaAltAll.length > 0;

  const quoteOfIdRaw = formData.get('quoteOfId');
  const quoteOfId =
    typeof quoteOfIdRaw === 'string' && quoteOfIdRaw.length > 0 ? quoteOfIdRaw : null;

  if (!text && mediaFiles.length === 0 && !quoteOfId) {
    redirect(toURL(returnTo, { error: 'Bitte Text, Bild/Video oder eine Quote auswählen.' }));
  }

  if (quoteOfId) {
    const target = await prisma.post.findUnique({
      where: { id: quoteOfId },
      select: { id: true },
    });
    if (!target) {
      redirect(toURL(returnTo, { error: 'Der gequotete Post existiert nicht (mehr).' }));
    }
  }

  // Uploads
  let mediaUrl: string | null = null;
  let mediaAlt: string | null = null;
  let mediaType: string | null = null;

  const uploaded: UIMedia[] = [];

  if (mediaFiles.length > 0) {
    for (let i = 0; i < mediaFiles.length; i++) {
      const file = mediaFiles[i]!;
      const mime = file.type || '';
      const isVideo = mime.startsWith('video/');
      const maxBytes = isVideo ? envMaxUploadBytes(200) : envMaxUploadBytes(10);

      const res = await guardAndSave(file, { maxSize: maxBytes, publicSubdir: 'uploads' });
      if (!res.ok) {
        redirect(toURL(returnTo, { error: res.message }));
      }

      const url = res.publicPath;
      const kind = kindFromMime(mime);
      const alt =
        hasAltArray
          ? (mediaAltAll[i] ?? '').slice(0, 200) || null
          : (i === 0 && singleMediaAlt ? singleMediaAlt.slice(0, 200) : '') || null;

      uploaded.push({ url, kind, alt, mime });

      if (i === 0) {
        mediaUrl = url;
        mediaAlt = alt;
        mediaType = mime || null;
      }
    }
  }

  try {
    await prisma.post.create({
      data: {
        authorId: me!.id,
        text,
        mediaUrl,  // nur erstes Medium (legacy)
        mediaAlt,
        mediaType,
        quoteOfId,

        // NEU: alle Medien in die Relation UploadedMedia schreiben
        uploaded: uploaded.length
          ? {
              create: uploaded.map((m) => ({
                url: m.url,
                alt: m.alt ?? null,
                type: m.mime ?? null, // z.B. "image/png" oder "video/mp4"
              })),
            }
          : undefined,
      },
    });
  } catch {
    redirect(toURL(returnTo, { error: 'Speichern fehlgeschlagen.' }));
  }

  // Revalidieren
  revalidatePath('/');
  revalidatePath(returnTo);

  redirect(returnTo);
}

export { createPost as createPostAction };
