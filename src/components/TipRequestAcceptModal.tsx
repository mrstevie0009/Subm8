// src/components/TipRequestAcceptModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';

import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import { useStepUp } from "@/hooks/useStepUp";
import { StepUpDialog } from "@/components/StepUpDialog";
import { computeTipBreakdown, TIP_TOPUP_RATE } from '@/lib/fees';

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

// Stripe
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const stripePromise: Promise<Stripe | null> = STRIPE_PK ? loadStripe(STRIPE_PK) : Promise.resolve(null);

function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}

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
  return o.ok === true && typeof o.baseAmountCents === 'number' && typeof o.totalCents === 'number' && typeof o.currency === 'string';
}
function getConfirmError(x: unknown): string | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (o.ok === false && typeof o.error === 'string') return o.error;
  return null;
}

/* =========================
   Payment Methods (wie TipModal)
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function PaymentMethodsModal({
  open,
  onClose,
  onChanged,
  title = 'Zahlungsmethoden',
  subtitle = 'Speichere eine Karte einmal – danach zahlst du schneller.',
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  title?: string;
  subtitle?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [peKey, setPeKey] = React.useState(0);
  const [methods, setMethods] = React.useState<SavedMethod[]>([]);
  const [defaultId, setDefaultId] = React.useState<string | null>(null);
  const mounted = useMounted();
  const tTip = useTranslations("payment.tipModal");

  const stepUp = useStepUp();
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [stepUpLabel, setStepUpLabel] = React.useState("");
  const pendingActionRef = React.useRef<(() => void) | null>(null);

  const loadMethods = React.useCallback(async () => {
    const res = await fetch('/api/payments/methods/list', { method: 'GET' });
    const j: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(getUpdateError(j) ?? 'Failed to load payment methods');
    if (!isMethodsListOk(j)) throw new Error('Invalid response');
    setMethods(j.methods);
    setDefaultId(j.defaultPaymentMethodId);
  }, []);

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
  }, [open, loadMethods]);

  function withStepUp(label: string, action: () => void) {
    if (stepUp.isVerified) { action(); return; }
    setStepUpLabel(label);
    pendingActionRef.current = action;
    setStepUpOpen(true);
  }

  function startSetupIntent() {
    withStepUp('Karte hinzufügen', () => void doStartSetupIntent());
  }

  async function doStartSetupIntent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/setup-intent', {
        method: 'POST',
        headers: stepUp.stepUpHeaders(),
      });
      const j: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getSetupIntentError(j) || 'Failed to start setup');
      if (!isSetupIntentOk(j)) throw new Error('Invalid response');
      setClientSecret(j.clientSecret);
      setPeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start setup');
    } finally {
      setLoading(false);
    }
  }

  function setDefault(paymentMethodId: string) {
    withStepUp('Als Default setzen', () => void doSetDefault(paymentMethodId));
  }

  async function doSetDefault(paymentMethodId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...stepUp.stepUpHeaders() },
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

  function detach(paymentMethodId: string) {
    withStepUp('Karte entfernen', () => void doDetach(paymentMethodId));
  }

  async function doDetach(paymentMethodId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...stepUp.stepUpHeaders() },
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

  const elementsOptions = clientSecret
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

  if (!open || !mounted) return null;

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[2147483603] grid place-items-center bg-black/60 backdrop-blur-sm overscroll-contain p-3 sm:p-0" onClick={onClose}>
          <div
            className={['relative w-full sm:w-[min(720px,94vw)] max-w-[720px]', 'max-h-[calc(100dvh-24px)] sm:max-h-[85vh]', 'rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d] flex flex-col'].join(' ')}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative px-5 py-4 border-b border-white/10">
              <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.30), rgba(139,92,246,0))' }} />
              <div className="flex items-center gap-2">
                <div className="font-semibold text-[16px]">{title}</div>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={onClose} className="inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10" aria-label="Close">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              </div>
              <div className="mt-1 text-[12px] text-white/65">{subtitle}</div>
            </div>

            <div className="px-5 py-5 overflow-y-auto overscroll-contain [ -webkit-overflow-scrolling:touch ]">
              {error && <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

              <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-white/80">{tTip("methods.savedCards")}</div>
                  <button type="button" onClick={startSetupIntent} disabled={loading || !STRIPE_PK} className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60">
                    {tTip("methods.actions.addCard")}
                  </button>
                </div>
                <div className="mt-3 space-y-2">
                  {loading && methods.length === 0 ? (
                    <div className="text-[13px] text-white/60">{tTip("methods.loading")}</div>
                  ) : methods.length === 0 ? (
                    <div className="text-[13px] text-white/60">{tTip("methods.empty")}</div>
                  ) : (
                    methods.map((m) => {
                      const isDef = defaultId === m.id;
                      return (
                        <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-[13px] text-white/85 truncate">{m.brand.toUpperCase()} •••• {m.last4}</div>
                            <div className="text-[12px] text-white/55">
                              Exp {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                              {isDef ? <span className="ml-2 text-[11px] text-[var(--purple)]">{tTip("methods.default")}</span> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isDef && (
                              <button type="button" onClick={() => setDefault(m.id)} disabled={loading} className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60">
                                {tTip("methods.actions.setDefault")}
                              </button>
                            )}
                            <button type="button" onClick={() => detach(m.id)} disabled={loading} className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60">
                              {tTip("methods.actions.remove")}
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
                  <div className="text-[13px] text-white/80">{tTip("stripe.newCardTitle")}</div>
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <SetupIntentForm
                        peKey={peKey}
                        stepUpHeaders={stepUp.stepUpHeaders}
                        onDone={async () => {
                          setPeKey((k) => k + 1);
                          setClientSecret(null);
                          await loadMethods();
                          onChanged();
                        }}
                        onError={(msg) => setError(msg)}
                      />
                    </Elements>
                  </div>
                  <div className="mt-2 text-[12px] text-white/55">{tTip("methods.securityNote")}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>,
        document.body
      )}
      <StepUpDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onVerified={() => {
          setStepUpOpen(false);
          pendingActionRef.current?.();
          pendingActionRef.current = null;
        }}
        actionLabel={stepUpLabel}
        verify={stepUp.verify}
      />
    </>
  );
}

function SetupIntentForm({
  onDone,
  onError,
  peKey,
  stepUpHeaders,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
  peKey: number;
  stepUpHeaders: () => Record<string, string>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = React.useState(false);
  const [billName, setBillName] = React.useState('');
  const [billEmail, setBillEmail] = React.useState('');
  const [billPhone, setBillPhone] = React.useState('');
  const tTip = useTranslations("payment.tipModal");

  async function handleSave() {
    try {
      setSaving(true);
      onError('');
      if (!stripe || !elements) throw new Error('Stripe not ready');
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
        confirmParams: {
          payment_method_data: {
            billing_details: {
              name: billName || undefined,
              email: billEmail || undefined,
              phone: billPhone || undefined,
            },
          },
        },
      });
      if (error) throw new Error(error.message || 'Failed to save');
      if (setupIntent?.status !== 'succeeded' && setupIntent?.status !== 'processing') throw new Error('Setup not completed');
      const setDefaultRes = await fetch('/api/payments/methods/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...stepUpHeaders() },
        body: JSON.stringify({ action: 'set_default_from_setup', setupIntentId: setupIntent.id, billingEmail: billEmail.trim() || undefined }),
      });
      const setDefaultJ: unknown = await setDefaultRes.json().catch(() => null);
      if (!setDefaultRes.ok) {
        const err = typeof setDefaultJ === 'object' && setDefaultJ && 'error' in setDefaultJ && typeof setDefaultJ.error === 'string'
          ? setDefaultJ.error : 'Failed to set default payment method';
        throw new Error(err);
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
      <div className="grid gap-2 mb-3">
        <input value={billName} onChange={(e) => setBillName(e.target.value)} placeholder="Name" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none" />
        <input value={billEmail} onChange={(e) => setBillEmail(e.target.value)} placeholder="E-Mail" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none" />
        <input value={billPhone} onChange={(e) => setBillPhone(e.target.value)} placeholder="Telefon" className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none" />
      </div>
      <PaymentElement key={`setup-pe-${peKey}`} options={{ layout: 'tabs' }} />
      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !stripe || !elements}
          className={`relative px-4 py-2 rounded-lg text-white transition ${!saving && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'}`}
        >
          {saving ? tTip("methods.actions.saving") : tTip("methods.actions.saveCard")}
        </button>
      </div>
    </div>
  );
}

/* =========================
   Stripe Pay Step (wie TipModal Save/Remove)
========================= */
type Step = 'review' | 'pay' | 'success';

function StripePayStep({
  t,
  paymentId,
  sending,
  setSending,
  setError,
  onBack,
  onPaid,
  savedSummary,
  onRemoveSaved,
}: {
  t: ReturnType<typeof useTranslations>;
  paymentId: string;
  sending: boolean;
  setSending: (v: boolean) => void;
  setError: (s: string | null) => void;
  onBack: () => void;
  onPaid: (r: { paymentId: string; totalCents: number; currency: string; baseAmountCents: number }) => void;
  savedSummary: { count: number; hasDefault: boolean };
  onRemoveSaved: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const tTip = useTranslations("payment.tipModal");
  const tTipRe = useTranslations("payment.tipRequestAcceptModal");

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
        confirmParams: { return_url: typeof window !== 'undefined' ? window.location.href : undefined },
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
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] text-white/80">{t('stripe.enterCard') ?? 'Karte auswählen oder eingeben'}</div>

        <div className="flex items-center gap-2">
          {savedSummary.hasDefault ? (
            <button
              type="button"
              onClick={() => void onRemoveSaved()}
              disabled={sending}
              className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
              title="Gespeicherte Karte entfernen"
            >
              {tTip("methods.actions.remove")}
            </button>
          ) : null}

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
          <div className="mt-1 text-[12px] text-white/55">{tTipRe("stripe.savedCardsHint")}</div>
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-white/55">{tTipRe("stripe.tipSaveCard")}</div>
      )}

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <PaymentElement
          options={{
            wallets: { applePay: 'never', googlePay: 'never' },
          }}
        />
      </div>

      <div className="mt-2 text-[12px] text-white/55">
        {savedSummary.hasDefault
          ? 'Du hast bereits eine gespeicherte Karte.'
          : 'Die Karte wird nach erfolgreicher Aktivierung automatisch gespeichert.'}
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
          <span className="inline-flex items-center gap-2">
            <SparkleIcon />
            {sending ? (t('actions.processing') ?? 'Verarbeite…') : (t('actions.payNow') ?? 'Jetzt zahlen')}
          </span>
        </button>
      </div>

      <div className="mt-2 text-[12px] text-white/55">{t('stripe.secureHint') ?? 'Die Zahlungsdaten werden sicher von Stripe verarbeitet.'}</div>
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
  const tTip = useTranslations("payment.tipModal");
  const mounted = useMounted();

  const [step, setStep] = React.useState<Step>('review');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [stripeClientSecret, setStripeClientSecret] = React.useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = React.useState<string | null>(null);
  const [paymentId, setPaymentId] = React.useState<string | null>(null);

  const [methodsOpen, setMethodsOpen] = React.useState(false);

  const [savedCount, setSavedCount] = React.useState(0);
  const [hasDefaultSaved, setHasDefaultSaved] = React.useState(false);

  const stepUpForRemove = useStepUp();
  const [stepUpRemoveOpen, setStepUpRemoveOpen] = React.useState(false);
  const pendingRemoveRef = React.useRef<(() => Promise<void>) | null>(null);


  const [closingSoon, setClosingSoon] = React.useState(false);
  const closeTimerRef = React.useRef<number | null>(null);
  const [note, setNote] = React.useState('');

  // Budget
  type BudgetStatus = {
    amountCents: number;
    cadence: string;
    action: 'BLOCK' | 'WARN' | 'NOTIFY';
    spentCents: number;
    percentUsed: number;
    isOver: boolean;
    remainingCents: number;
  };
  const [budget, setBudget] = React.useState<BudgetStatus | null>(null);
  const [budgetWarnAck, setBudgetWarnAck] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    fetch('/api/budget')
      .then(r => { if (!r.ok) return null; return r.json(); })
      .then(j => { setBudget(j?.budget ?? null); })
      .catch(() => { setBudget(null); });
  }, [open]);

  const { topupFeeCents: platformFeeCents, totalCents } = computeTipBreakdown(amountCents);
  const pctLabel = Math.round(TIP_TOPUP_RATE * 100);

  const budgetWouldBlock = budget?.action === 'BLOCK' && budget?.isOver;
  const budgetWouldWarn = budget?.action === 'WARN' && budget?.isOver && !budgetWarnAck;
  const canSend = !sending && !budgetWouldBlock && !budgetWouldWarn;

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
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;

    setError(null);
    setSending(false);
    setStep('review');
    setStripeClientSecret(null);
    setCustomerSessionClientSecret(null);
    setPaymentId(null);
    setClosingSoon(false);
    setNote('');
    setBudget(null);
    setBudgetWarnAck(false);

    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

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
        // ✅ API bereits angepasst: saveForFuture mitgeben
        body: JSON.stringify({ toUserId, amountCents, conversationId, note: note.trim() || undefined, saveForFuture: true }),
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

    setClosingSoon(true);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    closeTimerRef.current = window.setTimeout(() => {
      setClosingSoon(false);
      onClose();
    }, 1100);
  }

  async function removeDefaultSaved() {
    setSending(true);
    setError(null);
    try {
      const listRes = await fetch('/api/payments/methods/list', { method: 'GET' });
      const listJ: unknown = await listRes.json().catch(() => null);
      if (!listRes.ok || !isMethodsListOk(listJ)) throw new Error('Failed to load saved cards');
      const defaultId = listJ.defaultPaymentMethodId;
      if (!defaultId) throw new Error('No default card to remove');
      const res = await fetch('/api/payments/methods/update', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...stepUpForRemove.stepUpHeaders() },
        body: JSON.stringify({ action: 'detach', paymentMethodId: defaultId }),
      });
      const j: unknown = await res.json().catch(() => null);
      if (!res.ok) throw new Error(getUpdateError(j) || 'Failed to remove');
      await refreshSavedSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove');
    } finally {
      setSending(false);
    }
  }

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

  if (!open || !mounted) return null;

  return createPortal(
    <>
      <PaymentMethodsModal
        open={methodsOpen}
        onClose={() => setMethodsOpen(false)}
        onChanged={() => refreshSavedSummary()}
        title={tTip("methods.title")}
        subtitle={tTip("methods.subtitle")}
      />

      <div
        className="fixed inset-0 z-[2147483600] grid place-items-center bg-black/60 backdrop-blur-sm overscroll-contain p-3 sm:p-0"
        onClick={() => {
          if (step === 'success') return;
          onClose();
        }}
      >
        <div
          className={[
            'relative w-full sm:w-[min(640px,94vw)] max-w-[640px]',
            'max-h-[calc(100dvh-24px)] sm:max-h-[85vh]',
            'rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d] flex flex-col',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-5 py-4">
            <div
              className="absolute inset-0 -z-10"
              style={{ background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.35), rgba(139,92,246,0))' }}
            />
            <div className="flex items-center gap-3">
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

              <div className="min-w-0">
                <div className="font-semibold text-[16px] leading-tight truncate">{t('header.title')}</div>
                <div className="text-[12px] text-white/70 truncate">{t('header.to', { name: toDisplayName })}</div>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMethodsOpen(true)}
                  disabled={step === 'success'}
                  className={`px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] ${
                    step === 'success' ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''
                  }`}
                >
                  {t("actions.cards")}
                </button>

                <button
                  onClick={onClose}
                  disabled={step === 'success'}
                  className={`inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10 ${
                    step === 'success' ? 'opacity-50 cursor-not-allowed hover:bg-transparent' : ''
                  }`}
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
            <div
              className="pb-5 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch', overflowX: 'hidden' }}
            >
              {/* ── STEP: review ── */}
              {step === 'review' && (
                <div className="px-5">
                  <div className="text-[12px] text-white/75 mb-3">{t('disclaimer')}</div>

                  {/* Budget Progressbar */}
                  {budget && (
                    <div className="mb-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                      <div className="flex items-center justify-between text-[12px] mb-1.5">
                        <span className="text-white/70">
                          {budget.cadence === 'DAILY'
                            ? tTip('budget.daily')
                            : budget.cadence === 'WEEKLY'
                            ? tTip('budget.weekly')
                            : tTip('budget.monthly')}
                        </span>
                        <span className={budget.isOver ? 'text-red-400' : 'text-white/70'}>
                          {fmtCurrency(budget.spentCents)} / {fmtCurrency(budget.amountCents)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            budget.isOver ? 'bg-red-500' : budget.percentUsed > 75 ? 'bg-yellow-400' : 'bg-[var(--purple)]'
                          }`}
                          style={{ width: `${Math.min(budget.percentUsed, 100)}%` }}
                        />
                      </div>
                      {budget.action === 'BLOCK' && budget.isOver && (
                        <div className="mt-2 text-[12px] text-red-400 font-medium">
                          {tTip('budget.blocked')}
                        </div>
                      )}
                      {budget.action === 'WARN' && budget.isOver && (
                        <div className="mt-2">
                          <div className="text-[12px] text-yellow-300 mb-1.5">
                            {tTip('budget.warnOver')}
                          </div>
                          <label className="flex items-center gap-2 text-[12px]">
                            <input
                              type="checkbox"
                              className="accent-yellow-400"
                              checked={budgetWarnAck}
                              onChange={(e) => setBudgetWarnAck(e.target.checked)}
                            />
                            <span className="text-white/80">{tTip('budget.warnAck')}</span>
                          </label>
                        </div>
                      )}
                      {budget.action === 'NOTIFY' && budget.isOver && (
                        <div className="mt-2 text-[12px] text-orange-300">
                          {tTip('budget.notifyOver')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Kompakte Zusammenfassung */}
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="text-white/70">{t('breakdown.amount')}</span>
                      <span className="font-medium">{fmtCurrency(amountCents, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-white/60 mb-2">
                      <span>{t('breakdown.fee', { pct: pctLabel })}</span>
                      <span>{fmtCurrency(platformFeeCents, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-[14px] font-semibold">{t('breakdown.youPay')}</span>
                      <span className="text-[18px] font-bold text-[var(--purple)]">{fmtCurrency(totalCents, currency)}</span>
                    </div>
                  </div>

                  {error && (
                    <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
                  )}

                  <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10" disabled={sending}>
                      {t('actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToPay}
                      disabled={!canSend || !STRIPE_PK}
                      className={`relative px-4 py-2 rounded-lg text-white transition ${
                        canSend && STRIPE_PK ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <SparkleIcon />
                        {sending ? (t('actions.processing') ?? 'Verarbeite…') : t('actions.sendGiftAccept', { total: fmtCurrency(totalCents, currency) })}
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* ── STEP: pay ── */}
              {step === 'pay' && paymentId && stripeClientSecret && elementsOptions && (
                <div className="px-5">
                  {/* Kompakte Zusammenfassung */}
                  <div className="mb-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <div className="flex items-center justify-between text-[13px] mb-1">
                      <span className="text-white/70">{t('breakdown.amount')}</span>
                      <span className="font-medium">{fmtCurrency(amountCents, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-white/60 mb-2">
                      <span>{t('breakdown.fee', { pct: pctLabel })}</span>
                      <span>{fmtCurrency(platformFeeCents, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-[14px] font-semibold">{t('breakdown.youPay')}</span>
                      <span className="text-[18px] font-bold text-[var(--purple)]">{fmtCurrency(totalCents, currency)}</span>
                    </div>
                  </div>

                  {/* Optionale Note — nur im pay-Step */}
                  <div className="mb-3">
                    <label className="block text-[12px] text-white/60 mb-1">{tTip('note.label')}</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={200}
                      rows={2}
                      placeholder={tTip('note.placeholder')}
                      disabled={sending}
                      className="w-full rounded-xl bg-white/[.03] border border-white/10 px-3 py-2 outline-none text-white disabled:opacity-60 text-[13px] resize-none"
                    />
                  </div>

                  {error && (
                    <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
                  )}

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
                      savedSummary={{ count: savedCount, hasDefault: hasDefaultSaved }}
                      onRemoveSaved={async () => {
                        if (stepUpForRemove.isVerified) { await removeDefaultSaved(); return; }
                        pendingRemoveRef.current = removeDefaultSaved;
                        setStepUpRemoveOpen(true);
                      }}
                    />
                  </Elements>
                </div>
              )}
            </div>
          ) : (
            <div className="px-5 py-10 relative overflow-hidden grid place-items-center">
              <div
                className={`absolute inset-0 -z-10 transition-opacity duration-300 ${closingSoon ? 'opacity-100' : 'opacity-90'}`}
                style={{ background: 'radial-gradient(700px 260px at 50% 35%, rgba(139,92,246,.28), rgba(139,92,246,0))' }}
              />

              <div className="text-center">
                <CheckBurst closingSoon={closingSoon} />
                <h3 className="mt-4 text-[18px] font-semibold tracking-tight">{t('success.title') ?? 'Erfolgreich'}</h3>
                <p className="mt-1 text-white/80">{t('success.youPaid', { amount: fmtCurrency(totalCents, currency) }) ?? 'Zahlung abgeschlossen.'}</p>
                <div className="mt-3 text-[12px] text-white/55">{t("success.closing")}</div>
              </div>

              <style jsx>{`
                .checkRing {
                  width: 84px;
                  height: 84px;
                  border-radius: 999px;
                  border: 1px solid rgba(139, 92, 246, 0.35);
                  background: radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.22), rgba(255, 255, 255, 0));
                  box-shadow: 0 0 0 6px rgba(139, 92, 246, 0.1), 0 0 24px rgba(139, 92, 246, 0.25);
                  animation: ringPop 520ms cubic-bezier(0.2, 0.9, 0.2, 1) both;
                }
                .checkPlate {
                  position: absolute;
                  inset: 10px;
                  border-radius: 999px;
                  border: 1px solid rgba(255, 255, 255, 0.12);
                  background: rgba(0, 0, 0, 0.25);
                  display: grid;
                  place-items: center;
                  color: rgba(255, 255, 255, 0.92);
                  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.35);
                  backdrop-filter: blur(6px);
                }
                .checkPath {
                  stroke-dasharray: 40;
                  stroke-dashoffset: 40;
                  animation: drawCheck 520ms 120ms ease-out forwards;
                }
                @keyframes ringPop {
                  0% {
                    transform: scale(0.82);
                    opacity: 0;
                  }
                  55% {
                    transform: scale(1.03);
                    opacity: 1;
                  }
                  100% {
                    transform: scale(1);
                    opacity: 1;
                  }
                }
                @keyframes drawCheck {
                  to {
                    stroke-dashoffset: 0;
                  }
                }
                .spark {
                  position: absolute;
                  width: 6px;
                  height: 6px;
                  border-radius: 999px;
                  background: rgba(139, 92, 246, 0.9);
                  opacity: 0;
                  transform: scale(0.6);
                  filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.55));
                }
                .s1 {
                  top: 6px;
                  left: 10px;
                }
                .s2 {
                  right: 6px;
                  top: 22px;
                }
                .s3 {
                  bottom: 8px;
                  left: 22px;
                }
                .spark.go {
                  animation: spark 620ms 120ms ease-out both;
                }
                @keyframes spark {
                  0% {
                    opacity: 0;
                    transform: scale(0.6) translateY(0);
                  }
                  35% {
                    opacity: 1;
                  }
                  100% {
                    opacity: 0;
                    transform: scale(1.3) translateY(-10px);
                  }
                }
              `}</style>
            </div>
          )}
        </div>
      </div>

      <StepUpDialog
        open={stepUpRemoveOpen}
        onClose={() => setStepUpRemoveOpen(false)}
        onVerified={() => {
          setStepUpRemoveOpen(false);
          pendingRemoveRef.current?.().catch(() => {});
          pendingRemoveRef.current = null;
        }}
        actionLabel="Karte entfernen"
        verify={stepUpForRemove.verify}
      />
  </>,
  document.body
  );
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

function CheckBurst({ closingSoon }: { closingSoon: boolean }) {
  return (
    <div className="relative inline-grid place-items-center">
      <div className="checkRing" />
      <div className="checkPlate">
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
          <path
            d="M20 6 9 17l-5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="checkPath"
          />
        </svg>
      </div>

      <span className={`spark s1 ${closingSoon ? 'go' : ''}`} />
      <span className={`spark s2 ${closingSoon ? 'go' : ''}`} />
      <span className={`spark s3 ${closingSoon ? 'go' : ''}`} />
    </div>
  );
}