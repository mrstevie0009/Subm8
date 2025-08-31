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

  // ❗ Autor hat mich blockiert?
  try {
    await assertCanInteractForPostId(session.user.id, postId);
  } catch {
    return; // keine Like-Änderung
  }

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

  // Unliken erlauben (auch wenn inzwischen blockiert)
  await prisma.like.deleteMany({
    where: { userId: session.user.id, postId },
  });

  revalidatePath('/', 'page');
  revalidatePath('/[locale]', 'page');
}
