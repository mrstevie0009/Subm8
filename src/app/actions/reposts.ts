// src/app/actions/reposts.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';
import { assertCanInteractForPostId } from '@/app/actions/blocks';

function assertStr(x: unknown): string {
  if (typeof x !== 'string' || !x.trim()) throw new Error('Invalid value');
  return x.trim();
}

export async function repostPostAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new Error('Unauthorized');

  const postId = assertStr(formData.get('postId'));
  await assertCanInteractForPostId(postId, me.id);

  await prisma.post.create({
    data: { authorId: me.id, text: '', repostOfId: postId },
  });

  revalidatePath('/');
  revalidatePath(`/p/${postId}`);
}

export async function quotePostAction(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) throw new Error('Unauthorized');

  const postId = assertStr(formData.get('postId'));
  const text   = assertStr(formData.get('text'));
  await assertCanInteractForPostId(postId, me.id);

  await prisma.post.create({
    data: { authorId: me.id, text, quoteOfId: postId },
  });

  revalidatePath('/');
  revalidatePath(`/p/${postId}`);
}
