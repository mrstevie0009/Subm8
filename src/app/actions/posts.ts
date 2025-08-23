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
  const url = new URL(base, 'http://dummy'); // Base wird gleich abgeschnitten
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).length > 0) url.searchParams.set(k, String(v));
  }
  return url.pathname + (url.search ? url.search : '');
}

export async function createPost(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  const returnToRaw = String(formData.get('returnTo') ?? '/');
  const returnTo = returnToRaw.startsWith('/') ? returnToRaw : '/';

  if (!me) {
    redirect(toURL(returnTo, { error: 'Nicht eingeloggt.' }));
  }

  // Rate Limit (z. B. 5/Minute)
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

  if (!text && !file) {
    redirect(toURL(returnTo, { error: 'Bitte Text oder Bild angeben.' }));
  }

  const mediaAlt: string | null = mediaAltRaw ? mediaAltRaw.slice(0, 200) : null;

  let mediaUrl: string | null = null;
  if (file && file.size > 0) {
    const maxBytes = envMaxUploadBytes(5);
    const res = await guardAndSave(file, {
      maxSize: maxBytes,
      publicSubdir: 'uploads',
    });
    if (!res.ok) {
      redirect(toURL(returnTo, { error: res.message }));
    }
    mediaUrl = res.publicPath;
  }

  try {
    await prisma.post.create({
      data: {
        authorId: me!.id,
        text,
        mediaUrl,
        mediaAlt,
      },
    });
  } catch {
    redirect(toURL(returnTo, { error: 'Speichern fehlgeschlagen.' }));
  }

  // Revalidate und zurück zum Feed / Ziel
  revalidatePath('/');
  revalidatePath(returnTo);

  redirect(returnTo);
}
