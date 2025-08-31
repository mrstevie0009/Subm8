// src/app/actions/likes.ts
'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';
import { assertCanInteractForPostId } from '@/app/actions/blocks';

export async function likePostAction(formData: FormData): Promise<void> {
  const session = await getAuth();
  if (!session?.user?.id) return;
  const postId = String(formData.get('postId') || '');
  if (!postId) return;

  await assertCanInteractForPostId(postId, session.user.id);

  await prisma.like.upsert({
    where: { userId_postId: { userId: session.user.id, postId } },
    create: { userId: session.user.id, postId },
    update: {},
  });

  revalidatePath('/', 'page');
  revalidatePath('/[locale]', 'page');
}

export async function unlikePostAction(formData: FormData): Promise<void> {
  const session = await getAuth();
  if (!session?.user?.id) return;
  const postId = String(formData.get('postId') || '');
  if (!postId) return;

  await assertCanInteractForPostId(postId, session.user.id);

  await prisma.like.deleteMany({
    where: { userId: session.user.id, postId },
  });

  revalidatePath('/', 'page');
  revalidatePath('/[locale]', 'page');
}
