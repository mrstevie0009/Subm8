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
  const handle = String(formData.get('handle') || '');
  const locale = String(formData.get('locale') || '');
  if (!postId) return { ok: false, error: 'Missing postId' };

  const me = await getCurrentUser();
  if (!me?.id) return { ok: false, error: 'Not authenticated' };

  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!post) return { ok: false, error: 'Post not found' };
  if (post.authorId !== me.id) return { ok: false, error: 'Not allowed' };

  await prisma.user.update({
    where: { id: me.id },
    data: { pinnedPostId: post.id },
  });

  // Konkrete Profilseite revalidieren
  try {
    if (handle && locale) {
      revalidatePath(`/${locale}/u/${handle.toLowerCase()}`, 'page');
    } else {
      revalidatePath('/[locale]/u/[handle]', 'page'); // Fallback
    }
  } catch {}

  return { ok: true, pinnedPostId: post.id };
}

export async function unpinPostAction(formData?: FormData): Promise<PinResponse> {
  const handle = String(formData?.get('handle') || '');
  const locale = String(formData?.get('locale') || '');

  const me = await getCurrentUser();
  if (!me?.id) return { ok: false, error: 'Not authenticated' };

  await prisma.user.update({
    where: { id: me.id },
    data: { pinnedPostId: null },
  });

  try {
    if (handle && locale) {
      revalidatePath(`/${locale}/u/${handle.toLowerCase()}`, 'page');
    } else {
      revalidatePath('/[locale]/u/[handle]', 'page');
    }
  } catch {}

  return { ok: true, pinnedPostId: null };
}
