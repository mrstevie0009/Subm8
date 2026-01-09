// src/app/actions/autodrain.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { revalidatePath } from 'next/cache';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {});

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
    select: {
      id: true,
      subId: true,
      active: true,
      stripeSubscriptionId: true,
      stripeStatus: true,
    },
  });

  if (!sub) {
    throw new Error('Subscription not found');
  }
  if (sub.subId !== me.id) {
    throw new Error('Not allowed');
  }

  // already inactive – just revalidate the page
  if (!sub.active) {
    revalidatePath(`/${locale}/settings/payments`, 'page');
    return;
  }

  // 1) Try cancel in Stripe (if we have a Stripe subscription id)
  if (sub.stripeSubscriptionId) {
    try {
      const canceled = await stripe.subscriptions.cancel(sub.stripeSubscriptionId);

      // 2) Update DB: mark inactive + persist Stripe status
      await prisma.autoDrainSubscription.update({
        where: { id: sub.id },
        data: {
          active: false,
          stripeStatus: canceled.status, // typically "canceled"
        },
      });
    } catch {
      // If Stripe cancel fails (already canceled / not found / etc.), still mark it inactive locally
      await prisma.autoDrainSubscription.update({
        where: { id: sub.id },
        data: {
          active: false,
          stripeStatus: 'canceled',
        },
      });
    }
  } else {
    // No Stripe ref -> just deactivate locally
    await prisma.autoDrainSubscription.update({
      where: { id: sub.id },
      data: {
        active: false,
        stripeStatus: 'canceled',
      },
    });
  }

  // Refresh the Payments page so the row disappears from "Active Autodrain"
  revalidatePath(`/${locale}/settings/payments`, 'page');
}
