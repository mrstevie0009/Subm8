//src/components/AutoDrainRequestAcceptModal
'use client';

import * as React from 'react';
import Image from 'next/image';

export type AutoDrainCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

type Props = {
  open: boolean;
  onClose: () => void;

  amountCents: number;
  currency: string;
  cadence: AutoDrainCadence;

  toUserId: string;           // Domme
  toDisplayName: string;
  toAvatarUrl?: string;
  conversationId: string;

  onSuccess: (p: { autoDrainId: string; amountCents: number; currency: string; cadence: AutoDrainCadence }) => void;
  onDeclined?: () => void;
};

const CURRENCY = 'EUR';
const GIFT_ACK_KEY = 'subm8_gift_ack_v1';

function fmtCurrency(cents: number, currency = CURRENCY) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

export default function AutoDrainRequestAcceptModal({
  open,
  onClose,
  amountCents,
  currency,
  cadence,
  toUserId,
  toDisplayName,
  toAvatarUrl,
  conversationId,
  onSuccess,
}: Props) {
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [giftAck, setGiftAck] = React.useState<boolean>(true);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(GIFT_ACK_KEY) : '1';
      setGiftAck(v === '1');
    } catch {
      setGiftAck(true);
    }
  }, [open]);

  async function handleAccept() {
    try {
      setSending(true);
      setError(null);

      const res = await fetch('/api/autodrain/accept', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          amountCents,
          currency,
          cadence,
          conversationId,
        }),
      });
      const j = (await res.json().catch(() => null)) as { ok: boolean; id?: string; error?: string } | null;
      if (!res.ok || !j?.ok || !j.id) throw new Error(j?.error || 'Could not enable autodrain');

      try {
        localStorage.setItem(GIFT_ACK_KEY, '1');
        fetch('/api/me/disclaimers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ giftAccepted: true }),
        }).catch(() => {});
      } catch {}

      onSuccess({ autoDrainId: j.id, amountCents, currency, cadence });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const cadenceLabel = cadence === 'DAILY' ? 'daily' : cadence === 'WEEKLY' ? 'weekly' : 'monthly';

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-[min(640px,94vw)] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="relative px-5 py-4">
          <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.35), rgba(139,92,246,0))' }} />
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
              <div className="font-semibold text-[16px] leading-tight truncate">Enable autodrain</div>
              <div className="text-[12px] text-white/70 truncate">to {toDisplayName}</div>
            </div>
            <button onClick={onClose} className="ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10" aria-label="Close">
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5">
          <div className="text-[12px] text-white/75 mb-3">
            Gifts are voluntary, not payments for services. Gifts are final (no refunds unless required by law).
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <div className="text-[13px] text-white/70 mb-1">Charge amount</div>
            <div className="text-[24px] font-semibold">{fmtCurrency(amountCents, currency)} <span className="text-[13px] font-normal text-white/70">({cadenceLabel})</span></div>
            <div className="mt-1 text-[12px] text-white/60">Recurring charge until you cancel.</div>
          </div>

          {!giftAck && (
            <label className="mt-3 flex items-start gap-2 text-[13px]">
              <input
                type="checkbox"
                className="accent-[var(--purple)] mt-[2px]"
                checked={giftAck}
                onChange={(e) => setGiftAck(e.target.checked)}
              />
              <span>I understand that gifts are voluntary and final. No services are promised.</span>
            </label>
          )}

          {error && (
            <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="mt-4 flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10" disabled={sending}>
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={sending || !giftAck}
              className={`px-4 py-2 rounded-lg text-white transition ${giftAck && !sending ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'}`}
            >
              {sending ? 'Enabling…' : 'Enable Autodrain'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
