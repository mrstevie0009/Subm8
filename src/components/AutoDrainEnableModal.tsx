// src/components/AutoDrainEnableModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

export type AutoDrainCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

type Props = {
  open: boolean;
  onClose: () => void;

  // Empfänger (Domme)
  toUserId: string;
  toDisplayName: string;
  toAvatarUrl?: string | null;

  defaultCurrency?: string; // default: 'EUR'
  conversationId?: string;  // optional, wenn du es aus Chat-Kontext mitgeben willst

  // Wird nach erfolgreichem Enable aufgerufen (liefert die Daten fürs ADACC-Envelope)
  onSuccess: (p: { autoDrainId: string; amountCents: number; currency: string; cadence: AutoDrainCadence }) => void;
};

const GIFT_ACK_KEY = 'subm8_gift_ack_v1';

// Stripe
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise: Promise<Stripe | null> = STRIPE_PK ? loadStripe(STRIPE_PK) : Promise.resolve(null);

function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type CreateOk = {
  ok: true;
  autoDrainId: string;
  stripeSubscriptionId: string;
  clientSecret: string;
  currency: string;
  amountCents: number;
  cadence: AutoDrainCadence;
};

function isCreateOk(x: unknown): x is CreateOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.ok === true &&
    typeof o.autoDrainId === 'string' &&
    typeof o.stripeSubscriptionId === 'string' &&
    typeof o.clientSecret === 'string'
  );
}

function getErr(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  return o.ok === false && typeof o.error === 'string' ? o.error : null;
}

type ConfirmOk = { ok: true; autoDrainId: string; status?: string };

function isConfirmOk(x: unknown): x is ConfirmOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.ok === true && typeof o.autoDrainId === 'string';
}

function getStatusString(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  return typeof o.status === 'string' ? o.status : null;
}

function StripeSubscribeStep({
  t,
  autoDrainId,
  sending,
  setSending,
  setError,
  onBack,
  onActivated,
}: {
  t: ReturnType<typeof useTranslations>;
  autoDrainId: string;
  sending: boolean;
  setSending: (v: boolean) => void;
  setError: (s: string | null) => void;
  onBack: () => void;
  onActivated: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function confirmAndFinalize() {
    if (!stripe || !elements) throw new Error('Stripe not ready');

    // 1) PaymentIntent bestätigen (PaymentElement zeigt gespeicherte Methoden oder neue Karte)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
      redirect: 'if_required',
    });

    if (error) throw new Error(error.message || t('errors.generic'));
    if (paymentIntent?.status === 'canceled') throw new Error('Payment canceled');
    if (paymentIntent?.status === 'requires_payment_method') throw new Error('Payment failed');

    // 2) Backend bestätigt, dass Subscription jetzt active ist
    const delays = [0, 400, 800, 1200];
    let last: string | null = null;

    for (const d of delays) {
      if (d) await sleep(d);

      const res = await fetch('/api/payments/autodrain/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ autoDrainId }),
      });
      const j: unknown = await res.json().catch(() => null);

      if (res.ok && isConfirmOk(j)) return;

      last = getErr(j) || getStatusString(j);

      if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
        throw new Error(getErr(j) || t('errors.generic'));
      }
    }

    throw new Error(last || t('errors.generic'));
  }

  async function handleEnable() {
    try {
      setSending(true);
      setError(null);
      await confirmAndFinalize();
      onActivated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] text-white/80">{t('stripe.enterCard') ?? 'Zahlungsmethode wählen'}</div>
        <button
          type="button"
          onClick={onBack}
          disabled={sending}
          className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60 w-full sm:w-auto"
        >
          {t('actions.back') ?? 'Zurück'}
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <PaymentElement />
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleEnable}
          disabled={sending || !stripe || !elements}
          className={`px-4 py-2 rounded-lg text-white transition w-full sm:w-auto ${
            !sending && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          {sending ? (t('actions.enabling') ?? 'Aktiviere…') : (t('actions.enable') ?? 'AutoDrain aktivieren')}
        </button>
      </div>

      <div className="mt-2 text-[12px] text-white/55">
        {t('stripe.secureHint') ?? 'Deine Zahlungsdaten werden sicher von Stripe verarbeitet.'}
      </div>
    </div>
  );
}

export default function AutoDrainEnableModal({
  open,
  onClose,
  toUserId,
  toDisplayName,
  toAvatarUrl,
  defaultCurrency = 'EUR',
  conversationId,
  onSuccess,
}: Props) {
  // Nutze die gleichen Strings wie dein Accept-Modal (damit du nicht doppelt pflegen musst)
  const t = useTranslations('payment.autoDrainAcceptModal');

  const mounted = useMounted();

  const [amount, setAmount] = React.useState('50');
  const [cadence, setCadence] = React.useState<AutoDrainCadence>('MONTHLY');

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [giftAck, setGiftAck] = React.useState<boolean>(true);

  const [step, setStep] = React.useState<'form' | 'pay'>('form');
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [autoDrainId, setAutoDrainId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;

    // Reset on open
    setAmount('50');
    setCadence('MONTHLY');
    setSending(false);
    setError(null);

    setStep('form');
    setClientSecret(null);
    setAutoDrainId(null);

    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(GIFT_ACK_KEY) : '1';
      setGiftAck(v === '1');
    } catch {
      setGiftAck(true);
    }
  }, [open]);

  const amountCents = parseCents(amount) ?? 0;
  const amountValid = amountCents >= 100 && amountCents <= 1_000_000; // 1 € – 10.000 €
  const currency = defaultCurrency;

  const cadenceLabel =
    cadence === 'DAILY' ? (t('cadence.daily') ?? 'Daily') : cadence === 'WEEKLY' ? (t('cadence.weekly') ?? 'Weekly') : (t('cadence.monthly') ?? 'Monthly');

  function markAck() {
    try {
      localStorage.setItem(GIFT_ACK_KEY, '1');
      fetch('/api/me/disclaimers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ giftAccepted: true }),
      }).catch(() => {});
    } catch {}
  }

  async function handleStartStripe() {
    if (!amountValid) return;

    try {
      setSending(true);
      setError(null);

      if (!STRIPE_PK) throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');

      // Create (wie im Accept-Modal, nur dass amount/cadence hier aus dem Picker kommen)
      const res = await fetch('/api/payments/autodrain/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          amountCents,
          currency,
          cadence,
          ...(conversationId ? { conversationId } : {}),
        }),
      });

      const j: unknown = await res.json().catch(() => null);

      if (!res.ok || !isCreateOk(j)) {
        throw new Error(getErr(j) || t('errors.generic'));
      }

      setAutoDrainId(j.autoDrainId);
      setClientSecret(j.clientSecret);
      setStep('pay');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  if (!open || !mounted) return null;

  const elementsOptions =
    clientSecret && step === 'pay'
      ? {
          clientSecret,
          appearance: {
            theme: 'night' as const,
            variables: {
              colorPrimary: '#8b5cf6',
              borderRadius: '12px',
              fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
            },
          },
        }
      : undefined;

  const ui = (
    <div
      className="fixed inset-0 z-[2147483600] grid place-items-center bg-black/60 backdrop-blur-sm overscroll-contain p-3 sm:p-0"
      onClick={() => {
        // close only on backdrop click
        onClose();
      }}
    >
      <div
        className="relative w-full sm:w-[min(680px,94vw)] max-w-[680px]
                   max-h-[calc(100dvh-24px)] sm:max-h-[85vh]
                   rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d] flex flex-col"
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
              <div className="font-semibold text-[16px] leading-tight truncate">
                {t('header.title') ?? 'AutoDrain aktivieren'}
              </div>
              <div className="text-[12px] text-white/70 truncate">
                {t('header.to', { name: toDisplayName }) ?? `to ${toDisplayName}`}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10"
              aria-label={t('actions.closeAria') ?? 'Close'}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 pb-5 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {step === 'form' ? (
            <>
              <div className="text-[12px] text-white/75 mb-3">{t('disclaimer') ?? 'Gifts are voluntary and final.'}</div>

              {/* Amount */}
              <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                <label className="block text-[12px] text-white/70 mb-1">
                  {t('charge.label') ?? 'Amount per charge'}
                </label>

                <div className="flex items-center gap-2">
                  <div className="shrink-0 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80">
                    {currency === 'EUR' ? '€' : currency}
                  </div>
                  <input
                    inputMode="decimal"
                    placeholder="50"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={sending}
                    className="flex-1 bg-transparent outline-none text-[28px] leading-none font-semibold tracking-wide placeholder:text-white/30 disabled:opacity-60"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[5, 10, 25, 50, 100].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(String(p))}
                      disabled={sending}
                      className="px-3 py-1.5 rounded-full text-[13px] border border-white/15 hover:bg-white/10 disabled:opacity-60"
                    >
                      {fmtCurrency(p * 100, currency)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cadence */}
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                <label className="block text-[12px] text-white/70 mb-2">
                  {t('charge.recurringNote') ?? 'Recurrence'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['DAILY', 'WEEKLY', 'MONTHLY'] as AutoDrainCadence[]).map((c) => {
                    const on = cadence === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setCadence(c)}
                        disabled={sending}
                        className={`px-3 py-2 rounded-lg border text-[13px] disabled:opacity-60 ${
                          on ? 'border-[var(--purple)] bg-[var(--purple)]/25' : 'border-white/15 hover:bg-white/10'
                        }`}
                      >
                        {c === 'DAILY' ? (t('cadence.daily') ?? 'Daily') : c === 'WEEKLY' ? (t('cadence.weekly') ?? 'Weekly') : (t('cadence.monthly') ?? 'Monthly')}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Preview */}
              <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                <div className="text-[13px] text-white/70 mb-1">Preview</div>
                <div className="text-[24px] font-semibold">
                  {fmtCurrency(amountCents, currency)}{' '}
                  <span className="text-[13px] font-normal text-white/70">({cadenceLabel})</span>
                </div>
                <div className="mt-1 text-[12px] text-white/60">
                  {t('charge.recurringNote') ?? 'Recurring charge until you cancel.'}
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/70">
                  Du kannst AutoDrain jederzeit in deinen <span className="text-white/85">Zahlungen</span> wieder beenden.
                </div>
              </div>

              {!giftAck && (
                <label className="mt-3 flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    className="accent-[var(--purple)] mt-[2px]"
                    checked={giftAck}
                    onChange={(e) => setGiftAck(e.target.checked)}
                    disabled={sending}
                  />
                  <span>{t('acknowledge') ?? 'I understand this is voluntary and final.'}</span>
                </label>
              )}

              {error && (
                <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 w-full sm:w-auto"
                  disabled={sending}
                >
                  {t('actions.cancel') ?? 'Cancel'}
                </button>

                <button
                  type="button"
                  onClick={handleStartStripe}
                  disabled={sending || !giftAck || !amountValid || !STRIPE_PK}
                  className={`px-4 py-2 rounded-lg text-white transition w-full sm:w-auto ${
                    giftAck && amountValid && !sending && STRIPE_PK ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
                  }`}
                  title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
                >
                  {sending ? (t('actions.enabling') ?? 'Weiter…') : (t('actions.enable') ?? 'Weiter zur Zahlung')}
                </button>
              </div>
            </>
          ) : (
            <>
              {error && (
                <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              {step === 'pay' && clientSecret && elementsOptions && autoDrainId ? (
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <StripeSubscribeStep
                    t={t}
                    autoDrainId={autoDrainId}
                    sending={sending}
                    setSending={setSending}
                    setError={setError}
                    onBack={() => {
                      setStep('form');
                      setError(null);
                      setClientSecret(null);
                      setAutoDrainId(null);
                    }}
                    onActivated={() => {
                      markAck();
                      onSuccess({ autoDrainId, amountCents, currency, cadence });
                      onClose();
                    }}
                  />
                </Elements>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(ui, document.body);
}
