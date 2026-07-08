// src/components/TipModal.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { createPortal } from 'react-dom';
import { computeTipBreakdown } from '@/lib/fees';


import { loadStripe } from '@stripe/stripe-js';
import type { Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import { useStepUp } from "@/hooks/useStepUp";
import { StepUpDialog } from "@/components/StepUpDialog";

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
  customerSessionClientSecret?: string;
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
  const [peKey, setPeKey] = React.useState(0);
  const [methods, setMethods] = React.useState<SavedMethod[]>([]);
  const [defaultId, setDefaultId] = React.useState<string | null>(null);

  const stepUp = useStepUp();
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [stepUpLabel, setStepUpLabel] = React.useState("");
  const pendingActionRef = React.useRef<(() => void) | null>(null);

  const loadMethods = React.useCallback(async () => {
    const res = await fetch('/api/payments/methods/list', { method: 'GET' });
    const j: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(getUpdateError(j) ?? t('methods.errors.loadFailed'));
    if (!isMethodsListOk(j)) throw new Error(t('methods.errors.invalidResponse'));
    setMethods(j.methods);
    setDefaultId(j.defaultPaymentMethodId);
  }, [t]);

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

  function withStepUp(label: string, action: () => void) {
    if (stepUp.isVerified) { action(); return; }
    setStepUpLabel(label);
    pendingActionRef.current = action;
    setStepUpOpen(true);
  }

  function startSetupIntent() {
    withStepUp(t('methods.actions.addCard'), () => void doStartSetupIntent());
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
      if (!res.ok) throw new Error(getSetupIntentError(j) || t('methods.errors.startSetupFailed'));
      if (!isSetupIntentOk(j)) throw new Error(t('methods.errors.invalidResponse'));
      setClientSecret(j.clientSecret);
      setPeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start setup');
    } finally {
      setLoading(false);
    }
  }

  function setDefault(paymentMethodId: string) {
    withStepUp(t('methods.actions.setDefault'), () => void doSetDefault(paymentMethodId));
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

  function detach(paymentMethodId: string) {
    withStepUp(t('methods.actions.remove'), () => void doDetach(paymentMethodId));
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

  return (
    <>
      {createPortal(
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
              <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.30), rgba(139,92,246,0))' }} />
              <div className="flex items-center gap-2">
                <div className="font-semibold text-[16px]">{t('methods.title')}</div>
                <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={onClose} className="inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10" aria-label="Close">
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </div>
              </div>
              <div className="mt-1 text-[12px] text-white/65">{t('methods.subtitle')}</div>
            </div>

            <div className="px-5 py-5 overflow-y-auto overscroll-contain [ -webkit-overflow-scrolling:touch ]">
              {error && <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>}

              <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[13px] text-white/80">{t('methods.savedCards')}</div>
                  <button type="button" onClick={startSetupIntent} disabled={loading || !STRIPE_PK} className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60">
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
                        <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-[13px] text-white/85 truncate">{m.brand.toUpperCase()} •••• {m.last4}</div>
                            <div className="text-[12px] text-white/55">
                              Exp {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                              {isDef ? <span className="ml-2 text-[11px] text-[var(--purple)]">{t('methods.default')}</span> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {!isDef && (
                              <button type="button" onClick={() => setDefault(m.id)} disabled={loading} className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60">
                                {t('methods.actions.setDefault')}
                              </button>
                            )}
                            <button type="button" onClick={() => detach(m.id)} disabled={loading} className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60">
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
                  <div className="text-[13px] text-white/80">{t('stripe.newCardTitle')}</div>
                  <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <SetupIntentForm
                        t={t}
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
                  <div className="mt-2 text-[12px] text-white/55">{t('methods.securityNote')}</div>
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
  t,
  peKey,
  stepUpHeaders,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
  t: ReturnType<typeof useTranslations>;
  peKey: number;
  stepUpHeaders: () => Record<string, string>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = React.useState(false);
  const [billName, setBillName] = React.useState('');
  const [billEmail, setBillEmail] = React.useState('');
  const [billPhone, setBillPhone] = React.useState('');

  async function handleSave() {
    try {
      setSaving(true);
      onError('');
      if (!stripe || !elements) throw new Error(t('stripe.errors.notReady'));
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
      if (error) throw new Error(error.message || t('methods.errors.saveFailed'));
      if (setupIntent?.status !== 'succeeded' && setupIntent?.status !== 'processing') {
        throw new Error(t('methods.errors.setupNotCompleted'));
      }
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
      onError(e instanceof Error ? e.message : t('methods.errors.saveFailed'));
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
  // Recovery-State: 'idle' normal, 'timeout' = Zahlung läuft noch (nicht Fehler!)
  const [payState, setPayState] = React.useState<'idle' | 'timeout'>('idle');

  async function finalizeWithPoll() {
    // Ziel: 8–12s Gesamt-Wartezeit, mit kurzem "fast retry" am Anfang.
    const startedAt = Date.now();
    const timeoutMs = 12_000;

    // Gute Praxis: erst schnell, dann "steady" (Webhook braucht oft 1–6s).
    const delays = [0, 350, 650, 1000, 1400, 1800, 2200, 2600, 3000]; // ~13s inkl. network

    let lastMsg: string | null = null;
    let lastStatus: string | null = null;

    for (const d of delays) {
      if (Date.now() - startedAt > timeoutMs) break;
      if (d) await sleep(d);

      const res = await fetch('/api/payments/tips/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      const j = await res.json().catch(() => null);

      // ✅ DONE
      if (res.ok && isConfirmOk(j)) {
        onPaid({
          paymentId,
          totalCents: j.totalCents,
          currency: j.currency || CURRENCY,
          baseAmountCents: j.baseAmountCents,
        });
        return;
      }

      // Hard failures (server uses 400/401/404 already)
      const err = getConfirmError(j);
      if (res.status === 400 || res.status === 401 || res.status === 404) {
        throw new Error(err || t('errors.confirmFailed'));
      }

      // ✅ Soft states: keep polling (THIS is your PROCESSING path)
      lastStatus = typeof j?.status === 'string' ? j.status : null;
      lastMsg = err || j?.error || null;

      // Optional: if Stripe says PI canceled/failed (server should already send 400, but just in case)
      if (lastStatus === 'canceled' || lastStatus === 'requires_payment_method') {
        throw new Error(lastMsg || t('errors.confirmFailed'));
      }

      // Otherwise continue polling
    }

    // Timeout: KEIN Fehler werfen. Unterscheide "läuft noch" von "echter Fehler".
    if (lastStatus === 'PROCESSING') {
      // Zahlung ist unterwegs – beruhigenden Recovery-Zustand setzen statt Fehler.
      setPayState('timeout');
      return;
    }
    // Nur wenn es KEIN PROCESSING war, ist es ein echter Fehler.
    throw new Error(lastMsg || t('errors.confirmFailed'));
  }

  async function handleConfirmPayment() {
    try {
      setSending(true);
      setError(null);
      setPayState('idle');

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

  async function recheckStatus() {
    try {
      setSending(true);
      setError(null);
      setPayState('idle');
      // Nur das Polling erneut laufen lassen – KEIN neuer confirmPayment,
      // also keine Möglichkeit einer Doppelbelastung.
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
          {savedSummary.hasDefault ? (
            <button
              type="button"
              onClick={() => void onRemoveSaved()}
              disabled={sending}
              className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
              title={t('stripe.savedCardNote')}
              >
                {t('methods.actions.remove')}
              </button>
          ) : null}

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
        <PaymentElement
          options={{
            wallets: {
              applePay: 'never',
              googlePay: 'never',
            },
          }}
        />
      </div>
      <div className="mt-2 text-[12px] text-white/55">
        {savedSummary.hasDefault
          ? t('stripe.savedCardNote')
          : t('stripe.newCardNote')}
      </div>

      {payState === 'timeout' && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/[.07] p-4 space-y-3">
          <div className="text-[14px] font-medium text-amber-100">
            {t('recovery.stillProcessing')}
          </div>
          <div className="text-[12px] text-white/70">
            {t('recovery.noDoubleCharge')}
          </div>
          <button
            type="button"
            onClick={() => void recheckStatus()}
            disabled={sending}
            className="px-4 h-9 rounded-full bg-[var(--purple)] text-white text-[13px] disabled:opacity-60"
          >
            {sending ? t('recovery.checking') : t('recovery.recheck')}
          </button>
        </div>
      )}

      {payState !== 'timeout' && (
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
      )}

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
  const t = useTranslations('payment.tipModal');
  const locale = useLocale();

  const [amount, setAmount] = React.useState('50');
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [step, setStep] = React.useState<Step>('form');

  const [stripeClientSecret, setStripeClientSecret] = React.useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = React.useState<string | null>(null); // NEU
  const [paymentId, setPaymentId] = React.useState<string | null>(null);

  const [success, setSuccess] = React.useState<null | { paymentId: string; totalCents: number; currency: string }>(null);
  const [closingSoon, setClosingSoon] = React.useState(false);
  const closeTimerRef = React.useRef<number | null>(null);
  

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  const [methodsOpen, setMethodsOpen] = React.useState(false);

  const [savedCount, setSavedCount] = React.useState(0);
  const [hasDefaultSaved, setHasDefaultSaved] = React.useState(false);
  const stepUpForRemove = useStepUp();
  const [stepUpRemoveOpen, setStepUpRemoveOpen] = React.useState(false);
  const pendingRemoveRef = React.useRef<(() => Promise<void>) | null>(null);

  async function doRemoveSaved() {
    setSending(true);
    setError(null);
    try {
      const listRes = await fetch('/api/payments/methods/list', { method: 'GET' });
      const listJ: unknown = await listRes.json().catch(() => null);
      if (!listRes.ok || !isMethodsListOk(listJ)) throw new Error("Failed to load saved cards");
      const defaultId = listJ.defaultPaymentMethodId;
      if (!defaultId) throw new Error("No default card to remove");
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

  const [giftAck, setGiftAck] = React.useState<boolean>(false);

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
    fetch('/api/budget').then(r => r.json()).then(j => {
      setBudget(j?.budget ?? null);
    }).catch(() => {});
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    setClosingSoon(false);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setSuccess(null);
    setError(null);
    setSending(false);
    setStep('form');
    setStripeClientSecret(null);
    setCustomerSessionClientSecret(null);
    setPaymentId(null);

    refreshSavedSummary();

    setGiftAck(false);
  }, [open]);

  const amountCents = parseCents(amount) ?? 0;
  const { topupFeeCents, totalCents } = computeTipBreakdown(amountCents);

  const amountValid = amountCents >= MIN_CENTS && amountCents <= MAX_CENTS;
  const budgetWouldBlock = budget?.action === 'BLOCK' && budget?.isOver;
  const budgetWouldWarn = budget?.action === 'WARN' && budget?.isOver && !budgetWarnAck;
  const canSend = amountValid && !sending && giftAck && !budgetWouldBlock && !budgetWouldWarn;

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
      setCustomerSessionClientSecret(j.customerSessionClientSecret ?? null);
      setStep('pay');

      refreshSavedSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic'));
    } finally {
      setSending(false);
    }
  }

  async function handlePaidFinal(r: { paymentId: string; totalCents: number; currency: string; baseAmountCents: number }) {
    setSuccess({ paymentId: r.paymentId, totalCents: r.totalCents, currency: r.currency });
    setStep('success');

    // Event sofort feuern (damit Chat/UI gleich updatet)
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    onSuccess?.({
      paymentId: r.paymentId,
      amountCents: r.baseAmountCents,
      totalCents: r.totalCents,
      currency: r.currency,
      note: note.trim() || undefined,
    });

    // Schöne "done" Animation und dann automatisch schließen
    setClosingSoon(true);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    closeTimerRef.current = window.setTimeout(() => {
      setClosingSoon(false);
      setSuccess(null);
      onClose();
    }, 1100); // 0.9–1.3s fühlt sich sehr "OnlyFans" an
  }

  const mounted = useMounted();
  if (!open || !mounted) return null;

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
          if (step === 'success') return;
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
                    disabled={step === 'success'}
                    onClick={() => {
                      if (step === 'success') return;
                      setSuccess(null);
                      onClose();
                    }}
                    className={`ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10 shrink-0 ${
                      step === 'success' ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''
                    }`}
                    aria-label={t('aria.close')}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          {step !== 'success' ? (
            <div
              className="pb-5 overflow-y-auto overscroll-contain"
              style={{ WebkitOverflowScrolling: 'touch', overflowX: 'hidden' }}
            >
              {/* ── STEP: form ── */}
              {step === 'form' && (
                <div className="px-5">
                  <div className="mb-3 text-[12px] text-white/75">{t('disclaimer.top')}</div>

                  {/* Budget Progressbar */}
                  {budget && (
                    <div className="mb-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                      <div className="flex items-center justify-between text-[12px] mb-1.5">
                        <span className="text-white/70">
                          {budget.cadence === 'DAILY'
                            ? t('budget.daily')
                            : budget.cadence === 'WEEKLY'
                            ? t('budget.weekly')
                            : t('budget.monthly')}
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
                          {t('budget.blocked')}
                        </div>
                      )}
                      {budget.action === 'WARN' && budget.isOver && (
                        <div className="mt-2">
                          <div className="text-[12px] text-yellow-300 mb-1.5">
                            {t('budget.warnOver')}
                          </div>
                          <label className="flex items-center gap-2 text-[12px]">
                            <input
                              type="checkbox"
                              className="accent-yellow-400"
                              checked={budgetWarnAck}
                              onChange={(e) => setBudgetWarnAck(e.target.checked)}
                            />
                            <span className="text-white/80">Ja, ich möchte trotzdem zahlen</span>
                          </label>
                        </div>
                      )}
                      {budget.action === 'NOTIFY' && budget.isOver && (
                        <div className="mt-2 text-[12px] text-orange-300">
                          {t('budget.notifyOver')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Betrag */}
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <label className="block text-[12px] text-white/70 mb-1">{t('amount.label')}</label>
                    <div className="flex items-center gap-2">
                      <div className="shrink-0 px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80">€</div>
                      <input
                        inputMode="decimal"
                        placeholder={t('amount.placeholder')}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={sending}
                        className="flex-1 bg-transparent outline-none text-[28px] leading-none font-semibold tracking-wide placeholder:text-white/30 disabled:opacity-60"
                      />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[5, 10, 25, 50].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAmount(String(p))}
                          disabled={sending}
                          className="px-3 py-1.5 rounded-full text-[13px] border border-white/15 hover:bg-white/10 disabled:opacity-60"
                        >
                          {fmtCurrency(p * 100)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live-Aufschlüsselung – zeigt Gebühr & Gesamtbetrag schon beim Tippen */}
                  {amountValid && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                      <div className="flex items-center justify-between text-[13px] mb-1">
                        <span className="text-white/70">{t('breakdown.amountToCreator')}</span>
                        <span className="font-medium tabular-nums">{fmtCurrency(amountCents)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px] text-white/60 mb-2">
                        <span>{t('breakdown.platformFeeTop')}</span>
                        <span className="tabular-nums">{fmtCurrency(topupFeeCents)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-white/10 pt-2">
                        <span className="text-[14px] font-semibold">{t('breakdown.youPay')}</span>
                        <span className="text-[18px] font-bold text-[var(--purple)] tabular-nums">
                          {fmtCurrency(totalCents)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Ack */}
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <label className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--purple)]"
                        checked={giftAck}
                        onChange={(e) => setGiftAck(e.target.checked)}
                      />
                      <span className="text-[13px] font-medium leading-snug text-white/90">
                        {t.rich('ack.checkboxShort', {
                          terms: (chunks) => (
                            <Link
                              href={`/${locale}/legal`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--purple)] underline underline-offset-2 hover:opacity-90"
                            >
                              {chunks}
                            </Link>
                          ),
                        })}
                      </span>
                    </label>
                    <p className="mt-2 pl-7 text-[11px] leading-relaxed text-white/50">
                      {t('ack.helper')}
                    </p>
                  </div>

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
                      {t('actions.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleStartStripePayment}
                      disabled={!canSend || !STRIPE_PK}
                      className={`relative px-4 py-2 rounded-lg text-white transition ${
                        canSend && STRIPE_PK ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <SparkleIcon />
                        {sending ? t('actions.sending') : (t('actions.continueToPay') ?? t('actions.sendGift'))}
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
                      <span className="text-white/70">{t('breakdown.amountToCreator')}</span>
                      <span className="font-medium">{fmtCurrency(amountCents)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[12px] text-white/60 mb-2">
                      <span>{t('breakdown.platformFeeTop')}</span>
                      <span>{fmtCurrency(topupFeeCents)}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <span className="text-[14px] font-semibold">{t('breakdown.youPay')}</span>
                      <span className="text-[18px] font-bold text-[var(--purple)]">{fmtCurrency(totalCents)}</span>
                    </div>
                  </div>

                  {/* Optionale Note */}
                  <div className="mb-3">
                    <label className="block text-[12px] text-white/60 mb-1">{t('note.label')}</label>
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      maxLength={200}
                      rows={2}
                      placeholder={t('note.placeholder')}
                      disabled={sending}
                      className="w-full rounded-xl bg-white/[.03] border border-white/10 px-3 py-2 outline-none text-white disabled:opacity-60 text-[13px] resize-none"
                    />
                  </div>

                  {error && (
                    <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                      {error}
                    </div>
                  )}

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
                        setCustomerSessionClientSecret(null);
                        setPaymentId(null);
                      }}
                      onPaid={(r) => handlePaidFinal(r)}
                      savedSummary={{ count: savedCount, hasDefault: hasDefaultSaved }}
                      onRemoveSaved={async () => {
                        if (stepUpForRemove.isVerified) { await doRemoveSaved(); return; }
                        pendingRemoveRef.current = doRemoveSaved;
                        setStepUpRemoveOpen(true);
                      }}
                    />
                  </Elements>
                </div>
              )}
            </div>
          ) : (
            /* success screen bleibt gleich */
            <div className="px-5 py-10 relative overflow-hidden grid place-items-center">
              <div
                className={`absolute inset-0 -z-10 transition-opacity duration-300 ${closingSoon ? "opacity-100" : "opacity-90"}`}
                style={{ background: "radial-gradient(700px 260px at 50% 35%, rgba(139,92,246,.28), rgba(139,92,246,0))" }}
              />
              <div className="text-center">
                <CheckBurst closingSoon={closingSoon} />
                <h3 className="mt-4 text-[18px] font-semibold tracking-tight">{t('success.title')}</h3>
                <p className="mt-1 text-white/80">{t('success.youPaid', { amount: fmtCurrency(success?.totalCents ?? 0) })}</p>
                <div className="mt-3 text-[12px] text-white/55">{t('success.closing')}</div>
                <div className="mt-1 text-[11px] text-white/40">{t('success.historyHint')}</div>
              </div>
            </div>
          )}

          <style jsx>{`
            @keyframes floatUp {
              0% { transform: translateY(10px) scale(0.9); opacity: 0; }
              20% { opacity: 1; }
              100% { transform: translateY(-120px) scale(1.1); opacity: 0; }
            }

            .checkRing {
              width: 84px;
              height: 84px;
              border-radius: 999px;
              border: 1px solid rgba(139,92,246,.35);
              background: radial-gradient(circle at 30% 30%, rgba(139,92,246,.22), rgba(255,255,255,0));
              box-shadow:
                0 0 0 6px rgba(139,92,246,.10),
                0 0 24px rgba(139,92,246,.25);
              animation: ringPop 520ms cubic-bezier(.2, .9, .2, 1) both;
            }

            .checkPlate {
              position: absolute;
              inset: 10px;
              border-radius: 999px;
              border: 1px solid rgba(255,255,255,.12);
              background: rgba(0,0,0,.25);
              display: grid;
              place-items: center;
              color: rgba(255,255,255,.92);
              box-shadow: inset 0 0 0 1px rgba(0,0,0,.35);
              backdrop-filter: blur(6px);
            }

            .checkPath {
              stroke-dasharray: 40;
              stroke-dashoffset: 40;
              animation: drawCheck 520ms 120ms ease-out forwards;
            }

            @keyframes ringPop {
              0% { transform: scale(.82); opacity: 0; }
              55% { transform: scale(1.03); opacity: 1; }
              100% { transform: scale(1); opacity: 1; }
            }

            @keyframes drawCheck {
              to { stroke-dashoffset: 0; }
            }

            .spark {
              position: absolute;
              width: 6px;
              height: 6px;
              border-radius: 999px;
              background: rgba(139,92,246,.9);
              opacity: 0;
              transform: scale(.6);
              filter: drop-shadow(0 0 10px rgba(139,92,246,.55));
            }

            .s1 { top: 6px; left: 10px; }
            .s2 { right: 6px; top: 22px; }
            .s3 { bottom: 8px; left: 22px; }

            .spark.go {
              animation: spark 620ms 120ms ease-out both;
            }

            @keyframes spark {
              0% { opacity: 0; transform: scale(.6) translateY(0); }
              35% { opacity: 1; }
              100% { opacity: 0; transform: scale(1.3) translateY(-10px); }
            }
          `}</style>
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
        actionLabel={t('methods.actions.removeCard')}
        verify={stepUpForRemove.verify}
      />
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

function CheckBurst({ closingSoon }: { closingSoon: boolean }) {
  return (
    <div className="relative inline-grid place-items-center">
      {/* Outer ring */}
      <div className="checkRing" />

      {/* Inner plate */}
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

      {/* tiny sparkles */}
      <span className={`spark s1 ${closingSoon ? "go" : ""}`} />
      <span className={`spark s2 ${closingSoon ? "go" : ""}`} />
      <span className={`spark s3 ${closingSoon ? "go" : ""}`} />
    </div>
  );
}

