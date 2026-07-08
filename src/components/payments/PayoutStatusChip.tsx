'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

// Dein DB-Enum: REQUESTED | PROCESSING | PAID | FAILED
// (der rohe Stripe-Status "in_transit" wird auf PROCESSING abgebildet)
export type PayoutStatus = 'REQUESTED' | 'PROCESSING' | 'PAID' | 'FAILED';

const ORDER: PayoutStatus[] = ['REQUESTED', 'PROCESSING', 'PAID'];

export default function PayoutStatusChip({
  status,
  stripeStatus,
}: {
  status: PayoutStatus;
  stripeStatus?: string | null;
}) {
  const t = useTranslations('payment.payoutStatus');

  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[12px] text-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
        {t('failed')}
      </span>
    );
  }

  // Feinere Zwischenstufe aus dem rohen Stripe-Status (optional)
  const inTransit = stripeStatus === 'in_transit';
  const idx = ORDER.indexOf(status);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ORDER.map((s, i) => {
        const reached = i <= idx;
        // "PROCESSING" als "unterwegs" labeln, wenn Stripe in_transit meldet
        const label = s === 'PROCESSING' && inTransit ? t('in_transit') : t(s.toLowerCase());
        return (
          <React.Fragment key={s}>
            <span
              className={[
                'text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap',
                reached
                  ? 'border-[var(--purple)]/40 bg-[var(--purple)]/15 text-white'
                  : 'border-white/10 bg-white/[.03] text-white/40',
              ].join(' ')}
            >
              {label}
            </span>
            {i < ORDER.length - 1 && (
              <span className={i < idx ? 'text-white/60' : 'text-white/20'}>→</span>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}