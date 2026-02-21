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

  toUserId: string;
  toDisplayName: string;
  toAvatarUrl?: string | null;

  defaultCurrency?: string;
  conversationId?: string;

  onSuccess: (p: { autoDrainId: string; amountCents: number; currency: string; cadence: AutoDrainCadence }) => void;
};

const MIN_CENTS = 100;
const MAX_CENTS = 1_000_000;

const GIFT_ACK_KEY = 'subm8_gift_ack_v1';
const PLATFORM_FEE_BPS_TOPUP = 1000; // 10% on top

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

/** ---------- Shared (matches TipModal look/behavior) ---------- */

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

  const loadMethods = React.useCallback(async () => {
    const res = await fetch('/api/payments/methods/list', { method: 'GET' });
    const j: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const err = getUpdateError(j) ?? t('methods.errors.loadFailed', { default: 'Laden fehlgeschlagen' });
      throw new Error(err);
    }

    if (!isMethodsListOk(j)) throw new Error(t('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));
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
      .catch((e) => setError(e instanceof Error ? e.message : t('methods.errors.loadFailed', { default: 'Laden fehlgeschlagen' })))
      .finally(() => setLoading(false));
  }, [open, loadMethods, t]);

  async function startSetupIntent() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payments/methods/setup-intent', { method: 'POST' });
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok) throw new Error(getSetupIntentError(j) || t('methods.errors.startSetupFailed', { default: 'Setup fehlgeschlagen' }));
      if (!isSetupIntentOk(j)) throw new Error(t('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));

      setClientSecret(j.clientSecret);
      setPeKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('methods.errors.startSetupFailed', { default: 'Setup fehlgeschlagen' }));
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

      if (!res.ok) throw new Error(getUpdateError(j) || t('methods.errors.setDefaultFailed', { default: 'Standard setzen fehlgeschlagen' }));
      if (!isUpdateOk(j)) throw new Error(t('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));

      await loadMethods();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('methods.errors.setDefaultFailed', { default: 'Standard setzen fehlgeschlagen' }));
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

      if (!res.ok) throw new Error(getUpdateError(j) || t('methods.errors.removeFailed', { default: 'Entfernen fehlgeschlagen' }));
      if (!isUpdateOk(j)) throw new Error(t('methods.errors.invalidResponse', { default: 'Ungültige Antwort' }));

      await loadMethods();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('methods.errors.removeFailed', { default: 'Entfernen fehlgeschlagen' }));
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
            <div className="font-semibold text-[16px]">{t('methods.title', { default: 'Zahlungsmethoden' })}</div>
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
          <div className="mt-1 text-[12px] text-white/65">{t('methods.subtitle', { default: 'Karten verwalten und Standard setzen.' })}</div>
        </div>

        <div className="px-5 py-5 overflow-y-auto overscroll-contain [ -webkit-overflow-scrolling:touch ]">
          {error && (
            <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            <div className="flex items-center justify-between">
              <div className="text-[13px] text-white/80">{t('methods.savedCards', { default: 'Gespeicherte Karten' })}</div>
              <button
                type="button"
                onClick={startSetupIntent}
                disabled={loading || !STRIPE_PK}
                className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
                title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
              >
                {t('methods.actions.addCard', { default: 'Karte hinzufügen' })}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {loading && methods.length === 0 ? (
                <div className="text-[13px] text-white/60">{t('methods.loading', { default: 'Lade…' })}</div>
              ) : methods.length === 0 ? (
                <div className="text-[13px] text-white/60">{t('methods.empty', { default: 'Keine Karten gespeichert.' })}</div>
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
                          {isDef ? <span className="ml-2 text-[11px] text-[var(--purple)]">{t('methods.default', { default: 'Standard' })}</span> : null}
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
                            {t('methods.actions.setDefault', { default: 'Als Standard' })}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => detach(m.id)}
                          disabled={loading}
                          className="px-2.5 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[12px] disabled:opacity-60"
                        >
                          {t('methods.actions.remove', { default: 'Entfernen' })}
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
              <div className="text-[13px] text-white/80">{t('methods.addNewTitle', { default: 'Neue Karte speichern' })}</div>
              <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <SetupIntentForm
                    t={t}
                    peKey={peKey}
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
              <div className="mt-2 text-[12px] text-white/55">{t('methods.securityNote', { default: 'Deine Zahlungsdaten werden sicher von Stripe verarbeitet.' })}</div>
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
  peKey,
}: {
  onDone: () => void;
  onError: (msg: string) => void;
  t: ReturnType<typeof useTranslations>;
  peKey: number;
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

      if (!stripe || !elements) throw new Error(t('stripe.errors.notReady', { default: 'Stripe nicht bereit' }));

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

      if (error) throw new Error(error.message || t('methods.errors.saveFailed', { default: 'Speichern fehlgeschlagen' }));
      if (setupIntent?.status !== 'succeeded' && setupIntent?.status !== 'processing') {
        throw new Error(t('methods.errors.setupNotCompleted', { default: 'Setup nicht abgeschlossen' }));
      }

      await sleep(300);
      onDone();
    } catch (e) {
      onError(e instanceof Error ? e.message : t('methods.errors.saveFailed', { default: 'Speichern fehlgeschlagen' }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="grid gap-2 mb-3">
        <input
          value={billName}
          onChange={(e) => setBillName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
        />
        <input
          value={billEmail}
          onChange={(e) => setBillEmail(e.target.value)}
          placeholder="E-Mail"
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
        />
        <input
          value={billPhone}
          onChange={(e) => setBillPhone(e.target.value)}
          placeholder="Telefon"
          className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none"
        />
      </div>

      <PaymentElement key={`setup-pe-${peKey}`} options={{ layout: 'tabs' }} />
      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !stripe || !elements}
          className={`relative px-4 py-2 rounded-lg text-white transition ${
            !saving && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          {saving ? t('methods.actions.saving', { default: 'Speichere…' }) : t('methods.actions.saveCard', { default: 'Karte speichern' })}
        </button>
      </div>
    </div>
  );
}

/** ---------- AutoDrain API shapes ---------- */

type CreateOk = {
  ok: true;
  autoDrainId: string;
  stripeSubscriptionId: string;
  clientSecret: string;
  currency: string;
  amountCents: number;
  cadence: AutoDrainCadence;
  customerSessionClientSecret?: string;
  intentType?: 'payment_intent' | 'setup_intent' | null;
};

function isCreateOk(x: unknown): x is CreateOk {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.ok === true && typeof o.autoDrainId === 'string' && typeof o.stripeSubscriptionId === 'string' && typeof o.clientSecret === 'string';
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

/** ---------- Pay step (matches TipModal: save toggle + remove default) ---------- */

function StripeSubscribeStep({
  t,
  paymentT,
  autoDrainId,
  intentType,
  sending,
  setSending,
  setError,
  onBack,
  onActivated,
  savedSummary,
  saveForFuture,
  setSaveForFuture,
  onRemoveSaved,
}: {
  t: ReturnType<typeof useTranslations>;
  paymentT: ReturnType<typeof useTranslations>;
  autoDrainId: string;
  intentType: 'payment_intent' | 'setup_intent' | null;
  sending: boolean;
  setSending: (v: boolean) => void;
  setError: (s: string | null) => void;
  onBack: () => void;
  onActivated: () => void;
  savedSummary: { count: number; hasDefault: boolean };
  saveForFuture: boolean;
  setSaveForFuture: (v: boolean) => void;
  onRemoveSaved: () => Promise<void>;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [peComplete, setPeComplete] = React.useState(false);

  async function confirmStripe() {
    if (!stripe || !elements) throw new Error(paymentT('stripe.errors.notReady', { default: 'Stripe nicht bereit' }));

    if (intentType === 'setup_intent') {
      const { error, setupIntent } = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? window.location.href : undefined,
        },
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
      if (setupIntent?.status !== 'succeeded' && setupIntent?.status !== 'processing') {
        throw new Error(t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
      }
    } else {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: typeof window !== 'undefined' ? window.location.href : undefined,
        },
        redirect: 'if_required',
      });

      if (error) throw new Error(error.message || t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
      if (paymentIntent?.status === 'canceled') throw new Error(paymentT('stripe.errors.canceled', { default: 'Zahlung abgebrochen' }));
      if (paymentIntent?.status === 'requires_payment_method') throw new Error(paymentT('stripe.errors.paymentFailed', { default: 'Zahlung fehlgeschlagen' }));
    }
  }

  async function finalizeWithPoll() {
    const delays = [0, 400, 800, 1200, 2000];
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
      await confirmStripe();
      await finalizeWithPoll();
      onActivated();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-white/[.03] p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[13px] text-white/80">{paymentT('stripe.enterCard', { default: 'Zahlungsmethode wählen' })}</div>

        <div className="flex items-center gap-2">
          {savedSummary.hasDefault ? (
            <button
              type="button"
              onClick={() => void onRemoveSaved()}
              disabled={sending}
              className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
              title="Gespeicherte Karte entfernen"
            >
              Remove
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSaveForFuture(!saveForFuture)}
              disabled={sending || !peComplete}
              className={`px-3 py-1.5 rounded-lg text-[13px] transition border ${
                sending || !peComplete
                  ? 'opacity-60 cursor-not-allowed border-white/10 bg-white/5'
                  : saveForFuture
                    ? 'border-[var(--purple)]/40 bg-[var(--purple)]/15 text-white'
                    : 'border-white/15 hover:bg-white/10 text-white'
              }`}
              title={!peComplete ? 'Bitte Kartendaten ausfüllen' : undefined}
            >
              {saveForFuture ? '✓ Save' : 'Save'}
            </button>
          )}

          <button
            type="button"
            onClick={onBack}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
          >
            {paymentT('actions.back', { default: 'Zurück' })}
          </button>
        </div>
      </div>

      {savedSummary.count > 0 ? (
        <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
          <div className="text-[12px] text-white/70">
            {paymentT('stripe.savedCardsSummary', { count: savedSummary.count, default: `${savedSummary.count} gespeicherte Karte(n)` })}
            {savedSummary.hasDefault ? <span className="ml-2 text-[var(--purple)]">{paymentT('stripe.defaultSet', { default: 'Standard gesetzt' })}</span> : null}
          </div>
          <div className="mt-1 text-[12px] text-white/55">{paymentT('stripe.savedCardsHint', { default: 'Du kannst eine Standardkarte festlegen.' })}</div>
        </div>
      ) : (
        <div className="mt-3 text-[12px] text-white/55">{paymentT('stripe.tipSaveCard', { default: 'Optional: Speichere die Karte für zukünftige Zahlungen.' })}</div>
      )}

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3">
        <PaymentElement
          onChange={(e) => setPeComplete(!!e.complete)}
          options={{
            wallets: { applePay: 'never', googlePay: 'never' },
          }}
        />
      </div>

      <div className="mt-2 text-[12px] text-white/55">
        {savedSummary.hasDefault
          ? 'Du hast bereits eine gespeicherte Karte.'
          : saveForFuture
            ? 'Die Karte wird nach erfolgreicher Aktivierung gespeichert.'
            : 'Optional: Speichere die Karte für zukünftige AutoDrain-Zahlungen.'}
      </div>

      <div className="mt-4 flex items-center justify-end">
        <button
          type="button"
          onClick={handleEnable}
          disabled={sending || !stripe || !elements}
          className={`px-4 py-2 rounded-lg text-white transition ${
            !sending && stripe && elements ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            <SparkleIcon />
            {sending ? paymentT('actions.sending', { default: 'Sende…' }) : t('actions.enable', { default: 'AutoDrain aktivieren' })}
          </span>
        </button>
      </div>

      <div className="mt-2 text-[12px] text-white/55">{paymentT('stripe.secureHint', { default: 'Deine Zahlungsdaten werden sicher von Stripe verarbeitet.' })}</div>
    </div>
  );
}

/** ---------- Success animation (exactly like TipModal) ---------- */

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

/** ---------- Main Modal ---------- */

type Step = 'form' | 'pay' | 'success';

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
  const t = useTranslations('payment.autoDrainAcceptModal');
  // IMPORTANT: reuse TipModal namespace so PaymentMethods strings match exactly
  const paymentT = useTranslations('payment.tipModal');

  const mounted = useMounted();

  const [amount, setAmount] = React.useState('50');
  const [cadence, setCadence] = React.useState<AutoDrainCadence>('MONTHLY');

  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [giftAck, setGiftAck] = React.useState<boolean>(true);

  const [step, setStep] = React.useState<Step>('form');

  const [clientSecret, setClientSecret] = React.useState<string | null>(null);
  const [customerSessionClientSecret, setCustomerSessionClientSecret] = React.useState<string | null>(null);
  const [autoDrainId, setAutoDrainId] = React.useState<string | null>(null);
  const [intentType, setIntentType] = React.useState<'payment_intent' | 'setup_intent' | null>(null);

  const [methodsOpen, setMethodsOpen] = React.useState(false);
  const [savedCount, setSavedCount] = React.useState(0);
  const [hasDefaultSaved, setHasDefaultSaved] = React.useState(false);

  const [saveForFuture, setSaveForFuture] = React.useState(false);

  const [success, setSuccess] = React.useState<null | { autoDrainId: string; totalCents: number; currency: string }>(null);
  const [closingSoon, setClosingSoon] = React.useState(false);
  const closeTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

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

    setClosingSoon(false);
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setAmount('50');
    setCadence('MONTHLY');

    setSending(false);
    setError(null);

    setStep('form');
    setClientSecret(null);
    setCustomerSessionClientSecret(null);
    setAutoDrainId(null);
    setIntentType(null);

    setSaveForFuture(false);

    setSuccess(null);

    refreshSavedSummary();

    try {
      const v = typeof window !== 'undefined' ? window.localStorage.getItem(GIFT_ACK_KEY) : '1';
      setGiftAck(v === '1');
    } catch {
      setGiftAck(true);
    }
  }, [open]);

  const currency = defaultCurrency;

  const amountCents = parseCents(amount) ?? 0;
  const amountValid = amountCents >= MIN_CENTS && amountCents <= MAX_CENTS;

  const topupFeeCents = Math.round(amountCents * (PLATFORM_FEE_BPS_TOPUP / 10_000));
  const totalCents = amountCents + topupFeeCents;

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

      if (!STRIPE_PK) throw new Error(paymentT('stripe.errors.missingPublishableKey', { default: 'Missing publishable key' }));

      const res = await fetch('/api/payments/autodrain/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          toUserId,
          amountCents,
          currency,
          cadence,
          conversationId,
          saveForFuture, // ✅ same behavior as TipModal
        }),
      });

      const j: unknown = await res.json().catch(() => null);

      if (!res.ok || !isCreateOk(j)) {
        throw new Error(getErr(j) || t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
      }

      setAutoDrainId(j.autoDrainId);
      setClientSecret(j.clientSecret);
      setCustomerSessionClientSecret(j.customerSessionClientSecret ?? null);
      setIntentType(j.intentType ?? null);
      setStep('pay');

      refreshSavedSummary();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('errors.generic', { default: 'Etwas ist schiefgelaufen.' }));
    } finally {
      setSending(false);
    }
  }

  function handleActivatedFinal() {
    if (!autoDrainId) return;

    // UI success
    setSuccess({ autoDrainId, totalCents, currency });
    setStep('success');

    // update local disclaimers
    markAck();

    // fire event immediately (like TipModal)
    onSuccess({ autoDrainId, amountCents, currency, cadence });

    // autoclose animation
    setClosingSoon(true);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);

    closeTimerRef.current = window.setTimeout(() => {
      setClosingSoon(false);
      setSuccess(null);
      onClose();
    }, 1100);
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
        t={paymentT}
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

                  <div className="ml-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setMethodsOpen(true)}
                      disabled={step === 'success'}
                      className={`px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] ${
                        step === 'success' ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''
                      }`}
                    >
                      {paymentT('methods.title', { default: 'Zahlungsmethoden' })}
                    </button>

                    <button
                      type="button"
                      disabled={step === 'success'}
                      onClick={() => {
                        if (step === 'success') return;
                        setSuccess(null);
                        onClose();
                      }}
                      className={`inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10 shrink-0 ${
                        step === 'success' ? 'opacity-40 cursor-not-allowed hover:bg-transparent' : ''
                      }`}
                      aria-label={t('actions.closeAria', { default: 'Close' })}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden>
                        <path d="M6 6l12 12M18 6L6 18" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Body */}
          {step !== 'success' ? (
            <div className="px-4 sm:px-5 pb-5 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
              {step === 'form' ? (
                <>
                  <div className="text-[12px] text-white/75 mb-3">
                    {t('disclaimer', { default: 'Wiederkehrende Zahlungen sind freiwillig und final.' })}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <label className="block text-[12px] text-white/70 mb-1">{t('charge.label', { default: 'Betrag pro Abbuchung' })}</label>

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

                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <label className="block text-[12px] text-white/70 mb-2">{t('charge.recurringNote', { default: 'Intervall' })}</label>

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

                  {/* Breakdown like TipModal */}
                  <div className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <div className="rounded-xl border border-white/10 bg-gradient-to-b from-white/[.04] to-transparent p-3">
                      <div className="flex items-center justify-between text-[14px] mb-1">
                        <span>{t('breakdown.amountToCreator', { default: `Betrag an ${toDisplayName}` })}</span>
                        <strong className="text-white">{fmtCurrency(amountCents, currency)}</strong>
                      </div>
                      <div className="flex items-center justify-between text-[13px] text-white/70">
                        <span>{t('breakdown.platformFeeTop', { default: 'Plattform-Gebühr (10%)' })}</span>
                        <span>{fmtCurrency(topupFeeCents, currency)}</span>
                      </div>
                      <div className="mt-2 border-t border-white/10 pt-2 flex items-center justify-between">
                        <span className="text-[14px]">{t('breakdown.youPay', { default: 'Du zahlst' })}</span>
                        <span className="text-[16px] font-semibold break-words">
                          {fmtCurrency(totalCents, currency)} <span className="text-[13px] font-normal text-white/70">({cadenceLabel})</span>
                        </span>
                      </div>
                      <div className="mt-2 text-[12px] text-white/70">{t('disclaimer.legal', { default: 'Wiederkehrend bis zur Kündigung.' })}</div>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/70">
                      {t('cancelAnytime', { default: 'Du kannst AutoDrain jederzeit in deinen Zahlungen wieder beenden.' })}
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
                      <span>{t('acknowledge', { default: 'Ich verstehe, dass das freiwillig und final ist.' })}</span>
                    </label>
                  )}

                  {error && (
                    <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
                  )}

                  {/* Save toggle hint (before starting) */}
                  {!hasDefaultSaved && (
                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[12px] text-white/70">{paymentT('stripe.tipSaveCard', { default: 'Optional: Karte nach Aktivierung speichern.' })}</div>
                        <button
                          type="button"
                          onClick={() => setSaveForFuture(!saveForFuture)}
                          disabled={sending}
                          className={`px-3 py-1.5 rounded-lg text-[13px] transition border ${
                            sending
                              ? 'opacity-60 cursor-not-allowed border-white/10 bg-white/5'
                              : saveForFuture
                                ? 'border-[var(--purple)]/40 bg-[var(--purple)]/15 text-white'
                                : 'border-white/15 hover:bg-white/10 text-white'
                          }`}
                        >
                          {saveForFuture ? '✓ Save' : 'Save'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSuccess(null);
                        onClose();
                      }}
                      className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 w-full sm:w-auto"
                      disabled={sending}
                    >
                      {paymentT('actions.cancel', { default: 'Cancel' })}
                    </button>

                    <button
                      type="button"
                      onClick={handleStartStripe}
                      disabled={sending || !giftAck || !amountValid || !STRIPE_PK}
                      className={`relative px-4 py-2 rounded-lg text-white transition w-full sm:w-auto ${
                        giftAck && amountValid && !sending && STRIPE_PK ? 'bg-[var(--purple)] hover:opacity-95' : 'bg-white/10 opacity-60 cursor-not-allowed'
                      }`}
                      title={!STRIPE_PK ? 'Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY' : undefined}
                    >
                      <span className="inline-flex items-center gap-2">
                        <SparkleIcon />
                        {sending ? paymentT('actions.sending', { default: 'Sende…' }) : paymentT('actions.continueToPay', { default: 'Weiter zur Zahlung' })}
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {error && (
                    <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{error}</div>
                  )}

                  {clientSecret && elementsOptions && autoDrainId ? (
                    <Elements stripe={stripePromise} options={elementsOptions}>
                      <StripeSubscribeStep
                        t={t}
                        paymentT={paymentT}
                        autoDrainId={autoDrainId}
                        intentType={intentType}
                        sending={sending}
                        setSending={setSending}
                        setError={setError}
                        onBack={() => {
                          setStep('form');
                          setError(null);
                          setClientSecret(null);
                          setAutoDrainId(null);
                          setCustomerSessionClientSecret(null);
                          setIntentType(null);
                        }}
                        onActivated={handleActivatedFinal}
                        savedSummary={{ count: savedCount, hasDefault: hasDefaultSaved }}
                        saveForFuture={saveForFuture}
                        setSaveForFuture={setSaveForFuture}
                        onRemoveSaved={async () => {
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
                              headers: { 'content-type': 'application/json' },
                              body: JSON.stringify({ action: 'detach', paymentMethodId: defaultId }),
                            });
                            const j: unknown = await res.json().catch(() => null);
                            if (!res.ok) throw new Error(getUpdateError(j) || 'Failed to remove');

                            await refreshSavedSummary();
                            setSaveForFuture(false);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'Failed to remove');
                          } finally {
                            setSending(false);
                          }
                        }}
                      />
                    </Elements>
                  ) : null}
                </>
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
                <h3 className="mt-4 text-[18px] font-semibold tracking-tight">{paymentT('success.title', { default: 'Erfolgreich!' })}</h3>
                <p className="mt-1 text-white/80">
                  {paymentT('success.youPaid', { amount: fmtCurrency(success?.totalCents ?? 0, currency), default: `Du zahlst ${fmtCurrency(success?.totalCents ?? 0, currency)}` })}
                </p>
                <div className="mt-3 text-[12px] text-white/55">Closing…</div>
              </div>
            </div>
          )}

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
      </div>
    </>
  );

  return createPortal(ui, document.body);
}