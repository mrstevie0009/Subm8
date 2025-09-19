// src/app/actions/autodrain.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';

/**
 * Cancel an active autodrain subscription (only allowed for the sub who enabled it).
 * Expects `id` and `locale` in the posted FormData.
 */
export async function cancelAutodrainAction(formData: FormData) {
  const idRaw = formData.get('id');
  const localeRaw = formData.get('locale');
  const id = typeof idRaw === 'string' ? idRaw : '';
  const locale = typeof localeRaw === 'string' ? localeRaw : 'en';

  if (!id) {
    throw new Error('Missing subscription id');
  }

  const me = await getCurrentUser();
  if (!me) {
    throw new Error('Not authenticated');
  }

  // Only the sub (payer) can cancel their outgoing subscription
  const sub = await prisma.autoDrainSubscription.findUnique({
    where: { id },
    select: { id: true, subId: true, active: true },
  });

  if (!sub) {
    throw new Error('Subscription not found');
  }
  if (sub.subId !== me.id) {
    throw new Error('Not allowed');
  }
  if (!sub.active) {
    // already inactive – just revalidate the page
    revalidatePath(`/${locale}/settings/payments`, 'page');
    return;
  }

  await prisma.autoDrainSubscription.update({
    where: { id },
    data: {
      active: false, // ← WICHTIG: `canceledAt` entfernen, existiert im Schema nicht
    },
  });

  // Refresh the Payments page so the row disappears from "Active Autodrain"
  revalidatePath(`/${locale}/settings/payments`, 'page');
}
