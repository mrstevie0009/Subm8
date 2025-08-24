// src/app/actions/follow.ts
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

export async function followAction(formData: FormData) {
  const session = await getAuth();
  if (!session?.user?.id) return;

  const targetId = await resolveTargetUserId(formData);
  if (!targetId || targetId === session.user.id) return;

  // upsert, falls Follow schon existiert
  await prisma.follow.upsert({
    where: { followerId_followeeId: { followerId: session.user.id, followeeId: targetId } },
    create: { followerId: session.user.id, followeeId: targetId },
    update: {},
  });

  // Seiten, die häufig Follow-Status anzeigen, neu validieren
  revalidatePath(`/${'en'}`); // Home (ersetze 'en' ggf. durch deine Default-Locale oder eigenes Revalidate-Konzept)
  revalidatePath(`/${'en'}/notifications`);
}

export async function unfollowAction(formData: FormData) {
  const session = await getAuth();
  if (!session?.user?.id) return;

  const targetId = await resolveTargetUserId(formData);
  if (!targetId || targetId === session.user.id) return;

  await prisma.follow.deleteMany({
    where: { followerId: session.user.id, followeeId: targetId },
  });

  revalidatePath(`/${'en'}`);
  revalidatePath(`/${'en'}/notifications`);
}
