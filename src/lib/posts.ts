// src/lib/posts.ts
import { prisma } from '@/lib/prisma';

/**
 * Löscht einen Original-Post und alle zugehörigen Reposts.
 * Prüft vorher, ob requesterId der Autor des Original-Posts ist.
 *
 * Reposts sind bei dir über Post.repostOfId mit dem Original verknüpft.
 * Likes/Bookmarks/Comments/UploadedMedia hängen an Post und werden dank onDelete: Cascade mit gelöscht.
 */
export async function purgePostAndReposts(postId: string, requesterId: string): Promise<void> {
  const original = await prisma.post.findUnique({
    where: { id: postId },
    select: { id: true, authorId: true },
  });
  if (!original) throw new Error('NOT_FOUND');
  if (String(original.authorId) !== String(requesterId)) throw new Error('FORBIDDEN');

  await prisma.$transaction(async (tx) => {
    // Reposts zuerst
    await tx.post.deleteMany({ where: { repostOfId: postId } });

    // Abhängigkeiten manuell löschen (nur wenn Cascade fehlt)
    await tx.comment.deleteMany({ where: { postId } });
    await tx.like.deleteMany({ where: { postId } });
    await tx.bookmark.deleteMany({ where: { postId } });
    await tx.uploadedMedia?.deleteMany?.({ where: { postId } }); // falls Modell vorhanden

    // Original löschen
    await tx.post.delete({ where: { id: postId } });
  });
}

/**
 * Alias für ältere Aufrufer (falls du den Namen schon irgendwo nutzt).
 * contentId == postId in deinem Schema.
 */
export async function purgeContentAndReposts(
  contentId: string,
  requesterId: string
): Promise<void> {
  return purgePostAndReposts(contentId, requesterId);
}
