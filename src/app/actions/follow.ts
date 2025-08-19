'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function followAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id as string | undefined;
  const target = String(formData.get('userId') || '');

  if (!me) throw new Error('Not authenticated');
  if (!target || target === me) return;

  await prisma.follow.upsert({
    where: { followerId_followeeId: { followerId: me, followeeId: target } },
    update: {},
    create: { followerId: me, followeeId: target },
  });
}

export async function unfollowAction(formData: FormData) {
  const session = await getServerSession(authOptions);
  const me = session?.user?.id as string | undefined;
  const target = String(formData.get('userId') || '');

  if (!me) throw new Error('Not authenticated');
  if (!target || target === me) return;

  await prisma.follow.deleteMany({
    where: { followerId: me, followeeId: target },
  });
}
