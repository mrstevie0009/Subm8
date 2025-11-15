// src/app/_actions/admin.ts
'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { assertAdmin, getAdminIdentity } from '@/lib/admin';
import { unblockById } from '@/lib/bruteforce';

/* --------------------------- Bruteforce / Login --------------------------- */

export async function unblockThrottleAction(form: FormData) {
  await assertAdmin();
  const id = String(form.get('id') ?? '');
  if (!id) throw new Error('missing id');
  await unblockById(id);
  revalidatePath('/[locale]/admin', 'page');
}

/* ----------------------------- Admin Actions ------------------------------ */

export async function deletePostAction(form: FormData) {
  await assertAdmin();
  const postId = String(form.get('postId') ?? '');
  if (!postId) throw new Error('postId missing');

  await prisma.post.delete({ where: { id: postId } }).catch(() => {});
  await prisma.$executeRaw`
    UPDATE "ContentReport" SET "resolvedAt" = NOW()
    WHERE "targetType"::text = 'POST' AND "targetId" = ${postId} AND "resolvedAt" IS NULL
  `;

  revalidatePath('/[locale]/admin', 'page');
}

export async function deactivateOrDeleteUserAction(form: FormData) {
  await assertAdmin();
  const userId = String(form.get('userId') ?? '');
  if (!userId) throw new Error('userId missing');

  const hasIsDeactivated = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'isDeactivated'
  `;

  if (hasIsDeactivated.length) {
    await prisma.user.update({ where: { id: userId }, data: { isDeactivated: true } }).catch(() => {});
    await prisma.session.deleteMany({ where: { userId } }).catch(() => {});
  } else {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  await prisma.$executeRaw`
    UPDATE "ContentReport" SET "resolvedAt" = NOW()
    WHERE "targetType"::text = 'USER' AND "targetId" = ${userId} AND "resolvedAt" IS NULL
  `;

  revalidatePath('/[locale]/admin', 'page');
}

export async function resolveReportsAction(form: FormData) {
  const admin = await getAdminIdentity();
  if (!admin) throw new Error('Not authorized');

  const targetType = String(form.get('targetType') ?? '');
  const targetId = String(form.get('targetId') ?? '');
  const note = (form.get('note') as string | null) ?? null;
  if (!targetType || !targetId) throw new Error('missing fields');

  await prisma.$executeRaw`
    UPDATE "ContentReport"
    SET "resolvedAt" = NOW(),
        "resolvedByAdminId" = ${admin.id},
        "resolutionNote" = ${note}
    WHERE "targetType"::text = ${targetType}
      AND "targetId"   = ${targetId}
      AND "resolvedAt" IS NULL
  `;

  revalidatePath('/[locale]/admin', 'page');
}

export async function resolveGroupReportsAction(form: FormData) {
  await assertAdmin();
  const conversationId = String(form.get('conversationId') ?? '');
  if (!conversationId) throw new Error('conversationId missing');

  await prisma.conversationReport.deleteMany({ where: { conversationId } });

  revalidatePath('/[locale]/admin', 'page');
}
