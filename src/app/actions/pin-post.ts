// src/app/actions/pin-post.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';

type PinResponse =
  | { ok: true; pinnedPostId: string | null }
  | { ok: false; error: string };

export async function pinPostAction(formData: FormData): Promise<PinResponse> {
  const postId = String(formData.get('postId') || '');
  if (!postId) return { ok: false, error: 'Missing postId' };

  const me = await getCurrentUser();
  if (!me?.id) return { ok: false, error: 'Not authenticated' };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });

  if (!post) {
    return { ok: false, error: 'Post not found' };
  }
  if (post.authorId !== me.id) {
    return { ok: false, error: 'Not allowed' };
  }

  await prisma.user.update({
    where: { id: me.id },
    data: { pinnedPostId: post.id },
  });

  // Profilseiten neu validieren (Locale/Handle unbekannt – dient als Fallback)
  try {
    revalidatePath('/[locale]/u/[handle]');
  } catch {}

  return { ok: true, pinnedPostId: post.id };
}

export async function unpinPostAction(): Promise<PinResponse> {
  const me = await getCurrentUser();
  if (!me?.id) return { ok: false, error: 'Not authenticated' };

  await prisma.user.update({
    where: { id: me.id },
    data: { pinnedPostId: null },
  });

  try {
    revalidatePath('/[locale]/u/[handle]');
  } catch {}

  return { ok: true, pinnedPostId: null };
}
