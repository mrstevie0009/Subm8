// src/components/AutoDrainRequestCreateModal.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

export type AutoDrainCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

/** Named Export, damit ChatComposer { AutoDrainReqPayload } importieren kann */
export type AutoDrainReqPayload = {
  amountCents: number;
  currency?: string;
  cadence: AutoDrainCadence;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (p: AutoDrainReqPayload) => void;
  defaultCurrency?: string;
};

function parseCents(input: string): number | null {
  const norm = input.replace(',', '.').replace(/[^\d.]/g, '');
  if (!norm) return null;
  const val = Number(norm);
  if (Number.isNaN(val)) return null;
  return Math.round(val * 100);
}
function fmtCurrency(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

export default function AutoDrainRequestCreateModal({
  open,
  onClose,
  onCreate,
  defaultCurrency = 'EUR',
}: Props) {
  const t = useTranslations('payment.autoDrain');

  const [amount, setAmount] = React.useState('50');
  const [cadence, setCadence] = React.useState<AutoDrainCadence>('MONTHLY');

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    setAmount('50');
    setCadence('MONTHLY');
  }, [open]);

  if (!open) return null;

  const amountCents = parseCents(amount) ?? 0;
  const amountValid = amountCents >= 100 && amountCents <= 1_000_000;

  const overlay = (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[min(680px,94vw)] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="adreq-title"
      >
        <div className="px-5 py-4 border-b border-white/10">
          <h3 id="adreq-title" className="text-[18px] font-semibold">
            {t('title')}
          </h3>
          <p className="text-[13px] text-white/70">{t('subtitle')}</p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Amount */}
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <label className="block text-[12px] text-white/70 mb-1">{t('amount.label')}</label>
            <div className="flex items-center gap-2">
              <div className="shrink-0 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80">€</div>
              <input
                inputMode="decimal"
                placeholder={t('amount.placeholder')}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="flex-1 bg-transparent outline-none text-[28px] leading-none font-semibold tracking-wide placeholder:text-white/30"
                aria-describedby="adreq-amount-help"
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[5, 10, 25, 50, 100].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className="px-3 py-1.5 rounded-full text-[13px] border border-white/15 hover:bg-white/10"
                  aria-label={fmtCurrency(p * 100, defaultCurrency)}
                >
                  {fmtCurrency(p * 100, defaultCurrency)}
                </button>
              ))}
            </div>
          </div>

          {/* Recurrence */}
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <label className="block text-[12px] text-white/70 mb-2">{t('recurrence.label')}</label>
            <div className="grid grid-cols-3 gap-2">
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as AutoDrainCadence[]).map((c) => {
                const on = cadence === c;
                const label =
                  c === 'DAILY' ? t('recurrence.options.daily') :
                  c === 'WEEKLY' ? t('recurrence.options.weekly') :
                  t('recurrence.options.monthly');
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCadence(c)}
                    className={`px-3 py-2 rounded-lg border text-[13px] ${
                      on ? 'border-[var(--purple)] bg-[var(--purple)]/25' : 'border-white/15 hover:bg-white/10'
                    }`}
                    aria-pressed={on}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
              aria-label={t('actions.cancel')}
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              disabled={!amountValid}
              onClick={() => onCreate({ amountCents, cadence, currency: defaultCurrency })}
              className={`px-4 py-2 rounded-lg text-white transition ${
                amountValid ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
              }`}
              aria-label={t('actions.create')}
            >
              {t('actions.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
