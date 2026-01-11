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
  conversationId?: string;  // optional

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

/** ---------- API Shapes ---------- */

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

/** ---------- Payment methods (wie TipModal) ---------- */

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

function SetupIntentForm({
  onDone,
  onError,
  tMethods,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
  tMethods: ReturnType<typeof useTranslations>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = React.useState(false);

  async function handleSave() {
    try {
      setSaving(true);
      onError('');

      if (!stripe || !elements) throw new Error(tMethods('stripe.errors.notReady', { default: 'Stripe not ready' }));

      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || tMethods('methods.errors.saveFailed', { default: 'Save failed' }));
      if (setupIntent?.status !== 'succeeded' && setupIntent?.status !== 'processing') {
        throw new Error(tMethods('methods.errors.setupNotCompleted', { default: 'Setup not completed' }));
      }

      await sleep(300);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : tMethods('methods.errors.saveFailed', { default: 'Save failed' }));
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
          className={`relative px-4 py-2 rounded-lg text-white transition w-full sm:w-auto ${
            !saving && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          {saving ? tMethods('methods.actions.saving', { default: 'Speichere…' }) : tMethods('methods.actions.saveCard', { default: 'Karte speichern' })}
        </button>
      </div>
    </div>
  );
}

function PaymentMethodsModal({
  open,
  onClose,
  onChanged,
  tMethods,
}: {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  tMethods: ReturnType<typeof useTranslations>;
}) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [clientSecret, setClientSecret] = React.useState<string | null>(null);

  const [methods, setMethods] = React.useState<SavedMethod[]>([]);
  const [defaultId, setDefaultId] = React.useState<string | null>(null);

  const mounted = useMounted();

  const loadMethods = React.useCallback(async () => {
    const res = await fetch('/api/payments/methods/list', { method: 'GET' });
    const j: unknown = await res.json().catch(() => null);

    if (!res.ok) throw new Error(getUpdateError(j) ?? tMethods('methods.errors.loadFailed', { default: 'Laden fehlgeschlagen' }));
    if (!isMethodsListOk(j)) throw new Error(tMethods('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));

    setMethods(j.methods);
    setDefaultId(j.defaultPaymentMethodId);
  }, [tMethods]);

  React.useEffect(() => {
    if (!open) return;

    setError(null);
    setClientSecret(null);
    setMethods([]);
    setDefaultId(null);

    setLoading(true);
    loadMethods()
      .catch((e) => setError(e instanceof Error ? e.message : tMethods('methods.errors.loadFailed', { default: 'Laden fehlgeschlagen' })))
      .finally(() => setLoading(false));
  }, [open, loadMethods, tMethods]);

  async function startSetupIntent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/setup-intent', { method: 'POST' });
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok) throw new Error(getSetupIntentError(j) || tMethods('methods.errors.startSetupFailed', { default: 'Setup fehlgeschlagen' }));
      if (!isSetupIntentOk(j)) throw new Error(tMethods('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));

      setClientSecret(j.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : tMethods('methods.errors.startSetupFailed', { default: 'Setup fehlgeschlagen' }));
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

      if (!res.ok) throw new Error(getUpdateError(j) || tMethods('methods.errors.setDefaultFailed', { default: 'Standard setzen fehlgeschlagen' }));
      if (!isUpdateOk(j)) throw new Error(tMethods('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));

      await loadMethods();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : tMethods('methods.errors.setDefaultFailed', { default: 'Standard setzen fehlgeschlagen' }));
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

      if (!res.ok) throw new Error(getUpdateError(j) || tMethods('methods.errors.removeFailed', { default: 'Entfernen fehlgeschlagen' }));
      if (!isUpdateOk(j)) throw new Error(tMethods('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));

      await loadMethods();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : tMethods('methods.errors.removeFailed', { default: 'Entfernen fehlgeschlagen' }));
    } finally {
      setLoading(false);
    }
  }

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
          'relative w-full sm:w-[min(720px,94vw)] max-w-[720px]',
          'max-h-[calc(100dvh-24px)] sm:max-h-[85vh]',
          'rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d] flex flex-col',
        ].join(' ')}
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
            <div className="font-semibold text-[16px]">{tMethods('methods.title', { default: 'Zahlungsmethoden' })}</div>
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
          <div className="mt-1 text-[12px] text-white/65">{tMethods('methods.subtitle', { default: 'Karten verwalten und Standard setzen.' })}</div>
        </div>

        <div className="px-5 py-5 overflow-y-auto overscroll-contain [ -webkit-overflow-scrolling:touch ]">
          {error && (
            <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-[13px] text-white/80">{tMethods('methods.savedCards', { default: 'Gespeicherte Karten' })}</div>
              <button
                type="button"
                onClick={startSetupIntent}
                disabled={loading || !STRIPE_PK}
                className="px-3 py-2 sm:py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60 w-full sm:w-auto"
                title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
              >
                {tMethods('methods.actions.addCard', { default: 'Karte hinzufügen' })}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading && methods.length === 0 ? (
                <div className="text-[13px] text-white/60">{tMethods('methods.loading', { default: 'Lade…' })}</div>
              ) : methods.length === 0 ? (
                <div className="text-[13px] text-white/60">{tMethods('methods.empty', { default: 'Keine Karten gespeichert.' })}</div>
              ) : (
                methods.map((m) => {
                  const isDef = defaultId === m.id;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-lg border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="text-[13px] text-white/85 truncate">
                          {m.brand.toUpperCase()} •••• {m.last4}
                        </div>
                        <div className="text-[12px] text-white/55">
                          Exp {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                          {isDef ? (
                            <span className="ml-2 text-[11px] text-[var(--purple)]">
                              {tMethods('methods.default', { default: 'Standard' })}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 justify-end">
                        {!isDef && (
                          <button
                            type="button"
                            onClick={() => setDefault(m.id)}
                            disabled={loading}
                            className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60"
                          >
                            {tMethods('methods.actions.setDefault', { default: 'Als Standard' })}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => detach(m.id)}
                          disabled={loading}
                          className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60"
                        >
                          {tMethods('methods.actions.remove', { default: 'Entfernen' })}
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
              <div className="text-[13px] text-white/80">{tMethods('methods.addNewTitle', { default: 'Neue Karte speichern' })}</div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <SetupIntentForm
                    tMethods={tMethods}
                    onDone={async () => {
                      setClientSecret(null);
                      await loadMethods();
                      onChanged();
                    }}
                    onError={(msg) => setError(msg)}
                  />
                </Elements>
              </div>
              <div className="mt-2 text-[12px] text-white/55">{tMethods('methods.securityNote', { default: 'Deine Zahlungsdaten werden sicher von Stripe verarbeitet.' })}</div>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  );
}

/** ---------- Stripe pay step (AutoDrain) + Saved methods summary + Manage button ---------- */

function StripeSubscribeStep({
  t,
  tMethods,
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
  tMethods: ReturnType<typeof useTranslations>;
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

    // 1) PaymentIntent bestätigen (PaymentElement zeigt gespeicherte Methoden oder neue Karte)
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
      redirect: 'if_required',
    });

    if (error) throw new Error(error.message || t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
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
        throw new Error(getErr(j) || t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
      }
    }

    throw new Error(last || t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
  }

  async function handleEnable() {
    try {
      setSending(true);
      setError(null);
      await confirmAndFinalize();
      onActivated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
      {/* Header row (stack on mobile) */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-[13px] text-white/80">{t('stripe.enterCard', { default: 'Zahlungsmethode wählen' })}</div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="button"
            onClick={onOpenMethods}
            disabled={sending}
            className="px-3 py-2 sm:py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60 w-full sm:w-auto"
            title={tMethods('methods.actions.manageTitle', { default: 'Zahlungsmethoden verwalten' })}
          >
            {tMethods('methods.actions.manage', { default: 'Zahlungsmethoden' })}
          </button>

          <button
            type="button"
            onClick={onBack}
            disabled={sending}
            className="px-3 py-2 sm:py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60 w-full sm:w-auto"
          >
            {t('actions.back', { default: 'Zurück' })}
          </button>
        </div>
      </div>

      {/* Saved summary */}
      {savedSummary.count > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[12px] text-white/70">
            {tMethods('stripe.savedCardsSummary', { count: savedSummary.count, default: `${savedSummary.count} gespeicherte Karte(n)` })}
            {savedSummary.hasDefault ? (
              <span className="ml-2 text-[var(--purple)]">{tMethods('stripe.defaultSet', { default: 'Standard gesetzt' })}</span>
            ) : null}
          </div>
          <div className="mt-1 text-[12px] text-white/55">{tMethods('stripe.savedCardsHint', { default: 'Du kannst eine Standardkarte festlegen.' })}</div>
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-white/55">{tMethods('stripe.tipSaveCard', { default: 'Du kannst deine Karte speichern, um schneller zu zahlen.' })}</div>
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
          {sending ? t('actions.enabling', { default: 'Aktiviere…' }) : t('actions.enable', { default: 'AutoDrain aktivieren' })}
        </button>
      </div>

      <div className="mt-2 text-[12px] text-white/55">{t('stripe.secureHint', { default: 'Deine Zahlungsdaten werden sicher von Stripe verarbeitet.' })}</div>
    </div>
  );
}

/** ---------- Main modal ---------- */

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
  // Für AutoDrain-Texte
  const t = useTranslations('payment.autoDrainAcceptModal');
  // Für Payment-Methods-Texte (bereits in TipModal vorhanden)
  const tMethods = useTranslations('payments.tipModal');

  const mounted = useMounted();

  const [amount, setAmount] = React.useState('50');
  const [cadence, setCadence] = React.useState<AutoDrainCadence>('MONTHLY');

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [giftAck, setGiftAck] = React.useState<boolean>(true);

  const [step, setStep] = React.useState<'form' | 'pay'>('form');
  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = React.useState<string | null>(null);
  const [autoDrainId, setAutoDrainId] = React.useState<string | null>(null);

  // Payment methods integration (wie TipModal)
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

    // Reset on open
    setAmount('50');
    setCadence('MONTHLY');
    setSending(false);
    setError(null);

    setStep('form');
    setClientSecret(null);
    setCustomerSessionClientSecret(null);
    setAutoDrainId(null);

    refreshSavedSummary();

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
    cadence === 'DAILY'
      ? (t('cadence.daily', { default: 'Daily' }) as unknown as string)
      : cadence === 'WEEKLY'
      ? (t('cadence.weekly', { default: 'Weekly' }) as unknown as string)
      : (t('cadence.monthly', { default: 'Monthly' }) as unknown as string);

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
        throw new Error(getErr(j) || t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
      }

      setAutoDrainId(j.autoDrainId);
      setClientSecret(j.clientSecret);
      setCustomerSessionClientSecret(j.customerSessionClientSecret ?? null);
      setStep('pay');

      // sofort Summary aktualisieren, falls Stripe schon etwas erzeugt hat / default vorhanden
      refreshSavedSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
    } finally {
      setSending(false);
    }
  }

  if (!open || !mounted) return null;

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

  const ui = (
    <>
      <PaymentMethodsModal
        open={methodsOpen}
        onClose={() => setMethodsOpen(false)}
        onChanged={() => {
          refreshSavedSummary();
        }}
        tMethods={tMethods}
      />

      <div
        className="fixed inset-0 z-[2147483600] grid place-items-center bg-black/60 backdrop-blur-sm overscroll-contain p-3 sm:p-0"
        onClick={() => onClose()}
      >
        <div
          className={[
            'relative w-full sm:w-[min(680px,94vw)] max-w-[680px]',
            'max-h-[calc(100dvh-24px)] sm:max-h-[85vh]',
            'rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d] flex flex-col',
          ].join(' ')}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-4 py-3 sm:px-5 sm:py-4">
            <div
              className="absolute inset-0 -z-10"
              style={{ background: 'radial-gradient(1200px 220px at 50% 0%, rgba(139,92,246,.35), rgba(139,92,246,0))' }}
            />

            {/* Row 1: Avatar + Title + Close */}
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
                  <div className="min-w-0">
                    <div className="font-semibold text-[15px] sm:text-[16px] leading-snug break-words line-clamp-2">
                      {t('header.title', { default: 'AutoDrain aktivieren' })}
                    </div>
                    <div className="mt-1 text-[12px] text-white/70 break-words line-clamp-2">
                      {t('header.to', { name: toDisplayName, default: `to ${toDisplayName}` })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10 shrink-0"
                    aria-label={t('actions.closeAria', { default: 'Close' })}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Row 2: Payment methods button (mobile stacked) */}
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => setMethodsOpen(true)}
                className="w-full sm:w-auto px-3 py-2 sm:py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px]"
                title={tMethods('methods.actions.manageTitle', { default: 'Zahlungsmethoden verwalten' })}
              >
                {tMethods('methods.actions.manage', { default: 'Zahlungsmethoden' })}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-5 pb-5 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
            {step === 'form' ? (
              <>
                <div className="text-[12px] text-white/75 mb-3">
                  {t('disclaimer', { default: 'Gifts are voluntary and final.' })}
                </div>

                {/* Amount */}
                <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                  <label className="block text-[12px] text-white/70 mb-1">
                    {t('charge.label', { default: 'Amount per charge' })}
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
                      className="flex-1 bg-transparent outline-none text-[28px] leading-none font-semibold tracking-wide placeholder:text-white/30 disabled:opacity-60 min-w-0"
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
                    {t('charge.recurringNote', { default: 'Recurrence' })}
                  </label>

                  {/* Mobile: 1 column if tight, sm+: 3 columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                          {c === 'DAILY'
                            ? t('cadence.daily', { default: 'Daily' })
                            : c === 'WEEKLY'
                            ? t('cadence.weekly', { default: 'Weekly' })
                            : t('cadence.monthly', { default: 'Monthly' })}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Preview */}
                <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                  <div className="text-[13px] text-white/70 mb-1">Preview</div>
                  <div className="text-[24px] font-semibold break-words">
                    {fmtCurrency(amountCents, currency)}{' '}
                    <span className="text-[13px] font-normal text-white/70">({cadenceLabel})</span>
                  </div>

                  <div className="mt-1 text-[12px] text-white/60">
                    {t('charge.recurringNote', { default: 'Recurring charge until you cancel.' })}
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
                    <span>{t('acknowledge', { default: 'I understand this is voluntary and final.' })}</span>
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
                    {t('actions.cancel', { default: 'Cancel' })}
                  </button>

                  <button
                    type="button"
                    onClick={handleStartStripe}
                    disabled={sending || !giftAck || !amountValid || !STRIPE_PK}
                    className={`px-4 py-2 rounded-lg text-white transition w-full sm:w-auto ${
                      giftAck && amountValid && !sending && STRIPE_PK
                        ? 'bg-[var(--purple)] hover:opacity-95'
                        : 'bg-white/10 opacity-60 cursor-not-allowed'
                    }`}
                    title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
                  >
                    {sending ? t('actions.enabling', { default: 'Weiter…' }) : t('actions.enable', { default: 'Weiter zur Zahlung' })}
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
                      tMethods={tMethods}
                      autoDrainId={autoDrainId}
                      sending={sending}
                      setSending={setSending}
                      setError={setError}
                      onBack={() => {
                        setStep('form');
                        setError(null);
                        setClientSecret(null);
                        setAutoDrainId(null);
                        setCustomerSessionClientSecret(null);
                      }}
                      onActivated={() => {
                        markAck();
                        onSuccess({ autoDrainId, amountCents, currency, cadence });
                        onClose();
                      }}
                      onOpenMethods={() => setMethodsOpen(true)}
                      savedSummary={{ count: savedCount, hasDefault: hasDefaultSaved }}
                    />
                  </Elements>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(ui, document.body);
}
