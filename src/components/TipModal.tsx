// src/components/TipModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';

type Props = {
  open: boolean;
  onClose: () => void;

  toUserId: string;
  toDisplayName: string;
  toRole: 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE';
  toAvatarUrl?: string;
  conversationId?: string;

  onSuccess?: (a: {
    paymentId: string;
    amountCents: number;  // Basisbetrag (Domme)
    totalCents: number;   // You pay (inkl. Platform fee on top)
    currency: string;
    note?: string;
  }) => void;
};

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;
const CURRENCY = 'EUR';
const PLATFORM_FEE_BPS_TOPUP = 1000; // 10% on top
const GIFT_ACK_KEY = 'subm8_gift_ack_v1';

function parseCents(input: string): number | null {
  const norm = input.replace(',', '.').replace(/[^\d.]/g, '');
  if (!norm) return null;
  const val = Number(norm);
  if (Number.isNaN(val)) return null;
  return Math.round(val * 100);
}

function fmtCurrency(cents: number, currency = CURRENCY) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

function RolePill({ role }: { role: Props['toRole'] }) {
  const isDomme = String(role).toUpperCase() === 'DOMME';
  return (
    <span
      className="px-2 py-[2px] rounded-full text-[11px] leading-none"
      style={{
        color: 'var(--purple)',
        background: 'rgba(139,92,246,.18)',
        border: '1px solid rgba(139,92,246,.28)',
      }}
    >
      {isDomme ? 'Domme' : 'Sub'}
    </span>
  );
}

export default function TipModal({
  open,
  onClose,
  toUserId,
  toDisplayName,
  toRole,
  toAvatarUrl,
  conversationId,
  onSuccess,
}: Props) {
  const [amount, setAmount] = React.useState('50');
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<null | {
    paymentId: string;
    totalCents: number;
    currency: string;
  }>(null);

  // Einmal-Disclaimer: lokal merken (optional später via API persistieren)
  const [giftAck, setGiftAck] = React.useState<boolean>(true);
  React.useEffect(() => {
    if (!open) return;
    setSuccess(null);
    setError(null);
    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(GIFT_ACK_KEY) : '1';
      setGiftAck(v === '1'); // true = bereits bestätigt
    } catch {
      setGiftAck(true);
    }
  }, [open]);

  const amountCents = parseCents(amount) ?? 0;

  // 10% on top, paid by sub
  const topupFeeCents = Math.round(amountCents * (PLATFORM_FEE_BPS_TOPUP / 10_000));
  const totalCents = amountCents + topupFeeCents;

  const amountValid = amountCents >= MIN_CENTS && amountCents <= MAX_CENTS;
  const canSend = amountValid && !sending && giftAck;

  async function handleSend() {
    try {
      setSending(true);
      setError(null);

      const body = {
        toUserId,
        amountCents,
        note: note.trim() || undefined,
        conversationId,
      };

      const res1 = await fetch('/api/payments/tips/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j1 = await res1.json().catch(() => null);
      if (!res1.ok || !j1?.ok) throw new Error(j1?.error || 'Could not create payment');

      const paymentId: string = j1.paymentId;
      const currency: string = j1.currency || CURRENCY;

      const res2 = await fetch('/api/payments/tips/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });
      const j2 = await res2.json().catch(() => null);
      if (!res2.ok || !j2?.ok) throw new Error(j2?.error || 'Confirm failed');

      const totalFromServer: number = Number(j2.totalCents ?? totalCents);
      const baseFromServer: number = Number(j2.baseAmountCents ?? amountCents);

      setSuccess({ paymentId, totalCents: totalFromServer, currency });

      // Einmalig merken
      try {
        localStorage.setItem(GIFT_ACK_KEY, '1');
        // Optional: in DB persistieren, falls Route vorhanden
        fetch('/api/me/disclaimers', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ giftAccepted: true }),
        }).catch(() => {});
      } catch {}

      onSuccess?.({
        paymentId,
        amountCents: baseFromServer, // Chat zeigt Basisbetrag
        totalCents: totalFromServer, // „You pay“
        currency,
        note: note.trim() || undefined,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm"
      onClick={() => { setSuccess(null); onClose(); }}
    >
      <div
        className="relative w-[min(680px,94vw)] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d]"
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
              <div className="font-semibold text-[16px] leading-tight truncate">Send a gift to {toDisplayName}</div>
              <div className="flex items-center gap-2 text-[12px] text-white/70">
                <RolePill role={toRole} />
                <span>Gifts are voluntary &amp; final.</span>
              </div>
            </div>

            <button
              onClick={() => { setSuccess(null); onClose(); }}
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
        {!success ? (
          <div className="px-5 pb-5">
            {/* Hinweis oben */}
            <div className="mb-3 text-[12px] text-white/75">
              Gifts are voluntary, not payments for services. Subm8 only facilitates the transfer.
            </div>

            {/* Betrag */}
            <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
              <label className="block text-[12px] text-white/70 mb-1">Amount for the creator</label>
              <div className="flex items-center gap-2">
                <div className="shrink-0 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80">€</div>
                <input
                  inputMode="decimal"
                  placeholder="50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-transparent outline-none text-[28px] leading-none font-semibold tracking-wide placeholder:text-white/30"
                />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {[5, 10, 25, 50].map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setAmount(String(p))}
                    className="px-3 py-1.5 rounded-full text-[13px] border border-white/15 hover:bg-white/10"
                  >
                    {fmtCurrency(p * 100)}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="mt-3">
              <label className="block text-[12px] text-white/70 mb-1">Note (optional)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                rows={2}
                placeholder="Say something sweet…"
                className="w-full rounded-xl bg-white/[.03] border border-white/10 px-3 py-2 outline-none text-white"
              />
              <div className="mt-1 text-[12px] text-white/50">{note.length}/200</div>
            </div>

            {/* Breakdown */}
            <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-b from-white/[.04] to-transparent p-3">
              <div className="flex items-center justify-between text-[14px] mb-1">
                <span>Amount (goes to creator)</span>
                <strong className="text-white">{fmtCurrency(amountCents)}</strong>
              </div>
              <div className="flex items-center justify-between text-[13px] text-white/70">
                <span>Platform fee (10% on top)</span>
                <span>{fmtCurrency(topupFeeCents)}</span>
              </div>
              <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between">
                <span className="text-[14px]">You pay</span>
                <span className="text-[16px] font-semibold">{fmtCurrency(totalCents)}</span>
              </div>
              <div className="mt-2 text-[12px] text-white/70">
                By confirming, you are sending a voluntary gift. This is not a payment for services. Gifts are final (no refunds unless required by law).
              </div>
            </div>

            {/* Einmal-Bestätigung (nur wenn noch nicht bestätigt) */}
            {(!giftAck) && (
              <label className="mt-3 flex items-start gap-2 text-[13px]">
                <input
                  type="checkbox"
                  className="accent-[var(--purple)] mt-[2px]"
                  checked={giftAck}
                  onChange={(e) => setGiftAck(e.target.checked)}
                />
                <span>I understand that gifts are voluntary and final.</span>
              </label>
            )}

            {error && (
              <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setSuccess(null); onClose(); }}
                className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!canSend}
                className={`relative px-4 py-2 rounded-lg text-white transition
                  ${canSend ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'}`}
              >
                <span className="inline-flex items-center gap-2">
                  <SparkleIcon />
                  {sending ? 'Sending…' : 'Send Gift'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-6 pt-2 relative">
            <ConfettiHearts />
            <div className="text-center mt-4">
              <div className="inline-grid place-items-center w-16 h-16 rounded-full bg-[var(--purple)]/20 border border-[var(--purple)]/30">
                <HeartIcon big />
              </div>
              <h3 className="mt-3 text-[18px] font-semibold">Gift sent!</h3>
              <p className="mt-1 text-white/80">You paid <strong>{fmtCurrency(success.totalCents)}</strong></p>
              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => { setSuccess(null); onClose(); }}
                  className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes floatUp {
            0%   { transform: translateY(10px) scale(0.9); opacity: 0; }
            20%  { opacity: 1; }
            100% { transform: translateY(-120px) scale(1.1); opacity: 0; }
          }
        `}</style>
      </div>
    </div>
  );
}

/* Icons wie gehabt … */
function SparkleIcon(){return(<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2Zm6 8 1.2 2.8L22 14l-2.8 1.2L18 18l-1.2-2.8L14 14l2.8-1.2L18 10Z" fill="currentColor" opacity=".9"/></svg>)}
function HeartIcon({big=false}:{big?:boolean}){return(<svg viewBox="0 0 24 24" width={big?22:14} height={big?22:14} aria-hidden><path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9Z" fill="currentColor"/></svg>)}
function ConfettiHearts(){return null;}
