'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';

function assertStr(x: unknown): string {
  if (typeof x !== 'string' || !x.trim()) throw new Error('Invalid value');
  return x.trim();
}

// Repost: erstellt einen neuen Post mit Verweis auf Original
export async function repostPostAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new Error('Unauthorized');

  const postId = assertStr(formData.get('postId'));

  await prisma.post.create({
    data: {
      authorId: me.id,
      text: '',              // klassischer Repost hat keinen eigenen Text
      repostOfId: postId,    // Verweis auf Original
    },
  });

  // optional: Feed/Detail revalidieren
  revalidatePath('/'); // dein Home-Feed
  revalidatePath(`/p/${postId}`);
}

// Quote: eigener Text + Verweis auf Original
export async function quotePostAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new Error('Unauthorized');

  const postId = assertStr(formData.get('postId'));
  const text   = assertStr(formData.get('text'));

  await prisma.post.create({
    data: {
      authorId: me.id,
      text,
      quoteOfId: postId,
    },
  });

  revalidatePath('/');
  revalidatePath(`/p/${postId}`);
}
