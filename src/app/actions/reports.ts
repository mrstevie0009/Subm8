// src/app/actions/reports.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { randomUUID } from 'crypto';
import { ReportTargetType } from '@prisma/client';

/**
 * Einen Post melden
 */
export async function reportPostAction(formData: FormData) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) throw new Error('Nicht angemeldet');

  const postId = String(formData.get('postId') ?? '').trim();
  const reason = String(formData.get('reason') ?? 'OTHER').trim();
  if (!postId) throw new Error('postId fehlt');

  await prisma.contentReport.create({
    data: {
      id: randomUUID(),
      targetType: ReportTargetType.POST,
      targetId: postId,
      reporterUserId: me.id,
      reason,
    },
  });
}

/**
 * Einen User melden (per handle oder userId)
 * - akzeptiert: formData.handle (mit/ohne @) ODER formData.userId
 */
export async function reportUserAction(formData: FormData) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) throw new Error('Nicht angemeldet');

  const handleRaw = formData.get('handle');
  const userIdRaw = formData.get('userId');

  let targetId: string | null = null;

  if (typeof userIdRaw === 'string' && userIdRaw.trim()) {
    targetId = userIdRaw.trim();
  } else if (typeof handleRaw === 'string' && handleRaw.trim()) {
    const handle = handleRaw.trim().toLowerCase().replace(/^@/, '');
    const user = await prisma.user.findUnique({
      where: { handle },
      select: { id: true },
    });
    targetId = user?.id ?? null;
  }

  if (!targetId) throw new Error('Ziel-User nicht gefunden');

  await prisma.contentReport.create({
    data: {
      id: randomUUID(),
      targetType: ReportTargetType.USER,
      targetId,
      reporterUserId: me.id,
      reason: String(formData.get('reason') ?? 'OTHER'),
    },
  });
}
