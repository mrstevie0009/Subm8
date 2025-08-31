'use server';

import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Hilfsfunktion: Ziel-UserId aus FormData auflösen (id oder handle)
 */
async function resolveTargetUserId(fd: FormData): Promise<string | null> {
  const byId = fd.get('userId');
  if (typeof byId === 'string' && byId.trim()) return byId.trim();

  const handle = fd.get('handle');
  if (typeof handle === 'string' && handle.trim()) {
    const user = await prisma.user.findUnique({
      where: { handle: handle.trim().toLowerCase() },
      select: { id: true },
    });
    return user?.id ?? null;
  }
  return null;
}

function revalidateCommon() {
  revalidatePath('/');           // Feed
  revalidatePath('/[locale]');   // locale-Startseite, falls verwendet
  revalidatePath('/[locale]/notifications');
}

export async function followAction(formData: FormData) {
  const session = await getAuth();
  if (!session?.user?.id) return;

  const targetId = await resolveTargetUserId(formData);
  if (!targetId || targetId === session.user.id) return;

  // **NEU**: Folgen verhindern, wenn irgendein Block existiert
  const isBlockedEither = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: session.user.id, blockedId: targetId }, // ich blockiere ihn/sie
        { blockerId: targetId,          blockedId: session.user.id }, // er/sie blockiert mich
      ],
    },
    select: { blockerId: true },
  });

  if (isBlockedEither) {
    // Sicherheitshalber alle Follows in beide Richtungen entfernen
    await prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: session.user.id, followeeId: targetId },
          { followerId: targetId,        followeeId: session.user.id },
        ],
      },
    });
    revalidateCommon();
    return; // kein Follow erlaubt
  }

  // upsert, falls Follow schon existiert
  await prisma.follow.upsert({
    where: { followerId_followeeId: { followerId: session.user.id, followeeId: targetId } },
    create: { followerId: session.user.id, followeeId: targetId },
    update: {},
  });

  revalidateCommon();
}

export async function unfollowAction(formData: FormData) {
  const session = await getAuth();
  if (!session?.user?.id) return;

  const targetId = await resolveTargetUserId(formData);
  if (!targetId || targetId === session.user.id) return;

  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followeeId: targetId },
  });

  revalidateCommon();
}
