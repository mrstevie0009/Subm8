'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

export type PaymentStatus = 'CREATED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

const STYLES: Record<PaymentStatus, string> = {
  SUCCEEDED:  'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  PROCESSING: 'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  CREATED:    'border-yellow-500/30 bg-yellow-500/10 text-yellow-200',
  FAILED:     'border-red-500/30 bg-red-500/10 text-red-300',
  CANCELED:   'border-white/15 bg-white/[.04] text-white/60',
};

const DOT: Record<PaymentStatus, string> = {
  SUCCEEDED:  'bg-emerald-400',
  PROCESSING: 'bg-yellow-400 animate-pulse',
  CREATED:    'bg-yellow-400 animate-pulse',
  FAILED:     'bg-red-400',
  CANCELED:   'bg-white/40',
};

export default function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('payment.paymentsPage.payments.status');
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium ${STYLES[status]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${DOT[status]}`} />
      {t(status.toLowerCase() as 'created' | 'processing' | 'succeeded' | 'failed' | 'canceled')}
    </span>
  );
}