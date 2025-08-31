// src/app/actions/blocks.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

async function revalidateFromReferer() {
  try {
    const hdrs = await headers();              // <- await, sonst TS-Fehler
    const referer = hdrs.get('referer');
    if (referer) {
      const url = new URL(referer);
      revalidatePath(url.pathname, 'page');
    }
  } catch {}
}

/** Wer wen blockiert? Wenn eine der beiden Richtungen existiert, ist Interaktion verboten. */
export async function assertCanInteractForPostId(postId: string, actorUserId: string) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) return; // nicht gefunden -> nichts tun

  const authorId = post.authorId;
  if (authorId === actorUserId) return; // eigene Posts darf man immer

  const blocked = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: authorId,    blockedId: actorUserId }, // Autor blockiert Actor
        { blockerId: actorUserId, blockedId: authorId },    // Actor blockiert Autor
      ],
    },
    select: { blockerId: true },
  });

  if (blocked) throw new Error('BLOCKED');
}

export async function blockUserAction(formData: FormData) {
  const session = await getAuth();
  if (!session?.user?.id) return;
  const handle = String(formData.get('blockedHandle') ?? '').trim().toLowerCase();
  if (!handle) return;

  const target = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
  if (!target || target.id === session.user.id) return;

  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: target.id } },
    create: { blockerId: session.user.id, blockedId: target.id },
    update: {},
  });

  // mutually unfollow
  await prisma.follow.deleteMany({
    where: {
      OR: [
        { followerId: session.user.id, followeeId: target.id },
        { followerId: target.id,        followeeId: session.user.id },
      ],
    },
  });

  revalidatePath('/');
  revalidatePath('/[locale]');
  await revalidateFromReferer();
}

export async function unblockUserAction(formData: FormData) {
  const session = await getAuth();
  if (!session?.user?.id) return;
  const handle = String(formData.get('blockedHandle') ?? '').trim().toLowerCase();
  if (!handle) return;

  const target = await prisma.user.findUnique({ where: { handle }, select: { id: true } });
  if (!target) return;

  await prisma.block.deleteMany({
    where: { blockerId: session.user.id, blockedId: target.id },
  });

  revalidatePath('/');
  revalidatePath('/[locale]');
  await revalidateFromReferer();
}
