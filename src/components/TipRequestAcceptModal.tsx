// src/components/TipRequestAcceptModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

type Props = {
  open: boolean;
  onClose: () => void;

  amountCents: number;      // Basisbetrag (Domme)
  currency: string;

  toUserId: string;
  toDisplayName: string;
  toAvatarUrl?: string;
  conversationId: string;

  onSuccess: (p: { amountCents: number; currency: string; paymentId?: string }) => void;
};

const CURRENCY = 'EUR';
const TOPUP_PCT = 0.10; // 10% on top

function fmtCurrency(cents: number, currency = CURRENCY) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

type CreateRes = { ok: boolean; paymentId?: string; currency?: string; error?: string } | null;
type ConfirmRes = { ok: boolean; baseAmountCents?: number; totalCents?: number; currency?: string } | null;

export default function TipRequestAcceptModal({
  open,
  onClose,
  amountCents,
  currency,
  toUserId,
  toDisplayName,
  toAvatarUrl,
  conversationId,
  onSuccess,
}: Props) {
  const t = useTranslations('payment.tipRequestAcceptModal');

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const platformFeeCents = Math.round(amountCents * TOPUP_PCT); // zahlt der Sub zusätzlich
  const totalCents = amountCents + platformFeeCents;
  const pctLabel = Math.round(TOPUP_PCT * 100);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
  }, [open]);

  async function handleAccept() {
    try {
      setSending(true);
      setError(null);

      const res1 = await fetch('/api/payments/tips/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toUserId, amountCents, conversationId }),
      });
      const j1 = (await res1.json().catch(() => null)) as CreateRes;
      if (!res1.ok || !j1?.ok || !j1.paymentId) throw new Error(j1?.error || t('errors.create'));

      const paymentId = j1.paymentId;
      const curr = j1.currency || currency || CURRENCY;

      const res2 = await fetch('/api/payments/tips/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const j2 = (await res2.json().catch(() => null)) as ConfirmRes;
      if (!res2.ok || !j2?.ok) throw new Error(t('errors.confirm'));

      const base = typeof j2.baseAmountCents === 'number' ? j2.baseAmountCents : amountCents;
      const curr2 = j2.currency || curr;

      onSuccess({ amountCents: base, currency: curr2, paymentId });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[min(640px,94vw)] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-5 py-4">
          <div
            className="absolute inset-0 -z-10"
            style={{ background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.35), rgba(139,92,246,0))' }}
          />
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/15 bg-white/10">
              {toAvatarUrl ? (
                <Image src={toAvatarUrl} alt="" fill className="object-cover" sizes="40px" />
              ) : (
                <div className="grid place-items-center w-full h-full text-white/70">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <circle cx="12" cy="8.5" r="3.5" fill="currentColor" />
                    <path d="M4 19.5a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[16px] leading-tight truncate">{t('header.title')}</div>
              <div className="text-[12px] text-white/70 truncate">{t('header.to', { name: toDisplayName })}</div>
            </div>
            <button
              onClick={onClose}
              className="ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10"
              aria-label={t('actions.closeAria')}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          <div className="text-[12px] text-white/75 mb-3">
            {t('disclaimer')}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <label className="block text-[12px] text-white/70 mb-1">{t('requested.label')}</label>
            <div className="text-[24px] font-semibold">{fmtCurrency(amountCents, currency)}</div>
            <p className="mt-1 text-[12px] text-white/60">
              {t('requested.note', { pct: pctLabel })}
            </p>
          </div>

          {/* Breakdown */}
          <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-b from-white/[.04] to-transparent p-3">
            <div className="flex items-center justify-between text-[14px] mb-1">
              <span>{t('breakdown.amount')}</span>
              <strong className="text-white">{fmtCurrency(amountCents, currency)}</strong>
            </div>
            <div className="flex items-center justify-between text-[13px] text-white/70">
              <span>{t('breakdown.fee', { pct: pctLabel })}</span>
              <span>{fmtCurrency(platformFeeCents, currency)}</span>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between">
              <span className="text-[14px]">{t('breakdown.youPay')}</span>
              <span className="text-[16px] font-semibold">{fmtCurrency(totalCents, currency)}</span>
            </div>
          </div>

          {error && (
            <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
              disabled={sending}
            >
              {t('actions.cancel')}
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={sending}
              className={`relative px-4 py-2 rounded-lg text-white transition ${
                !sending ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
              }`}
            >
              {sending ? t('actions.processing') : t('actions.sendGiftAccept', { total: fmtCurrency(totalCents, currency) })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
