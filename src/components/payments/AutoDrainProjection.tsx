'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';

type Cadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

function fmt(cents: number, currency: string, locale?: string) {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

export default function AutoDrainProjection({
  totalCents,      // was der Sub PRO Abbuchung zahlt (inkl. Gebühr)
  cadence,
  currency = 'EUR',
  locale,
}: {
  totalCents: number;
  cadence: Cadence;
  currency?: string;
  locale?: string;
}) {
  const t = useTranslations('payment.autodrainProjection');

  if (!totalCents || totalCents <= 0) return null;

  // Hochrechnung auf den TATSÄCHLICH gezahlten Betrag (inkl. Gebühr)
  const perMonth =
    cadence === 'DAILY'  ? totalCents * 30 :
    cadence === 'WEEKLY' ? Math.round((totalCents * 52) / 12) :
                           totalCents;
  const perYear =
    cadence === 'DAILY'  ? totalCents * 365 :
    cadence === 'WEEKLY' ? totalCents * 52 :
                           totalCents * 12;

  // Bei MONTHLY ist "pro Monat" == "pro Abbuchung" → Monatszeile weglassen (redundant)
  const showMonthly = cadence !== 'MONTHLY';

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-4 space-y-2">
      <div className="text-[13px] font-semibold text-amber-200">{t('title')}</div>

      {showMonthly && (
        <div className="flex items-center justify-between text-[14px]">
          <span className="text-white/85">{t('perMonth')}</span>
          <span className="font-semibold tabular-nums">≈ {fmt(perMonth, currency, locale)}</span>
        </div>
      )}

      <div className="flex items-center justify-between text-[14px]">
        <span className="text-white/85">{t('perYear')}</span>
        <span className="font-semibold tabular-nums">≈ {fmt(perYear, currency, locale)}</span>
      </div>

      <div className="pt-1 text-[12px] text-amber-100/70">{t('estimateNote')}</div>
    </div>
  );
}