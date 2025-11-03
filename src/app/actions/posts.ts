// src/app/actions/posts.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';
// ⬇️ guardAndSave raus – wir validieren nur Größe
import { envMaxUploadBytes } from '@/lib/uploadGuard';
import { takeToken } from '@/lib/ratelimit';
import { postsPerMinute, rateIntervalMs } from '@/lib/config';
import { redirect } from 'next/navigation';

// ⬇️ NEU: Storage-Adapter verwenden
import { getStorage, buildKey } from '@/lib/storage';

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
  const preUploaded = formData.getAll('uploadedUrl').map(v => String(v)).filter(Boolean);

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

  if (!text && mediaFiles.length === 0 && preUploaded.length === 0 && !quoteOfId) {
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

  // ⬇️ NEU: Storage-Adapter besorgen (lokal oder S3/R2 je nach ENV)
  const storage = getStorage();

  // Legacy-Felder (erstes Medium)
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

      // ⬇️ Größe selbst prüfen (statt guardAndSave)
      if (file.size > maxBytes) {
        redirect(toURL(returnTo, { error: `Datei zu groß (${Math.round(file.size/1e6)}MB).` }));
      }

      // ⬇️ Key + Upload
      const key = buildKey('post-media', file.name || 'upload.bin');
      const { publicUrl } = await storage.put({
        key,
        data: await file.arrayBuffer(),
        contentType: mime || 'application/octet-stream',
        cacheControl: isVideo
          ? 'public, max-age=604800' // 7d
          : 'public, max-age=31536000, immutable', // 1y
      });

      const kind = kindFromMime(mime);
      const alt =
        hasAltArray
          ? (mediaAltAll[i] ?? '').slice(0, 200) || null
          : (i === 0 && singleMediaAlt ? singleMediaAlt.slice(0, 200) : '') || null;

      uploaded.push({ url: publicUrl, kind, alt, mime });

      if (i === 0) {
        mediaUrl = publicUrl;
        mediaAlt = alt;
        mediaType = mime || null;
      }
    }
  }
  
  // Bereits direkt auf R2 hochgeladene Dateien anhängen
  if (preUploaded.length) {
    for (const url of preUploaded) {
      const lower = url.split('?')[0].toLowerCase();

      const isVideo =
        /\.(mp4|webm|mov|m4v|mkv|ogv|ogg)$/.test(lower);
      const isGif = /\.gif$/.test(lower);

      const kind: 'image' | 'video' | 'gif' =
        isVideo ? 'video' : isGif ? 'gif' : 'image';

      // → mime gleich mitliefern (wird unten in prisma.post.create -> uploaded.type gespeichert)
      const mime =
        /\.mp4$/.test(lower)  ? 'video/mp4'  :
        /\.webm$/.test(lower) ? 'video/webm' :
        /\.mov$/.test(lower)  ? 'video/quicktime' :
        /\.m4v$/.test(lower)  ? 'video/x-m4v' :
        /\.mkv$/.test(lower)  ? 'video/x-matroska' :
        /\.ogv$/.test(lower)  ? 'video/ogg' :
        /\.ogg$/.test(lower)  ? 'video/ogg' :
        /\.gif$/.test(lower)  ? 'image/gif'  :
        /\.png$/.test(lower)  ? 'image/png'  :
        /\.jpe?g$/.test(lower)? 'image/jpeg' :
        null;

      uploaded.push({ url, kind, alt: null, mime });

      // Legacy-Felder für das *erste* Medium setzen, falls noch leer
      if (!mediaUrl) {
        mediaUrl = url;
        mediaAlt = null;
        mediaType = mime || (isVideo ? 'video/*' : isGif ? 'image/gif' : 'image/*');
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

        // Alle Medien in Relation speichern
        uploaded: uploaded.length
          ? {
              create: uploaded.map((m) => ({
                url: m.url,
                alt: m.alt ?? null,
                type: m.mime ?? null, // z.B. image/png, video/mp4
              })),
            }
          : undefined,
      },
    });
  } catch {
    redirect(toURL(returnTo, { error: 'Speichern fehlgeschlagen.' }));
  }

  // Revalidate + zurück
  revalidatePath('/');
  revalidatePath(returnTo);
  redirect(returnTo);
}

export { createPost as createPostAction };
