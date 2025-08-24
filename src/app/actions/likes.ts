'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getAuth } from '@/lib/auth';

export async function likePostAction(formData: FormData): Promise<void> {
  const session = await getAuth();
  if (!session?.user?.id) return;
  const postId = String(formData.get('postId') || '');
  if (!postId) return;

  await prisma.like.upsert({
    where: { userId_postId: { userId: session.user.id, postId } },
    create: { userId: session.user.id, postId },
    update: {},
  });

  // Seite(n) neu validieren, damit Counts/Viewer-Status korrekt sind
  revalidatePath('/', 'page'); // Home
  revalidatePath('/[locale]', 'page'); // falls du locales nutzt
}

export async function unlikePostAction(formData: FormData): Promise<void> {
  const session = await getAuth();
  if (!session?.user?.id) return;
  const postId = String(formData.get('postId') || '');
  if (!postId) return;

  await prisma.like.deleteMany({
    where: { userId: session.user.id, postId },
  });

  revalidatePath('/', 'page');
  revalidatePath('/[locale]', 'page');
}
