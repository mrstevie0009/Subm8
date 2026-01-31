//src/components/TipRequestAcceptModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

type Props = {
  open: boolean;
  onClose: () => void;

  amountCents: number; // Basisbetrag (Domme)
  currency: string;

  toUserId: string;
  toDisplayName: string;
  toAvatarUrl?: string;
  conversationId: string;

  onSuccess: (p: { amountCents: number; currency: string; paymentId?: string }) => void;
};

const CURRENCY = 'EUR';
const TOPUP_PCT = 0.10; // 10% on top

// Stripe
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise: Promise<Stripe | null> = STRIPE_PK ? loadStripe(STRIPE_PK) : Promise.resolve(null);

function fmtCurrency(cents: number, currency = CURRENCY) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

type CreateOk = {
  ok: true;
  paymentId: string;
  currency: string;
  totalCents: number;
  baseAmountCents: number;
  clientSecret: string;
  customerSessionClientSecret?: string;
};

type ConfirmOk = {
  ok: true;
  baseAmountCents: number;
  totalCents: number;
  currency: string;
};

function isCreateOk(x: unknown): x is CreateOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.ok === true &&
    typeof o.paymentId === 'string' &&
    typeof o.clientSecret === 'string' &&
    typeof o.currency === 'string' &&
    typeof o.totalCents === 'number' &&
    typeof o.baseAmountCents === 'number'
  );
}
function getCreateError(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.ok === false && typeof o.error === 'string') return o.error;
  return null;
}
function isConfirmOk(x: unknown): x is ConfirmOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return (
    o.ok === true &&
    typeof o.baseAmountCents === 'number' &&
    typeof o.totalCents === 'number' &&
    typeof o.currency === 'string'
  );
}
function getConfirmError(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.ok === false && typeof o.error === 'string') return o.error;
  return null;
}

type SavedMethod = {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

type MethodsListOk = {
  ok: true;
  customerId: string | null;
  defaultPaymentMethodId: string | null;
  methods: SavedMethod[];
};

function isMethodsListOk(x: unknown): x is MethodsListOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  if (o.ok !== true) return false;
  if (!('methods' in o)) return false;
  return Array.isArray(o.methods);
}

type SetupIntentOk = { ok: true; clientSecret: string };
function isSetupIntentOk(x: unknown): x is SetupIntentOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.ok === true && typeof o.clientSecret === 'string';
}
function getSetupIntentError(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.ok === false && typeof o.error === 'string') return o.error;
  return null;
}

type UpdateOk = { ok: true };
function isUpdateOk(x: unknown): x is UpdateOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.ok === true;
}
function getUpdateError(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.ok === false && typeof o.error === 'string') return o.error;
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function PaymentMethodsModal({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  const [methods, setMethods] = React.useState<SavedMethod[]>([]);
  const [defaultId, setDefaultId] = React.useState<string | null>(null);

  async function loadMethods() {
    const res = await fetch('/api/payments/methods/list', { method: 'GET' });
    const j: unknown = await res.json().catch(() => null);

    if (!res.ok) throw new Error(getUpdateError(j) ?? 'Failed to load payment methods');
    if (!isMethodsListOk(j)) throw new Error('Invalid response');

    setMethods(j.methods);
    setDefaultId(j.defaultPaymentMethodId);
  }

  React.useEffect(() => {
    if (!open) return;

    setError(null);
    setClientSecret(null);
    setMethods([]);
    setDefaultId(null);

    setLoading(true);
    loadMethods()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open]);

  async function startSetupIntent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/setup-intent', { method: 'POST' });
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok) throw new Error(getSetupIntentError(j) || 'Failed to start setup');
      if (!isSetupIntentOk(j)) throw new Error('Invalid response');

      setClientSecret(j.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start setup');
    } finally {
      setLoading(false);
    }
  }

  async function setDefault(paymentMethodId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'set_default', paymentMethodId }),
      });
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok) throw new Error(getUpdateError(j) || 'Failed to set default');
      if (!isUpdateOk(j)) throw new Error('Invalid response');

      await loadMethods();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set default');
    } finally {
      setLoading(false);
    }
  }

  async function detach(paymentMethodId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'detach', paymentMethodId }),
      });
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok) throw new Error(getUpdateError(j) || 'Failed to remove method');
      if (!isUpdateOk(j)) throw new Error('Invalid response');

      await loadMethods();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove method');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const elementsOptions =
    clientSecret
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

  return (
    <div className="fixed inset-0 z-[1100] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-[min(720px,94vw)] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 py-4 border-b border-white/10">
          <div
            className="absolute inset-0 -z-10"
            style={{
              background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.30), rgba(139,92,246,0))',
            }}
          />
        </div>

        <div className="px-5 py-5">
          {error && (
            <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[13px] text-white/80">Gespeicherte Karten</div>
              <button
                type="button"
                onClick={startSetupIntent}
                disabled={loading || !STRIPE_PK}
                className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60 whitespace-nowrap"
                title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
              >
                + Karte hinzufügen
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading && methods.length === 0 ? (
                <div className="text-[13px] text-white/60">Lade …</div>
              ) : methods.length === 0 ? (
                <div className="text-[13px] text-white/60">Noch keine Zahlungsmethode gespeichert.</div>
              ) : (
                methods.map((m) => {
                  const isDef = defaultId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] text-white/85 truncate">
                          {m.brand.toUpperCase()} •••• {m.last4}
                        </div>
                        <div className="text-[12px] text-white/55">
                          Exp {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                          {isDef ? <span className="ml-2 text-[11px] text-[var(--purple)]">Default</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        {!isDef && (
                          <button
                            type="button"
                            onClick={() => setDefault(m.id)}
                            disabled={loading}
                            className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60"
                          >
                            Als Default
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => detach(m.id)}
                          disabled={loading}
                          className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60"
                        >
                          Entfernen
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {clientSecret && elementsOptions ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
              <div className="text-[13px] text-white/80">Neue Karte speichern</div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <SetupIntentForm
                    onDone={async () => {
                      setClientSecret(null);
                      await loadMethods();
                      onChanged();
                    }}
                    onError={(msg) => setError(msg || null)}
                  />
                </Elements>
              </div>
              <div className="mt-2 text-[12px] text-white/55">
                Die Karte wird sicher von Stripe gespeichert. Du kannst sie jederzeit entfernen.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SetupIntentForm({ onDone, onError }: { onDone: () => void; onError: (msg: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      onError('');

      if (!stripe || !elements) throw new Error('Stripe not ready');

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || 'Failed to save');
      if (setupIntent?.status !== 'succeeded' && setupIntent?.status !== 'processing') {
        throw new Error('Setup not completed');
      }

      await sleep(300);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PaymentElement />
      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !stripe || !elements}
          className={`relative px-4 py-2 rounded-lg text-white transition ${
            !saving && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          {saving ? 'Speichern…' : 'Karte speichern'}
        </button>
      </div>
    </div>
  );
}

type Step = 'review' | 'pay' | 'success';

function StripePayStep({
  t,
  paymentId,
  sending,
  setSending,
  setError,
  onBack,
  onPaid,
}: {
  t: ReturnType<typeof useTranslations>;
  paymentId: string;
  sending: boolean;
  setSending: (v: boolean) => void;
  setError: (s: string | null) => void;
  onBack: () => void;
  onPaid: (r: { paymentId: string; totalCents: number; currency: string; baseAmountCents: number }) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function finalizeWithPoll() {
    const delays = [0, 400, 800, 1200];
    let lastErr: string | null = null;

    for (const d of delays) {
      if (d) await sleep(d);

      const res = await fetch('/api/payments/tips/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      const j: unknown = await res.json().catch(() => null);

      if (res.ok && isConfirmOk(j)) {
        onPaid({
          paymentId,
          totalCents: j.totalCents,
          currency: j.currency || CURRENCY,
          baseAmountCents: j.baseAmountCents,
        });
        return;
      }

      const err = getConfirmError(j);
      lastErr = err || null;

      if (res.status === 400 || res.status === 401 || res.status === 404) {
        throw new Error(err || (t('errors.confirm') ?? 'Confirm failed'));
      }
    }

    throw new Error(lastErr || (t('errors.confirm') ?? 'Confirm failed'));
  }

  async function handleConfirmPayment() {
    try {
      setSending(true);
      setError(null);

      if (!stripe || !elements) throw new Error('Stripe not ready');

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? window.location.href : undefined,
        },
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || (t('errors.generic') ?? 'Payment failed'));
      if (paymentIntent?.status === 'canceled') throw new Error('Payment canceled');
      if (paymentIntent?.status === 'requires_payment_method') throw new Error('Payment failed');

      await finalizeWithPoll();
    } catch (e) {
      setError(e instanceof Error ? e.message : (t('errors.generic') ?? 'Payment failed'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] text-white/80">{t('stripe.enterCard') ?? 'Karte auswählen oder eingeben'}</div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60 whitespace-nowrap"
          >
            {t('actions.back') ?? 'Zurück'}
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <PaymentElement />
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={sending || !stripe || !elements}
          className={`relative px-4 py-2 rounded-lg text-white transition ${
            !sending && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          {sending ? (t('actions.processing') ?? 'Verarbeite…') : (t('actions.payNow') ?? 'Jetzt zahlen')}
        </button>
      </div>

      <div className="mt-2 text-[12px] text-white/55">
        {t('stripe.secureHint') ?? 'Die Zahlungsdaten werden sicher von Stripe verarbeitet.'}
      </div>
    </div>
  );
}

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

  const [step, setStep] = React.useState<Step>('review');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [stripeClientSecret, setStripeClientSecret] = React.useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = React.useState<string | null>(null);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);

  const [methodsOpen, setMethodsOpen] = React.useState(false);

  const platformFeeCents = Math.round(amountCents * TOPUP_PCT);
  const totalCents = amountCents + platformFeeCents;
  const pctLabel = Math.round(TOPUP_PCT * 100);

  async function refreshSavedSummary() {
    try {
      const res = await fetch('/api/payments/methods/list', { method: 'GET' });
      const j: unknown = await res.json().catch(() => null);
      if (!res.ok || !isMethodsListOk(j)) {
        return;
      }
    } catch {
    }
  }

  React.useEffect(() => {
    if (!open) return;

    setError(null);
    setSending(false);
    setStep('review');
    setStripeClientSecret(null);
    setCustomerSessionClientSecret(null);
    setPaymentId(null);

    refreshSavedSummary();
  }, [open]);

  async function handleContinueToPay() {
    try {
      setSending(true);
      setError(null);

      if (!STRIPE_PK) throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');

      const res1 = await fetch('/api/payments/tips/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toUserId, amountCents, conversationId }),
      });
      const j1: unknown = await res1.json().catch(() => null);

      if (!res1.ok || !isCreateOk(j1)) {
        throw new Error(getCreateError(j1) || (t('errors.create') ?? 'Failed to create payment'));
      }

      setPaymentId(j1.paymentId);
      setStripeClientSecret(j1.clientSecret);
      setCustomerSessionClientSecret(j1.customerSessionClientSecret ?? null);
      setStep('pay');

      refreshSavedSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : (t('errors.generic') ?? 'Something went wrong'));
    } finally {
      setSending(false);
    }
  }

  function handlePaidFinal(r: { paymentId: string; totalCents: number; currency: string; baseAmountCents: number }) {
    setStep('success');
    onSuccess({ amountCents: r.baseAmountCents, currency: r.currency, paymentId: r.paymentId });
  }

  if (!open) return null;

  const elementsOptions =
    stripeClientSecret && step === 'pay'
      ? {
          clientSecret: stripeClientSecret,
          customerSessionClientSecret: customerSessionClientSecret ?? undefined,
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

  return (
    <>
      <PaymentMethodsModal
        open={methodsOpen}
        onClose={() => setMethodsOpen(false)}
        onChanged={() => refreshSavedSummary()}
      />

      <div className="fixed inset-0 z-[1000] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div
          className="relative w-[min(640px,94vw)] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-5 py-4">
            <div
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.35), rgba(139,92,246,0))',
              }}
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

              <div className="ml-auto flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10"
                  aria-label={t('actions.closeAria')}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          {step !== 'success' ? (
            <div className="px-5 pb-5">
              <div className="text-[12px] text-white/75 mb-3">{t('disclaimer')}</div>

              <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                <label className="block text-[12px] text-white/70 mb-1">{t('requested.label')}</label>
                <div className="text-[24px] font-semibold">{fmtCurrency(amountCents, currency)}</div>
                <p className="mt-1 text-[12px] text-white/60">{t('requested.note', { pct: pctLabel })}</p>
              </div>

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

              {step === 'pay' && paymentId && stripeClientSecret && elementsOptions ? (
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <StripePayStep
                    t={t}
                    paymentId={paymentId}
                    sending={sending}
                    setSending={setSending}
                    setError={setError}
                    onBack={() => {
                      setStep('review');
                      setError(null);
                      setStripeClientSecret(null);
                      setCustomerSessionClientSecret(null);
                      setPaymentId(null);
                    }}
                    onPaid={(r) => handlePaidFinal(r)}
                  />
                </Elements>
              ) : (
                <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
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
                    onClick={handleContinueToPay}
                    disabled={sending || !STRIPE_PK}
                    className={`relative px-4 py-2 rounded-lg text-white transition ${
                      !sending && STRIPE_PK ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
                    }`}
                    title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
                  >
                    {sending ? t('actions.processing') : t('actions.sendGiftAccept', { total: fmtCurrency(totalCents, currency) })}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 pb-6 pt-2">
              <div className="text-center mt-4">
                <div className="inline-grid place-items-center w-14 h-14 rounded-full bg-[var(--purple)]/20 border border-[var(--purple)]/30">
                  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
                    <path
                      d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9Z"
                      fill="currentColor"
                    />
                  </svg>
                </div>
                <h3 className="mt-3 text-[18px] font-semibold">{t('success.title') ?? 'Erfolgreich'}</h3>
                <p className="mt-1 text-white/80">
                  {t('success.youPaid', { amount: fmtCurrency(totalCents, currency) }) ?? 'Zahlung abgeschlossen.'}
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95"
                  >
                    {t('actions.done') ?? 'Fertig'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
