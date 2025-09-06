// src/components/TipRequestAcceptModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';

type Props = {
  open: boolean;
  onClose: () => void;

  amountCents: number;
  currency: string;

  toUserId: string;
  toDisplayName: string;
  toAvatarUrl?: string;
  conversationId: string;

  // ⬇️ paymentId jetzt optional enthalten
  onSuccess: (p: { amountCents: number; currency: string; paymentId?: string }) => void;
};

const CURRENCY = 'EUR';
const EU_VAT_BPS: Record<string, number> = {
  AT: 2000, BE: 2100, BG: 2000, CY: 1900, CZ: 2100, DE: 1900, DK: 2500, EE: 2200,
  ES: 2100, FI: 2400, FR: 2000, GR: 2400, HR: 2500, HU: 2700, IE: 2300, IT: 2200,
  LT: 2100, LU: 1600, LV: 2100, MT: 1800, NL: 2100, PL: 2300, PT: 2300, RO: 1900,
  SE: 2500, SI: 2200, SK: 2000,
};
const EU_COUNTRIES = Object.keys(EU_VAT_BPS);

function fmtCurrency(cents: number, currency = CURRENCY) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

type TaxEstimateRes = { ok: boolean; country?: string | null };

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
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // VAT-Autodetect + optionaler Fallback
  const [autoCountry, setAutoCountry] = React.useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = React.useState<string | null>(null);
  const effectiveCountry = (selectedCountry ?? autoCountry) ?? 'NON-EU';

  const rateBps = EU_VAT_BPS[effectiveCountry] ?? 0;
  const vatCents = Math.round(amountCents * (rateBps / 10_000));
  const totalCents = amountCents + vatCents;

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedCountry(null);
    setAutoCountry(null);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/payments/tax/estimate?amountCents=${amountCents}`, {
          signal: ctrl.signal,
          cache: 'no-store',
        });
        const j = (await res.json().catch(() => null)) as TaxEstimateRes | null;
        if (res.ok && j?.ok) setAutoCountry(j.country ?? null);
        else setAutoCountry(null);
      } catch {
        setAutoCountry(null);
      }
    })();
    return () => ctrl.abort();
  }, [open, amountCents]);

  async function handleAccept() {
    try {
      setSending(true);
      setError(null);

      // 1) Create payment
      const res1 = await fetch('/api/payments/tips/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          amountCents,
          conversationId,
          buyerCountry: effectiveCountry !== 'NON-EU' ? effectiveCountry : undefined,
        }),
      });
      const j1 = await res1.json().catch(() => null) as { ok: boolean; paymentId?: string; currency?: string; error?: string } | null;
      if (!res1.ok || !j1?.ok || !j1.paymentId) {
        throw new Error(j1?.error || 'Could not create payment');
      }
      const paymentId = j1.paymentId;
      const curr = j1.currency || currency || CURRENCY;

      // 2) Confirm
      const res2 = await fetch('/api/payments/tips/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const j2 = await res2.json().catch(() => null) as { ok: boolean } | null;
      if (!res2.ok || !j2?.ok) throw new Error('Confirm failed');

      onSuccess({ amountCents, currency: curr, paymentId });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      return;
    } finally {
      setSending(false);
    }
    onClose();
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
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
                  <svg viewBox="0 0 24 24" width="18" height="18">
                    <circle cx="12" cy="8.5" r="3.5" fill="currentColor" />
                    <path d="M4 19.5a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[16px] leading-tight truncate">Accept tip request</div>
              <div className="text-[12px] text-white/70 truncate">to {toDisplayName}</div>
            </div>
            <button
              onClick={onClose}
              className="ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <label className="block text-[12px] text-white/70 mb-1">Requested amount</label>
            <div className="text-[24px] font-semibold">{fmtCurrency(amountCents, currency)}</div>
          </div>

          {/* Country fallback (falls Auto nicht klappt) */}
          {!autoCountry && (
            <div className="mt-3">
              <label className="block text-[12px] text-white/70 mb-1">
                Your country (for VAT)
              </label>
              <select
                value={selectedCountry ?? ''}
                onChange={(e) => setSelectedCountry(e.target.value || null)}
                className="w-full rounded-xl bg-white/[.03] border border-white/10 px-3 py-2 outline-none text-white"
              >
                <option value="" className="bg-[#0b0b0d] text-white/60">Select…</option>
                {EU_COUNTRIES.map((cc) => (
                  <option key={cc} value={cc} className="bg-[#0b0b0d] text-white">
                    {cc}
                  </option>
                ))}
                <option value="NON-EU" className="bg-[#0b0b0d] text-white">Outside EU (no VAT)</option>
              </select>
            </div>
          )}

          {/* Breakdown */}
          <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-b from-white/[.04] to-transparent p-3">
            <div className="flex items-center justify-between text-[14px] mb-1">
              <span>Amount</span>
              <strong className="text-white">{fmtCurrency(amountCents, currency)}</strong>
            </div>
            <div className="flex items-center justify-between text-[13px] text-white/70">
              <span>VAT ({effectiveCountry}{rateBps ? ` ${rateBps / 100}%` : ''})</span>
              <span>{fmtCurrency(vatCents, currency)}</span>
            </div>
            <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between">
              <span className="text-[14px]">You pay</span>
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
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={sending}
              className={`relative px-4 py-2 rounded-lg text-white transition
                ${!sending ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'}`}
            >
              Pay & accept
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
