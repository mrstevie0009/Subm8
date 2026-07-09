// src/app/[locale]/signup/page.tsx
'use client';

import * as React from 'react';                   
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';                

     

// shadcn/ui
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

type RoleUi = 'sub' | 'domme';
type RoleDb = 'SUBMISSIVE' | 'DOMME';

/* ----------------- kleine Hilfen ----------------- */
const sanitizeHandle = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, '');
const validHandle = (v: string) => /^[a-z0-9_]{3,20}$/.test(v);

function isHandleAvailableResponse(v: unknown): v is { available: boolean } {
  return typeof v === 'object' && v !== null && 'available' in v &&
    typeof (v as Record<string, unknown>).available === 'boolean';
}
function readErrorMessage(v: unknown): string | undefined {
  if (typeof v !== 'object' || v === null) return undefined;
  const val = (v as Record<string, unknown>).error;
  return typeof val === 'string' ? val : undefined;
}

/* ----------------- Account-Type-Karte ----------------- */
interface AccountTypeCardProps {
  type: RoleUi;
  emoji: string;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}

function AccountTypeCard({
  emoji, title, description, isSelected, onSelect,
}: AccountTypeCardProps) {
  return (
    <Card
      className={`cursor-pointer transition-all duration-200 bg-black/20 border-white/10 hover:bg-black/30 ${isSelected ? 'ring-2 ring-white/50 bg-black/30' : ''}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect()}
      aria-pressed={isSelected || undefined}
    >
      <CardContent className="p-3 sm:p-4 text-center">
        <div className="mb-1.5 sm:mb-2 text-xl sm:text-2xl">{emoji}</div>
        <h3 className="text-white mb-1.5 sm:mb-2 text-base sm:text-lg">{title}</h3>
        <p className="text-white/70 text-[13px] sm:text-sm leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  );
}

type LegalTab = 'terms' | 'privacy';

function TermsPrivacyModal({
  open,
  onClose,
  initialTab = 'terms',
}: {
  open: boolean;
  onClose: () => void;
  initialTab?: LegalTab;
}) {
  const tTerms = useTranslations('legal.legal.terms');
  const tPrivacy = useTranslations('legal.legal.privacy');
  const tShared = useTranslations('legal.legal.shared');

  const [tab, setTab] = React.useState<LegalTab>(initialTab);
  React.useEffect(() => setTab(initialTab), [initialTab, open]);

  const updatedStr = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date());

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tab === 'terms' ? tTerms('title') : tPrivacy('title')}
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/40 shadow-[0_8px_40px_rgba(0,0,0,.5)] overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="inline-flex rounded-full bg-black/30 p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setTab('terms')}
              className={`px-4 py-1.5 text-sm rounded-full transition ${
                tab === 'terms' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white/90'
              }`}
            >
              {tTerms('title')}
            </button>
            <button
              type="button"
              onClick={() => setTab('privacy')}
              className={`px-4 py-1.5 text-sm rounded-full transition ${
                tab === 'privacy' ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white/90'
              }`}
            >
              {tPrivacy('title')}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/70 hover:text-white/100 transition p-2"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70svh] overflow-y-auto px-6 pb-6 pt-4">
          {tab === 'terms' ? (
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <h1 className="mt-0">{tTerms('title')}</h1>
              <p className="text-white/70 -mt-3">{tTerms('subtitle')}</p>
              <p className="text-xs text-white/60">
                {tShared('updated')}: {updatedStr}
              </p>
              <h3 className="font-bold">{tTerms('sections.scope')}</h3>
              <p>{tTerms('content.p_scope')}</p>
              <h3 className="font-bold">{tTerms('sections.audience')}</h3>
              <ul className="list-disc pl-5">
                <li>{tTerms('content.audience_li_1')}</li>
                <li>{tTerms('content.audience_li_2')}</li>
              </ul>
              <h3 className="font-bold">{tTerms('sections.roles')}</h3>
              <p>{tTerms('content.p_roles')}</p>
              <ul className="list-disc pl-5">
                <li>{tTerms('content.roles_li_1')}</li>
                <li>{tTerms('content.roles_li_2')}</li>
                <li>{tTerms('content.roles_li_3')}</li>
              </ul>
              <h3 className="font-bold">{tTerms('sections.tips')}</h3>
              <ul className="list-disc pl-5">
                <li>{tTerms('content.tips_li_1')}</li>
                <li>{tTerms('content.tips_li_2')}</li>
                <li>{tTerms('content.tips_li_3')}</li>
                <li>{tTerms('content.tips_li_4')}</li>
                <li>{tTerms('content.tips_li_5')}</li>
              </ul>
              <h3 className="font-bold">{tTerms('sections.fees')}</h3>
              <ul className="list-disc pl-5">
                <li>{tTerms('content.fees_li_1')}</li>
                <li>{tTerms('content.fees_li_2')}</li>
                <li>{tTerms('content.fees_li_3')}</li>
                <li>{tTerms('content.fees_li_4')}</li>
              </ul>
              <h3 className="font-bold">{tTerms('sections.tax')}</h3>
              <ul className="list-disc pl-5">
                <li>{tTerms('content.tax_li_1')}</li>
                <li>{tTerms('content.tax_li_2')}</li>
                <li>{tTerms('content.tax_li_3')}</li>
              </ul>
              <h3 className="font-bold">{tTerms('sections.termination')}</h3>
              <ul className="list-disc pl-5">
                <li>{tTerms('content.termination_li_1')}</li>
                <li>{tTerms('content.termination_li_2')}</li>
              </ul>
              <h3 className="font-bold">{tTerms('sections.liability')}</h3>
              <ul className="list-disc pl-5">
                <li>{tTerms('content.liability_li_1')}</li>
                <li>{tTerms('content.liability_li_2')}</li>
              </ul>
              <h3 className="font-bold">{tTerms('sections.changes')}</h3>
              <p>{tTerms('content.p_changes')}</p>
              <h3 className="font-bold">{tTerms('sections.law')}</h3>
              <p>{tTerms('content.p_law')}</p>
            </article>
          ) : (
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <h1 className="mt-0">{tPrivacy('title')}</h1>
              <p className="text-white/70 -mt-3">{tPrivacy('subtitle')}</p>
              <p className="text-xs text-white/60">
                {tShared('updated')}: 30.08.2025
              </p>
              <h3 className="font-bold">{tPrivacy('sections.controller')}</h3>
              <p>{tPrivacy('content.p_controller')}</p>
              <h3 className="font-bold">{tPrivacy('sections.data')}</h3>
              <ul className="list-disc pl-5">
                <li>{tPrivacy('content.data_li_1')}</li>
                <li>{tPrivacy('content.data_li_2')}</li>
                <li>{tPrivacy('content.data_li_3')}</li>
                <li>{tPrivacy('content.data_li_4')}</li>
              </ul>
              <h3 className="font-bold">{tPrivacy('sections.purpose')}</h3>
              <ul className="list-disc pl-5">
                <li>{tPrivacy('content.purpose_li_1')}</li>
                <li>{tPrivacy('content.purpose_li_2')}</li>
                <li>{tPrivacy('content.purpose_li_3')}</li>
                <li>{tPrivacy('content.purpose_li_4')}</li>
              </ul>
              <h3 className="font-bold">{tPrivacy('sections.legal')}</h3>
              <ul className="list-disc pl-5">
                <li>{tPrivacy('content.legal_li_1')}</li>
                <li>{tPrivacy('content.legal_li_2')}</li>
                <li>{tPrivacy('content.legal_li_3')}</li>
              </ul>
              <h3 className="font-bold">{tPrivacy('sections.sharing')}</h3>
              <ul className="list-disc pl-5">
                <li>{tPrivacy('content.sharing_li_1')}</li>
                <li>{tPrivacy('content.sharing_li_2')}</li>
                <li>{tPrivacy('content.sharing_li_3')}</li>
              </ul>
              <h3 className="font-bold">{tPrivacy('sections.retention')}</h3>
              <p>{tPrivacy('content.p_retention')}</p>
              <h3 className="font-bold">{tPrivacy('sections.rights')}</h3>
              <ul className="list-disc pl-5">
                <li>{tPrivacy('content.rights_li_1')}</li>
                <li>{tPrivacy('content.rights_li_2')}</li>
                <li>{tPrivacy('content.rights_li_3')}</li>
              </ul>
              <h3 className="font-bold">{tPrivacy('sections.cookies')}</h3>
              <p>{tPrivacy('content.p_cookies')}</p>
            </article>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm border border-white/20 text-white/90 bg-black/20 hover:bg-black/30 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ----------------- Seite ----------------- */
export default function SignupStartPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('auth.auth.signup');
  const tc = useTranslations('common');
  const tAccount = useTranslations('auth.auth.signupAccount');

  const errorParam = sp.get('error');
  const isOAuthPending = errorParam === 'OAuthAccountNotLinked';
  const [oauthEmail, setOauthEmail] = React.useState<string | null>(null);

  const [username, setUsername] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const [selected, setSelected] = React.useState<RoleUi | null>(null);
  const isDomme = selected === 'domme';
  const [busy, setBusy] = React.useState(false);
  const [submitAttempted, setSubmitAttempted] = React.useState(false);

  const [agree, setAgree] = React.useState(false);
  const [dommeGiftAgree, setDommeGiftAgree] = React.useState(false);
  const [legalOpen, setLegalOpen] = React.useState(false);
  const [legalTab, setLegalTab] = React.useState<LegalTab>('terms');
  const [dommeOpen, setDommeOpen] = React.useState(false);

  // OAuth Email aus Cookie lesen
  React.useEffect(() => {
    if (!isOAuthPending) return;
    
    const cookies = document.cookie.split(';');
    const oauthCookie = cookies.find(c => c.trim().startsWith('subm8_oauth_pending='));
    if (oauthCookie) {
      const email = oauthCookie.split('=')[1];
      setOauthEmail(decodeURIComponent(email));
    }
  }, [isOAuthPending]);

  // Handle-Verfügbarkeit
  type HandleState = 'idle' | 'checking' | 'ok' | 'taken' | 'error';
  const [handleState, setHandleState] = React.useState<HandleState>('idle');
  const [handleMsg, setHandleMsg] = React.useState<string>('');

  // Debounce für Availability-Check
  const debounceTimer = React.useRef<number | null>(null);

  // Merker gegen Double-submit/-navigate
  const started = React.useRef(false);

  const handleFormatOk = !touched ? true : validHandle(username);
  const showFormatError = touched && !handleFormatOk;
  const showTakenError = handleState === 'taken';

  /** ←——— FIX: als useCallback, damit der Effekt eine stabile Dep bekommt */
  const checkHandleAvailability = React.useCallback(async (h: string): Promise<'ok' | 'taken' | 'skip' | 'error'> => {
    if (!validHandle(h)) return 'skip';
    setHandleState('checking');
    setHandleMsg('');
    try {
      const res = await fetch(`/api/signup/handle-available?handle=${encodeURIComponent(h)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });

      if (res.status === 404) {
        setHandleState('idle');
        return 'skip';
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json().catch(() => ({}));

      const available = isHandleAvailableResponse(data) ? data.available : false;

      if (available) {
        setHandleState('ok');
        setHandleMsg('');
        return 'ok';
      } else {
        setHandleState('taken');
        setHandleMsg(t('errors.handleTaken'));
        return 'taken';
      }
    } catch {
      setHandleState('error');
      setHandleMsg(t('errors.checkFailed'));
      return 'error';
    }
  }, [t]);

  // Live-Check bei Username-Änderung (debounced)
  React.useEffect(() => {
    if (!touched) return;

    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    if (!validHandle(username)) {
      setHandleState('idle');
      setHandleMsg('');
      return;
    }

    debounceTimer.current = window.setTimeout(() => {
      void checkHandleAvailability(username);
    }, 350) as unknown as number;

    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [username, touched, checkHandleAvailability]); // ←——— FIX: Funktion als Dep

  /** Weiterleitung ausführen (inkl. finaler Server-Validierung) */
  const proceed = React.useCallback(
    async (h: string, r: RoleUi) => {
      if (!validHandle(h) || !r || started.current) return;
      if (handleState === 'taken') return;
      if (!agree) return;
      if (r === 'domme' && !dommeGiftAgree) return;

      started.current = true;
      setBusy(true);

      const roleDb: RoleDb = r === 'domme' ? 'DOMME' : 'SUBMISSIVE';

      try {
        const res = await fetch('/api/signup/start', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ 
            handle: h, 
            role: roleDb,
            //NEU: OAuth-Email mitschicken falls vorhanden
            ...(isOAuthPending && oauthEmail ? { oauthEmail } : {}),
          }),
        });

        let ok = res.ok;
        let payload: unknown = null;
        try {
          payload = await res.json();
          if (ok && typeof payload === 'object' && payload !== null && 'ok' in payload) {
            const okVal = (payload as Record<string, unknown>).ok;
            if (typeof okVal === 'boolean' && okVal === false) ok = false;
          }
        } catch { /* ignore */ }

        if (!ok) {
          const err = readErrorMessage(payload);
          if (res.status === 409 || (err && /exist|taken|vergeben/i.test(err))) {
            setHandleState('taken');
            setHandleMsg(t('errors.handleTaken'));
          } else {
            setHandleState('error');
            setHandleMsg(err || t('errors.startFailed'));
          }
          started.current = false;
          setBusy(false);
          return;
        }

        if (isOAuthPending) {
          const completeRes = await fetch('/api/signup/oauth-complete', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              accept: 'application/json',
            },
            body: JSON.stringify({
              handle: h,
              role: roleDb,
            }),
          });

          const completeJson: unknown = await completeRes.json().catch(() => null);

          const completeOk =
            completeRes.ok &&
            typeof completeJson === 'object' &&
            completeJson !== null &&
            'ok' in completeJson &&
            (completeJson as Record<string, unknown>).ok === true;

          if (!completeOk) {
            const err = readErrorMessage(completeJson);
            if (completeRes.status === 409 || (err && /exist|taken|vergeben/i.test(err))) {
              setHandleState('taken');
              setHandleMsg(t('errors.handleTaken'));
            } else {
              setHandleState('error');
              setHandleMsg(err || t('errors.startFailed'));
            }
            started.current = false;
            setBusy(false);
            return;
          }

          window.location.assign(`/${locale}`);
          return;
        }

        router.push(`/${locale}/signup/account?handle=${encodeURIComponent(h)}&role=${roleDb}`);
      } catch {
        setHandleState('error');
        setHandleMsg(t('errors.network'));
        started.current = false;
        setBusy(false);
      }
    },
    [router, locale, handleState, t, isOAuthPending, oauthEmail, agree, dommeGiftAgree] 
  );

  /** Username ändern — kein Auto-Redirect, nur Live-Validierung */
  function onUsernameChange(value: string) {
    const cleaned = sanitizeHandle(value);
    setUsername(cleaned);
    if (!touched) setTouched(true);
  }

  const tryProceed = React.useCallback(
    async (h: string, r: RoleUi | null) => {
      if (started.current || busy) return;
      if (!validHandle(h)) return;
      if (!r) return;
      if (!agree) return;
      if (r === 'domme' && !dommeGiftAgree) return;
      if (handleState === 'taken' || handleState === 'checking') return;

      const status = handleState === 'ok' ? 'ok' : await checkHandleAvailability(h);
      if (status !== 'ok') return;

      await proceed(h, r);
    },
    [agree, busy, dommeGiftAgree, handleState, checkHandleAvailability, proceed]
  );

  /** Rolle wählen — ggf. Auto-Redirect (nur wenn Username → Rolle) */
  function onSelect(type: RoleUi) {
    setSelected(type);
    void tryProceed(username, type);
  }

  /** Enter (Submit) — Flow Rolle → Username */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched(true);

    if (!validHandle(username)) return;
    if (!selected) return;
    if (!agree) return;
    if (selected === 'domme' && !dommeGiftAgree) return;
    if (started.current || busy) return;

    const status = handleState === 'ok' ? 'ok' : await checkHandleAvailability(username);
    if (status !== 'ok') return;

    await proceed(username, selected);
  }

  const showHelperRow =
    showFormatError || showTakenError || handleState === 'checking' || handleState === 'error';

  return (
    <div
      className="auth-page relative grid min-h-[100svh] place-items-center px-3 py-4
                bg-[#0b0b0c] rounded-none md:rounded-2xl"
    >

      {/* weiche Blur-Blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 md:h-72 md:w-72 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 md:h-80 md:w-80 rounded-full bg-purple-500/20 blur-[90px]" />

      <div className="w-full max-w-[380px] sm:max-w-md">
        <Card className="rounded-2xl bg-[rgba(162,89,255,0.12)] backdrop-blur-xl ring-1 ring-white/20 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <CardContent
            className="p-5 sm:p-6 md:p-8 pt-3 sm:pt-1 md:pt-2
                      bg-[rgba(0,0,0,0.7)]
                      overflow-visible"
          >
            {/* Header + Logo */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="mb-1 sm:mb-2">
                <Link
                  href={`/${locale}/welcome`}
                  aria-label="Go to Subm8 welcome page"
                  prefetch={false}
                  className="inline-block"
                >
                  <Image
                    src="/Sub m8.png"
                    alt={`${tc('brand.name')} logo`}
                    width={240}
                    height={80}
                    priority
                    className="mx-auto w-[180px] sm:w-[220px] md:w-[240px] h-auto hover:opacity-90 transition-opacity"
                  />
                </Link>
              </div>
              <p className="text-white/80 mb-1 sm:mb-2 text-[13px] sm:text-base">
                {t('welcome', { brand: tc('brand.name') })}
              </p>
              <Link
                href={`/${locale}`}
                prefetch={false}
                className="text-white text-2xl sm:text-4xl mb-3 sm:mb-4 inline-block font-extrabold leading-tight"
              >
                {tc('brand.name')}
              </Link>

              {isOAuthPending && oauthEmail && (
                <div className="mb-4 rounded-xl border border-blue-300/40 bg-blue-300/15 p-3 text-[13px] sm:text-sm text-blue-100">
                  {t.rich('oauthPending', {
                    email: oauthEmail,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </div>
              )}

              <p className="text-white/70 text-[13px] sm:text-base">{t('chooseUsername')}</p>
              {isDomme && (
                <div className="mt-4 rounded-xl border border-yellow-400/40 bg-yellow-400/10">
                  <div className="p-4 pb-2">
                    <div className="font-semibold text-yellow-100 text-sm sm:text-base">
                      ⚠️ {tAccount('dommeDisclaimer.title')}
                      <ul className="text-[13px] sm:text-sm text-white/85 list-disc pl-5 space-y-1">
                        <li>{tAccount('dommeDisclaimer.li1')}</li>
                      </ul>
                    </div>

                    {dommeOpen ? (
                      <div className="mt-3">
                        <ul className="text-[13px] sm:text-sm text-white/85 list-disc pl-5 space-y-1">
                          <li>{tAccount('dommeDisclaimer.li1')}</li>
                          <li>{tAccount('dommeDisclaimer.li2')}</li>
                          <li>{tAccount('dommeDisclaimer.li3')}</li>
                          <li>{tAccount('dommeDisclaimer.li4')}</li>
                        </ul>
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => setDommeOpen(false)}
                            className="text-[12px] sm:text-sm underline text-yellow-100 hover:text-white"
                          >
                            {tAccount('dommeDisclaimer.readLess')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setDommeOpen(true)}
                          className="text-[12px] sm:text-sm underline text-yellow-100 hover:text-white py-2 px-1 rounded-md active:bg-white/10"
                        >
                          {tAccount('dommeDisclaimer.readMore')}
                        </button>
                      </div>
                    )}

                    <label className="mt-3 flex items-start gap-3 p-3 rounded-lg cursor-pointer hover:bg-white/5 active:bg-white/10 transition">
                      <input
                        type="checkbox"
                        className="accent-[var(--purple)] w-5 h-5"
                        checked={dommeGiftAgree}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setDommeGiftAgree(checked);

                          if (checked) {
                            void tryProceed(username, selected);
                          }
                        }}
                      />
                      <span className="text-[13px] sm:text-sm text-white/90">
                        {tAccount('dommeDisclaimer.checkbox')}
                      </span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Formular (Enter löst submit aus) */}
            <form className="space-y-6" onSubmit={onSubmit} noValidate>
              {/* Username Input mit @ */}
              <div>
                <div className="relative">
                  <div
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/70 select-none"
                    aria-hidden
                  >
                    @
                  </div>
                  <Input
                    type="text"
                    placeholder={t('fields.username.placeholder')}
                    value={username}
                    onChange={(e) => onUsernameChange(e.target.value)}
                    onBlur={() => setTouched(true)}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    disabled={busy}
                    aria-invalid={showFormatError || showTakenError ? true : undefined}
                    className={`pl-8 h-10 sm:h-11 bg-[rgba(39,37,42,0.12)] border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20 lowercase ${showFormatError || showTakenError ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                  />
                </div>

                {/* Helper/Fehlermeldung */}
                {showHelperRow && (
                  <div className="mt-2 text-[12px] sm:text-[13px]">
                    {showFormatError && (
                      <span className="text-red-300">{t('fields.username.formatHelp')}</span>
                    )}
                    {!showFormatError && handleState === 'checking' && (
                      <span className="text-white/70">{t('fields.username.checking')}</span>
                    )}
                    {!showFormatError && handleState === 'taken' && (
                      <span className="text-red-300">{handleMsg || t('errors.handleTaken')}</span>
                    )}
                    {!showFormatError && handleState === 'error' && (
                      <span className="text-yellow-200">{handleMsg || t('errors.checkFailed')}</span>
                    )}
                  </div>
                )}
              </div>

              {/* Account Type Selection */}
              <div>
                <p className="text-white/80 mb-3 sm:mb-4 text-center text-[13px] sm:text-base">{t('selectTypeTitle')}</p>
                <div className="bg-[rgba(67,66,69,0.12)]  grid grid-cols-2 gap-3 sm:gap-4">
                  <AccountTypeCard
                    type="sub"
                    emoji="😊"
                    title={t('roleCard.sub.title')}
                    description={t('roleCard.sub.desc')}
                    isSelected={selected === 'sub'}
                    onSelect={() => onSelect('sub')}
                  />
                  <AccountTypeCard
                    type="domme"
                    emoji="👑"
                    title={t('roleCard.domme.title')}
                    description={t('roleCard.domme.desc')}
                    isSelected={selected === 'domme'}
                    onSelect={() => onSelect('domme')}
                  />
                </div>
                {submitAttempted && !selected && (
                  <div className="mt-2 text-center text-[12px] text-red-300">
                    {t('errors.selectTypeRequired')}
                  </div>
                )}

                <label className="mt-4 flex items-start gap-2 text-[13px] sm:text-sm text-white/90">
                  <input
                    type="checkbox"
                    className="accent-[var(--purple)] mt-[3px]"
                    checked={agree}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setAgree(checked);

                      if (checked) {
                        void tryProceed(username, selected);
                      }
                    }}
                  />
                  <span>
                    {tAccount('agree').split('Terms')[0]}
                    <button
                      type="button"
                      className="underline text-purple-100 hover:text-white px-1 py-1 rounded-md active:bg-white/10"
                      onClick={() => {
                        setLegalTab('terms');
                        setLegalOpen(true);
                      }}
                    >
                      Terms
                    </button>
                    {tAccount('agree').split('Terms')[1]?.split('Privacy Policy')[0] ?? ' & '}
                    <button
                      type="button"
                      className="underline text-purple-100 hover:text-white px-1 py-1 rounded-md active:bg-white/10"
                      onClick={() => {
                        setLegalTab('privacy');
                        setLegalOpen(true);
                      }}
                    >
                      Privacy Policy
                    </button>
                    {tAccount('agree').split('Privacy Policy')[1] ?? '.'}
                  </span>
                </label>
                {submitAttempted && !agree && (
                  <div className="mt-2 text-center text-[12px] text-red-300">
                    {t('errors.consentRequired')}
                  </div>
                )}

                {submitAttempted && isDomme && !dommeGiftAgree && (
                  <div className="mt-2 text-center text-[12px] text-red-300">
                    {t('errors.dommeDisclaimerRequired')}
                  </div>
                )}
              </div>

              {/* Kein Button — Enter im Username-Feld triggert onSubmit */}
              <div className="text-center text-[11px] sm:text-xs text-white/60">
                {t('enterToContinue')}&nbsp;
                <kbd className="px-1 py-0.5 rounded border border-white/20">Enter</kbd>.
              </div>
            </form>

            {/* Login Link */}
            <div className="mt-5 sm:mt-6 text-center">
              <p className="text-white/70">
                {t('login.cta')}{' '}
                <Link
                  href={`/${locale}/signin`}
                  prefetch={false}
                  className="text-purple-300 hover:text-purple-200 underline transition-colors"
                >
                  {t('login.link')}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <TermsPrivacyModal
        open={legalOpen}
        onClose={() => setLegalOpen(false)}
        initialTab={legalTab}
      />
    </div>
  );
}
