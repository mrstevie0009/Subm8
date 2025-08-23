'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

/** Bookmark hinzufügen (idempotent per upsert). Erwartet: postId */
export async function addBookmark(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;
  const postId = String(formData.get('postId') ?? '');
  if (!postId) return;

  await prisma.bookmark.upsert({
    where: { userId_postId: { userId: me.id, postId } },
    update: {},
    create: { userId: me.id, postId },
  });
}

/** Bookmark entfernen. Erwartet: postId */
export async function removeBookmark(formData: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;
  const postId = String(formData.get('postId') ?? '');
  if (!postId) return;

  await prisma.bookmark
    .delete({ where: { userId_postId: { userId: me.id, postId } } })
    .catch(() => {});
}
