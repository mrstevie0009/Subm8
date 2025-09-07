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
    if (v !== undefined && v !== null && String(v).length > 0) url.searchParams.set(k, String(v));
  }
  return url.pathname + (url.search ? url.search : '');
}

/**
 * Server Action: normalen Post ODER Quote-Post erstellen.
 * Erwartete FormData-Felder:
 * - text (string)
 * - media (File, optional)
 * - mediaAlt (string, optional)
 * - quoteOfId (string, optional)
 * - returnTo (string) → Zielroute nach Erfolg/Fehler
 */
export async function createPost(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  const returnToRaw = String(formData.get('returnTo') ?? '/');
  const returnTo = returnToRaw.startsWith('/') ? returnToRaw : '/';

  if (!me) {
    redirect(toURL(returnTo, { error: 'Nicht eingeloggt.' }));
  }

  // Rate Limit z. B. 5/Minute
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
  const file = formData.get('media') as File | null;
  const mediaAltRaw = String(formData.get('mediaAlt') ?? '').trim();
  const quoteOfIdRaw = formData.get('quoteOfId');
  const quoteOfId = typeof quoteOfIdRaw === 'string' && quoteOfIdRaw.length > 0 ? quoteOfIdRaw : null;

  // Mindestens Text ODER Bild ODER Quote notwendig
  if (!text && !file && !quoteOfId) {
    redirect(toURL(returnTo, { error: 'Bitte Text, Bild oder eine Quote auswählen.' }));
  }

  const mediaAlt: string | null = mediaAltRaw ? mediaAltRaw.slice(0, 200) : null;

  // Optionaler Upload
  let mediaUrl: string | null = null;
  if (file && file.size > 0) {
    const maxBytes = envMaxUploadBytes(5);
    const res = await guardAndSave(file, { maxSize: maxBytes, publicSubdir: 'uploads' });
    if (!res.ok) {
      redirect(toURL(returnTo, { error: res.message }));
    }
    mediaUrl = res.publicPath;
  }

  // Quote-Ziel prüfen
  if (quoteOfId) {
    const target = await prisma.post.findUnique({ where: { id: quoteOfId }, select: { id: true } });
    if (!target) {
      redirect(toURL(returnTo, { error: 'Der gequotete Post existiert nicht (mehr).' }));
    }
  }

  try {
    await prisma.post.create({
      data: {
        authorId: me!.id,
        text,        // darf leer sein, wenn nur Quote/Media
        mediaUrl,
        mediaAlt,
        quoteOfId,   // ← macht den Post zum Quote-Post
      },
    });
  } catch {
    redirect(toURL(returnTo, { error: 'Speichern fehlgeschlagen.' }));
  }

  // Feed/Seiten revalidieren
  revalidatePath('/');
  revalidatePath(returnTo);

  redirect(returnTo);
}

// 🔁 Alias-Export für bestehende Importe (QuoteOverlay)
export { createPost as createPostAction };
