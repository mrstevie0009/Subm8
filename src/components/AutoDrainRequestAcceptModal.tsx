// src/components/AutoDrainRequestAcceptModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';

import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

export type AutoDrainCadence = 'DAILY' | 'WEEKLY' | 'MONTHLY';

type Props = {
  open: boolean;
  onClose: () => void;

  amountCents: number;
  currency: string;
  cadence: AutoDrainCadence;
  customerSessionClientSecret?: string;

  toUserId: string; // Domme
  toDisplayName: string;
  toAvatarUrl?: string;
  conversationId?: string;

  onSuccess: (p: { autoDrainId: string; amountCents: number; currency: string; cadence: AutoDrainCadence }) => void;
  onDeclined?: () => void;
};

const GIFT_ACK_KEY = 'subm8_gift_ack_v1';

// Stripe
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise: Promise<Stripe | null> = STRIPE_PK ? loadStripe(STRIPE_PK) : Promise.resolve(null);

function fmtCurrency(cents: number, currency = 'EUR') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
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
  customerSessionClientSecret?: string;
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

type ConfirmOk = { ok: true; autoDrainId: string; status: string };
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

/* =========================
   Payment Methods (wie Tip)
========================= */
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
  return o.ok === false && typeof o.error === 'string' ? o.error : null;
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
  return o.ok === false && typeof o.error === 'string' ? o.error : null;
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
          <div className="flex items-center gap-2">
            <div className="font-semibold text-[16px]">Zahlungsmethoden</div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mt-1 text-[12px] text-white/65">Speichere eine Karte einmal – danach zahlst du schneller.</div>
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

/* =========================
   Stripe Step (Subscription)
========================= */
function StripeSubscribeStep({
  t,
  autoDrainId,
  sending,
  setSending,
  setError,
  onBack,
  onActivated,
  onOpenMethods,
  savedSummary,
}: {
  t: ReturnType<typeof useTranslations>;
  autoDrainId: string;
  sending: boolean;
  setSending: (v: boolean) => void;
  setError: (s: string | null) => void;
  onBack: () => void;
  onActivated: () => void;
  onOpenMethods: () => void;
  savedSummary: { count: number; hasDefault: boolean };
}) {
  const stripe = useStripe();
  const elements = useElements();

  async function confirmAndFinalize() {
    if (!stripe || !elements) throw new Error('Stripe not ready');

    // 1) PaymentIntent (für Subscription/erste Invoice) bestätigen
    // PaymentElement zeigt gespeicherte Methoden oder neue Karte
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
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onOpenMethods}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60 whitespace-nowrap"
            title="Gespeicherte Karten verwalten"
          >
            Zahlungsmethoden
          </button>
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

      {savedSummary.count > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[12px] text-white/70">
            Gespeicherte Karten: <span className="text-white/85">{savedSummary.count}</span>
            {savedSummary.hasDefault ? <span className="ml-2 text-[var(--purple)]">Default gesetzt</span> : null}
          </div>
          <div className="mt-1 text-[12px] text-white/55">
            Du kannst im Stripe-Feld eine gespeicherte Methode auswählen oder eine neue eingeben.
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-white/55">
          Tipp: Speichere deine Karte einmal über „Zahlungsmethoden“, dann geht das künftig schneller.
        </div>
      )}

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
  const t = useTranslations('payment.autoDrainAcceptModal');

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [giftAck, setGiftAck] = React.useState<boolean>(true);

  const [step, setStep] = React.useState<'review' | 'pay'>('review');
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = React.useState<string | null>(null);
  const [autoDrainId, setAutoDrainId] = React.useState<string | null>(null);

  // NEW: payment methods like TipRequestAcceptModal
  const [methodsOpen, setMethodsOpen] = React.useState(false);
  const [savedCount, setSavedCount] = React.useState(0);
  const [hasDefaultSaved, setHasDefaultSaved] = React.useState(false);

  async function refreshSavedSummary() {
    try {
      const res = await fetch('/api/payments/methods/list', { method: 'GET' });
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok || !isMethodsListOk(j)) {
        setSavedCount(0);
        setHasDefaultSaved(false);
        return;
      }
      setSavedCount(j.methods.length);
      setHasDefaultSaved(!!j.defaultPaymentMethodId);
    } catch {
      setSavedCount(0);
      setHasDefaultSaved(false);
    }
  }

  React.useEffect(() => {
    if (!open) return;

    setError(null);
    setSending(false);
    setStep('review');
    setClientSecret(null);
    setAutoDrainId(null);
    setCustomerSessionClientSecret(null);

    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(GIFT_ACK_KEY) : '1';
      setGiftAck(v === '1');
    } catch {
      setGiftAck(true);
    }

    refreshSavedSummary();
  }, [open]);

  const cadenceLabel =
    cadence === 'DAILY'
      ? t('cadence.daily')
      : cadence === 'WEEKLY'
      ? t('cadence.weekly')
      : t('cadence.monthly');

  async function handleStart() {
    try {
      setSending(true);
      setError(null);

      if (!STRIPE_PK) throw new Error('Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');

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
      setCustomerSessionClientSecret(j.customerSessionClientSecret ?? null);
      setStep('pay');

      refreshSavedSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

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

  if (!open) return null;

  const elementsOptions =
    clientSecret && step === 'pay'
      ? {
          clientSecret,
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
                {/* NEW: methods button (desktop) */}
                <button
                  type="button"
                  onClick={() => setMethodsOpen(true)}
                  className="hidden sm:inline-flex px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px]"
                  title="Gespeicherte Karten verwalten"
                >
                  Zahlungsmethoden
                </button>

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

            {/* NEW: methods button (mobile) */}
            <div className="sm:hidden mt-3">
              <button
                type="button"
                onClick={() => setMethodsOpen(true)}
                className="w-full px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 text-[13px]"
              >
                Zahlungsmethoden
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 pb-5">
            <div className="text-[12px] text-white/75 mb-3">{t('disclaimer')}</div>

            <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
              <div className="text-[13px] text-white/70 mb-1">{t('charge.label')}</div>
              <div className="text-[24px] font-semibold">
                {fmtCurrency(amountCents, currency)}{' '}
                <span className="text-[13px] font-normal text-white/70">({cadenceLabel})</span>
              </div>
              <div className="mt-1 text-[12px] text-white/60">{t('charge.recurringNote')}</div>

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
                />
                <span>{t('acknowledge')}</span>
              </label>
            )}

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
                  onOpenMethods={() => setMethodsOpen(true)}
                  savedSummary={{ count: savedCount, hasDefault: hasDefaultSaved }}
                  onBack={() => {
                    setStep('review');
                    setError(null);
                    setClientSecret(null);
                    setCustomerSessionClientSecret(null);
                    setAutoDrainId(null);
                  }}
                  onActivated={() => {
                    markAck();
                    onSuccess({ autoDrainId, amountCents, currency, cadence });
                    onClose();
                  }}
                />
              </Elements>
            ) : (
              <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 w-full sm:w-auto"
                  disabled={sending}
                >
                  {t('actions.cancel')}
                </button>

                <button
                  type="button"
                  onClick={handleStart}
                  disabled={sending || !giftAck || !STRIPE_PK}
                  className={`px-4 py-2 rounded-lg text-white transition w-full sm:w-auto ${
                    giftAck && !sending && STRIPE_PK ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
                  }`}
                  title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
                >
                  {sending ? t('actions.enabling') : t('actions.enable')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
