// src/components/TipModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';

import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

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
    amountCents: number; // Basisbetrag (Domme)
    totalCents: number; // You pay (inkl. Platform fee on top)
    currency: string;
    note?: string;
  }) => void;
};

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;
const CURRENCY = 'EUR';
const PLATFORM_FEE_BPS_TOPUP = 1000; // 10% on top
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

function fmtCurrency(cents: number, currency = CURRENCY) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

function RolePill({ role }: { role: Props['toRole'] }) {
  // Hinweis: In deinem Code war hier "payment.tipModal.roles" – ich lasse es unverändert,
  // damit du nichts an den Namespaces ändern musst.
  const t = useTranslations('payment.tipModal.roles');
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
      {isDomme ? t('domme') : t('sub')}
    </span>
  );
}

type CreateOk = {
  ok: true;
  paymentId: string;
  currency: string;
  totalCents: number;
  baseAmountCents: number;
  clientSecret: string;
};

type ConfirmOk = {
  ok: true;
  baseAmountCents: number;
  totalCents: number;
  currency: string;
};

type Step = 'form' | 'pay' | 'success';

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
  return o.ok === true && typeof o.baseAmountCents === 'number' && typeof o.totalCents === 'number' && typeof o.currency === 'string';
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
  if (!('methods' in o) || !Array.isArray(o.methods)) return false;
  return true;
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
  t,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  const [methods, setMethods] = React.useState<SavedMethod[]>([]);
  const [defaultId, setDefaultId] = React.useState<string | null>(null);

  const loadMethods = React.useCallback(async () => {
    const res = await fetch('/api/payments/methods/list', { method: 'GET' });
    const j: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const err = getUpdateError(j) ?? t('methods.errors.loadFailed');
      throw new Error(err);
    }

    if (!isMethodsListOk(j)) throw new Error(t('methods.errors.invalidResponse'));
    setMethods(j.methods);
    setDefaultId(j.defaultPaymentMethodId);
  }, [t]); // t ist die einzige externe Referenz hier

  React.useEffect(() => {
    if (!open) return;

    setError(null);
    setClientSecret(null);
    setMethods([]);
    setDefaultId(null);

    setLoading(true);
    loadMethods()
      .catch((e) => setError(e instanceof Error ? e.message : t('methods.errors.loadFailed')))
      .finally(() => setLoading(false));
  }, [open, loadMethods, t]);

  async function startSetupIntent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/setup-intent', { method: 'POST' });
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok) throw new Error(getSetupIntentError(j) || t('methods.errors.startSetupFailed'));
      if (!isSetupIntentOk(j)) throw new Error(t('methods.errors.invalidResponse'));

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

      if (!res.ok) throw new Error(getUpdateError(j) || t('methods.errors.setDefaultFailed'));
      if (!isUpdateOk(j)) throw new Error(t('methods.errors.invalidResponse'));

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

      if (!res.ok) throw new Error(getUpdateError(j) || t('methods.errors.removeFailed'));
      if (!isUpdateOk(j)) throw new Error(t('methods.errors.invalidResponse'));

      await loadMethods();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove method');
    } finally {
      setLoading(false);
    }
  }

  const mounted = useMounted();
  if (!open || !mounted) return null;

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

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483603] grid place-items-center bg-black/60 backdrop-blur-sm overscroll-contain p-3 sm:p-0"
      onClick={onClose}
    >
      <div
        className={[
          "relative w-full sm:w-[min(720px,94vw)] max-w-[720px]",
          "max-h-[calc(100dvh-24px)] sm:max-h-[85vh]",
          "rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d] flex flex-col",
        ].join(" ")}
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
            <div className="font-semibold text-[16px]">{t('methods.title')}</div>
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
          <div className="mt-1 text-[12px] text-white/65">{t('methods.subtitle')}</div>
        </div>

        <div className="px-5 py-5 overflow-y-auto overscroll-contain [ -webkit-overflow-scrolling:touch ]">
          {error && (
            <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-white/80">{t('methods.savedCards')}</div>
              <button
                type="button"
                onClick={startSetupIntent}
                disabled={loading || !STRIPE_PK}
                className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
                title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
              >
                {t('methods.actions.addCard')}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading && methods.length === 0 ? (
                <div className="text-[13px] text-white/60">{t('methods.loading')}</div>
              ) : methods.length === 0 ? (
                <div className="text-[13px] text-white/60">{t('methods.empty')}</div>
              ) : (
                methods.map((m) => {
                  const isDef = defaultId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] text-white/85 truncate">
                          {m.brand.toUpperCase()} •••• {m.last4}
                        </div>
                        <div className="text-[12px] text-white/55">
                          Exp {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                          {isDef ? <span className="ml-2 text-[11px] text-[var(--purple)]">{t('methods.default')}</span> : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {!isDef && (
                          <button
                            type="button"
                            onClick={() => setDefault(m.id)}
                            disabled={loading}
                            className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60"
                          >
                            {t('methods.actions.setDefault')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => detach(m.id)}
                          disabled={loading}
                          className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60"
                        >
                          {t('methods.actions.remove')}
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
                    t={t}
                    onDone={async () => {
                      setClientSecret(null);
                      await loadMethods();
                      onChanged();
                    }}
                    onError={(msg) => setError(msg)}
                  />
                </Elements>
              </div>
              <div className="mt-2 text-[12px] text-white/55">{t('methods.securityNote')}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

function SetupIntentForm({
  onDone,
  onError,
  t,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      onError('');

      if (!stripe || !elements) throw new Error(t('stripe.errors.notReady'));

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || t('methods.errors.saveFailed'));
      if (setupIntent?.status !== 'succeeded' && setupIntent?.status !== 'processing') {
        throw new Error(t('methods.errors.setupNotCompleted'));
      }

      await sleep(300);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : t('methods.errors.saveFailed'));
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
          {saving ? t('methods.actions.saving') : t('methods.actions.saveCard')}
        </button>
      </div>
    </div>
  );
}

function StripePayStep({
  t,
  paymentId,
  sending,
  setSending,
  setError,
  onBack,
  onPaid,
  onOpenMethods,
  savedSummary,
}: {
  t: ReturnType<typeof useTranslations>;
  paymentId: string;
  sending: boolean;
  setSending: (v: boolean) => void;
  setError: (s: string | null) => void;
  onBack: () => void;
  onPaid: (r: { paymentId: string; totalCents: number; currency: string; baseAmountCents: number }) => void;
  onOpenMethods: () => void;
  savedSummary: { count: number; hasDefault: boolean };
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
        throw new Error(err || t('errors.confirmFailed'));
      }
    }

    throw new Error(lastErr || t('errors.confirmFailed'));
  }

  async function handleConfirmPayment() {
    try {
      setSending(true);
      setError(null);

      if (!stripe || !elements) throw new Error(t('stripe.errors.notReady'));

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? window.location.href : undefined,
        },
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || t('errors.generic'));
      if (paymentIntent?.status === 'canceled') throw new Error(t('stripe.errors.canceled'));
      if (paymentIntent?.status === 'requires_payment_method') throw new Error(t('stripe.errors.paymentFailed'));

      await finalizeWithPoll();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] text-white/80">{t('stripe.enterCard')}</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMethods}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
            title={t('methods.actions.manageTitle')}
          >
            Zahlungsmethoden
          </button>
          <button
            type="button"
            onClick={onBack}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
          >
            {t('actions.back')}
          </button>
        </div>
      </div>

      {savedSummary.count > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[12px] text-white/70">
            {t('stripe.savedCardsSummary', { count: savedSummary.count })}
            {savedSummary.hasDefault ? <span className="ml-2 text-[var(--purple)]">{t('stripe.defaultSet')}</span> : null}
          </div>
          <div className="mt-1 text-[12px] text-white/55">{t('stripe.savedCardsHint')}</div>
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-white/55">{t('stripe.tipSaveCard')}</div>
      )}

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <PaymentElement />
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={handleConfirmPayment}
          disabled={sending || !stripe || !elements}
          className={`relative px-4 py-2 rounded-lg text-white transition ${
            !sending && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <SparkleIcon />
            {sending ? t('actions.sending') : (t('actions.payNow') ?? 'Jetzt zahlen')}
          </span>
        </button>
      </div>

      <div className="mt-2 text-[12px] text-white/55">{t('stripe.secureHint')}</div>
    </div>
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
  const t = useTranslations('payments.tipModal');

  const [amount, setAmount] = React.useState('50');
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [step, setStep] = React.useState<Step>('form');

  const [stripeClientSecret, setStripeClientSecret] = React.useState<string | null>(null);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);

  const [success, setSuccess] = React.useState<null | { paymentId: string; totalCents: number; currency: string }>(null);

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

  const [giftAck, setGiftAck] = React.useState<boolean>(true);
  React.useEffect(() => {
    if (!open) return;

    setSuccess(null);
    setError(null);
    setSending(false);
    setStep('form');
    setStripeClientSecret(null);
    setPaymentId(null);

    refreshSavedSummary();

    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(GIFT_ACK_KEY) : '1';
      setGiftAck(v === '1');
    } catch {
      setGiftAck(true);
    }
  }, [open]);

  const amountCents = parseCents(amount) ?? 0;
  const topupFeeCents = Math.round(amountCents * (PLATFORM_FEE_BPS_TOPUP / 10_000));
  const totalCents = amountCents + topupFeeCents;

  const amountValid = amountCents >= MIN_CENTS && amountCents <= MAX_CENTS;
  const canSend = amountValid && !sending && giftAck;

  async function handleStartStripePayment() {
    try {
      setSending(true);
      setError(null);

      if (!STRIPE_PK) throw new Error(t('stripe.errors.missingPublishableKey'));

      const body = { toUserId, amountCents, note: note.trim() || undefined, conversationId };

      const res1 = await fetch('/api/payments/tips/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      const j: unknown = await res1.json().catch(() => null);

      if (!res1.ok || !isCreateOk(j)) {
        throw new Error(getCreateError(j) || t('errors.createFailed'));
      }

      setPaymentId(j.paymentId);
      setStripeClientSecret(j.clientSecret);
      setStep('pay');

      refreshSavedSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  function handlePaidFinal(r: { paymentId: string; totalCents: number; currency: string; baseAmountCents: number }) {
    setSuccess({ paymentId: r.paymentId, totalCents: r.totalCents, currency: r.currency });
    setStep('success');

    try {
      localStorage.setItem(GIFT_ACK_KEY, '1');
      fetch('/api/me/disclaimers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ giftAccepted: true }),
      }).catch(() => {});
    } catch {}

    onSuccess?.({
      paymentId: r.paymentId,
      amountCents: r.baseAmountCents,
      totalCents: r.totalCents,
      currency: r.currency,
      note: note.trim() || undefined,
    });
  }

  const mounted = useMounted();
  if (!open || !mounted) return null;

  const elementsOptions =
    stripeClientSecret && step === 'pay'
      ? {
          clientSecret: stripeClientSecret,
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

  const modalUi = (
    <>
      <PaymentMethodsModal
        open={methodsOpen}
        onClose={() => setMethodsOpen(false)}
        onChanged={() => {
          refreshSavedSummary();
        }}
        t={t}
      />

      <div
        className="fixed inset-0 z-[2147483600] grid place-items-center bg-black/60 backdrop-blur-sm overscroll-contain p-3 sm:p-0"
        onClick={() => {
          setSuccess(null);
          onClose();
        }}
      >
        <div
          className={["relative w-full sm:w-[min(680px,94vw)] max-w-[680px]",
                     "max-h-[calc(100dvh-24px)] sm:max-h-[85vh]",
                     "rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d] flex flex-col",
                  ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-4 py-3 sm:px-5 sm:py-4">
            <div
              className="absolute inset-0 -z-10"
              style={{
                background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.35), rgba(139,92,246,0))',
              }}
            />

            {/* Row 1: Avatar + Title/Role + Close */}
            <div className="flex items-start gap-3">
              <div className="relative w-10 h-10 rounded-full overflow-hidden border border-white/15 bg-white/10 shrink-0">
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

              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  {/* Auf Mobile NICHT hart truncate, sondern 2 Zeilen erlauben */}
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] sm:text-[16px] leading-snug break-words line-clamp-2">
                      {t('header.title', { name: toDisplayName })}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[12px] text-white/70">
                      <RolePill role={toRole} />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSuccess(null);
                      onClose();
                    }}
                    className="ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10 shrink-0"
                    aria-label={t('aria.close')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Payment methods (stacked on mobile, inline on sm+) */}
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setMethodsOpen(true)}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px]"
                title={t('methods.actions.manageTitle')}
              >
                Zahlungsmethoden
              </button>
            </div>
          </div>

          {/* Body */}
          {step !== 'success' ? (
            <div className="px-5 pb-5 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="mb-3 text-[12px] text-white/75">{t('disclaimer.top')}</div>

              <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                <label className="block text-[12px] text-white/70 mb-1">{t('amount.label')}</label>
                <div className="flex items-center gap-2">
                  <div className="shrink-0 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80">€</div>
                  <input
                    inputMode="decimal"
                    placeholder={t('amount.placeholder')}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={sending || step === 'pay'}
                    className="flex-1 bg-transparent outline-none text-[28px] leading-none font-semibold tracking-wide placeholder:text-white/30 disabled:opacity-60"
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {[5, 10, 25, 50].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(String(p))}
                      disabled={sending || step === 'pay'}
                      className="px-3 py-1.5 rounded-full text-[13px] border border-white/15 hover:bg-white/10 disabled:opacity-60"
                    >
                      {fmtCurrency(p * 100)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-3">
                <label className="block text-[12px] text-white/70 mb-1">{t('note.label')}</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={200}
                  rows={2}
                  placeholder={t('note.placeholder')}
                  disabled={sending || step === 'pay'}
                  className="w-full rounded-xl bg-white/[.03] border border-white/10 px-3 py-2 outline-none text-white disabled:opacity-60"
                />
                <div className="mt-1 text-[12px] text-white/50">{note.length}/200</div>
              </div>

              <div className="mt-4 rounded-xl border border-white/10 bg-gradient-to-b from-white/[.04] to-transparent p-3">
                <div className="flex items-center justify-between text-[14px] mb-1">
                  <span>{t('breakdown.amountToCreator')}</span>
                  <strong className="text-white">{fmtCurrency(amountCents)}</strong>
                </div>
                <div className="flex items-center justify-between text-[13px] text-white/70">
                  <span>{t('breakdown.platformFeeTop')}</span>
                  <span>{fmtCurrency(topupFeeCents)}</span>
                </div>
                <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between">
                  <span className="text-[14px]">{t('breakdown.youPay')}</span>
                  <span className="text-[16px] font-semibold">{fmtCurrency(totalCents)}</span>
                </div>
                <div className="mt-2 text-[12px] text-white/70">{t('disclaimer.legal')}</div>
              </div>

              {!giftAck && step === 'form' && (
                <label className="mt-3 flex items-start gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    className="accent-[var(--purple)] mt-[2px]"
                    checked={giftAck}
                    onChange={(e) => setGiftAck(e.target.checked)}
                  />
                  <span>{t('ack.checkbox')}</span>
                </label>
              )}

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
                      setStep('form');
                      setError(null);
                      setStripeClientSecret(null);
                      setPaymentId(null);
                    }}
                    onPaid={(r) => handlePaidFinal(r)}
                    onOpenMethods={() => setMethodsOpen(true)}
                    savedSummary={{ count: savedCount, hasDefault: hasDefaultSaved }}
                  />
                </Elements>
              ) : (
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccess(null);
                      onClose();
                    }}
                    className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
                    disabled={sending}
                  >
                    {t('actions.cancel')}
                  </button>

                  <button
                    type="button"
                    onClick={handleStartStripePayment}
                    disabled={!canSend || !STRIPE_PK}
                    className={`relative px-4 py-2 rounded-lg text-white transition ${
                      canSend && STRIPE_PK ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
                    }`}
                    title={!STRIPE_PK ? t('stripe.errors.missingPublishableKey') : undefined}
                  >
                    <span className="inline-flex items-center gap-2">
                      <SparkleIcon />
                      {sending ? t('actions.sending') : (t('actions.continueToPay') ?? t('actions.sendGift'))}
                    </span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 pb-6 pt-2 relative">
              <ConfettiHearts />
              <div className="text-center mt-4">
                <div className="inline-grid place-items-center w-16 h-16 rounded-full bg-[var(--purple)]/20 border border-[var(--purple)]/30">
                  <HeartIcon big />
                </div>
                <h3 className="mt-3 text-[18px] font-semibold">{t('success.title')}</h3>
                <p className="mt-1 text-white/80">{t('success.youPaid', { amount: fmtCurrency(success?.totalCents ?? 0) })}</p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      setSuccess(null);
                      onClose();
                    }}
                    className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95"
                  >
                    {t('actions.done')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <style jsx>{`
            @keyframes floatUp {
              0% {
                transform: translateY(10px) scale(0.9);
                opacity: 0;
              }
              20% {
                opacity: 1;
              }
              100% {
                transform: translateY(-120px) scale(1.1);
                opacity: 0;
              }
            }
          `}</style>
        </div>
      </div>
    </>
  );

  return createPortal(modalUi, document.body);
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
      <path
        d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2Zm6 8 1.2 2.8L22 14l-2.8 1.2L18 18l-1.2-2.8L14 14l2.8-1.2L18 10Z"
        fill="currentColor"
        opacity=".9"
      />
    </svg>
  );
}
function HeartIcon({ big = false }: { big?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width={big ? 22 : 14} height={big ? 22 : 14} aria-hidden>
      <path
        d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9Z"
        fill="currentColor"
      />
    </svg>
  );
}
function ConfettiHearts() {
  return null;
}
