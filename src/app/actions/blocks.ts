'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/currentUser';

/** Tabelle anlegen (idempotent), wenn du kein Prisma-Model hast */
async function ensureUserBlockTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserBlock" (
      "blockerId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "blockedId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("blockerId","blockedId")
    );
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "UserBlock_blocked_idx"
    ON "UserBlock"("blockedId");
  `);
}

/** Prüft: Wurde actorId vom ownerId blockiert? (owner → actor) */
export async function isBlockedBy(actorId: string, ownerId: string): Promise<boolean> {
  await ensureUserBlockTable();
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM "UserBlock"
      WHERE "blockerId" = ${ownerId} AND "blockedId" = ${actorId}
    ) AS "exists";
  `;
  return !!rows[0]?.exists;
}

/** Interaktionen mit einem Post nur erlauben, wenn der Autor mich NICHT blockiert */
export async function assertCanInteractForPostId(actorId: string, postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    select: { authorId: true },
  });
  if (!post) throw new Error('POST_NOT_FOUND');

  const blocked = await isBlockedBy(actorId, post.authorId);
  if (blocked) throw new Error('INTERACTION_BLOCKED');
}

/** Follow nur erlauben, wenn Ziel mich NICHT blockiert */
export async function assertCanFollow(actorId: string, targetUserId: string): Promise<void> {
  if (await isBlockedBy(actorId, targetUserId)) {
    throw new Error('FOLLOW_BLOCKED');
  }
}

/** DM nur erlauben, wenn Empfänger mich NICHT blockiert */
export async function assertCanMessage(senderId: string, recipientId: string): Promise<void> {
  if (await isBlockedBy(senderId, recipientId)) {
    throw new Error('DM_BLOCKED');
  }
}

/** User blockieren (A blockiert B) – B wird automatisch als Follower von A entfernt */
export async function blockUserAction(form: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;

  await ensureUserBlockTable();

  // entweder per ID oder Handle blocken
  const byId = (form.get('blockedUserId') as string | null) ?? null;
  const byHandleRaw = (form.get('blockedHandle') as string | null) ?? null;
  let targetId: string | null = byId;

  if (!targetId && byHandleRaw) {
    const handle = byHandleRaw.replace(/^@/, '').toLowerCase();
    const u = await prisma.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true },
    });
    targetId = u?.id ?? null;
  }

  if (!targetId || targetId === me.id) return;

  // Eintrag anlegen (A → B)
  await prisma.$executeRaw`
    INSERT INTO "UserBlock" ("blockerId", "blockedId")
    VALUES (${me.id}, ${targetId})
    ON CONFLICT ("blockerId","blockedId") DO NOTHING
  `;

  // B folgt A? → entfolgen
  await prisma.follow.deleteMany({
    where: { followerId: targetId, followeeId: me.id },
  });

  // optional: offene Konversationen schließen/ausblenden – je nach Produktlogik

  // Revalidate gängige Pfade
  revalidatePath('/[locale]', 'page');
  revalidatePath('/', 'page');
}

/** Blockierung aufheben */
export async function unblockUserAction(form: FormData): Promise<void> {
  const me = await getCurrentUser();
  if (!me) return;

  const byId = (form.get('blockedUserId') as string | null) ?? null;
  const byHandleRaw = (form.get('blockedHandle') as string | null) ?? null;
  let targetId: string | null = byId;

  if (!targetId && byHandleRaw) {
    const handle = byHandleRaw.replace(/^@/, '').toLowerCase();
    const u = await prisma.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true },
    });
    targetId = u?.id ?? null;
  }

  if (!targetId || targetId === me.id) return;

  await prisma.$executeRaw`
    DELETE FROM "UserBlock"
    WHERE "blockerId" = ${me.id} AND "blockedId" = ${targetId}
  `;

  revalidatePath('/[locale]', 'page');
  revalidatePath('/', 'page');
}
