// src/app/[locale]/signup/account/page.tsx
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';

// Lottie nur clientseitig laden
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// shadcn/ui
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

type LegalTab = 'terms' | 'privacy';

/* ---------------- Terms/Privacy Modal (unverändert) ---------------- */
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

  return open ? (
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
                <li>
                  <strong>{tTerms('content.tips_li_1').split(':')[0]}</strong>
                  {': '}
                  {tTerms('content.tips_li_1').split(':').slice(1).join(':').trim()}
                </li>
                <li>
                  <strong>{tTerms('content.tips_li_2').split(':')[0]}</strong>
                  {': '}
                  {tTerms('content.tips_li_2').split(':').slice(1).join(':').trim()}
                </li>
                <li>
                  <strong>{tTerms('content.tips_li_3').split(':')[0]}</strong>
                  {': '}
                  {tTerms('content.tips_li_3').split(':').slice(1).join(':').trim()}
                </li>
                <li>
                  <strong>{tTerms('content.tips_li_4').split(':')[0]}</strong>
                  {': '}
                  {tTerms('content.tips_li_4').split(':').slice(1).join(':').trim()}
                </li>
                <li>
                  <strong>{tTerms('content.tips_li_5').split(':')[0]}</strong>
                  {': '}
                  {tTerms('content.tips_li_5').split(':').slice(1).join(':').trim()}
                </li>
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
              <div className="mt-4 rounded-xl border border-blue-300/30 bg-blue-300/10 p-4">
                <div className="font-semibold text-blue-100">{tTerms('content.callout_title')}</div>
                <p className="text-white/90 mt-1">{tTerms('content.callout_body')}</p>
              </div>
            </article>
          ) : (
            <article className="prose prose-invert prose-sm sm:prose-base max-w-none">
              <h1 className="mt-0">{tPrivacy('title')}</h1>
              <p className="text-white/70 -mt-3">{tPrivacy('subtitle')}</p>
              <p className="text-xs text-white/60">{tShared('updated')}: 30.08.2025</p>
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
              <div className="mt-4 rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-4">
                <div className="font-semibold text-yellow-100">{tPrivacy('content.callout_title')}</div>
                <p className="text-white/90 mt-1">{tPrivacy('content.callout_body')}</p>
              </div>
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
  ) : null;
}

/* ---------------- Page: Signup Account ---------------- */
export default function SignupAccountPage() {
  const sp = useSearchParams();
  const locale = useLocale();

  const t = useTranslations('auth.auth.signupAccount');
  const tv = useTranslations('auth.auth.signupAccount.emailVerify');
  const tRole = useTranslations('post.role');

  const handle = (sp.get('handle') || '').toLowerCase();
  const roleParam = sp.get('role');
  const role = roleParam === 'DOMME' || roleParam === 'SUBMISSIVE' ? roleParam : null;
  const isDomme = role === 'DOMME';

  const oauthMode = sp.get('oauth') === '1';
  const [oauthPendingEmail, setOauthPendingEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const match = document.cookie
      .split('; ')
      .find((row) => row.startsWith('subm8_oauth_pending='));
    if (!match) return;

    const value = match.split('=').slice(1).join('=');
    setOauthPendingEmail(decodeURIComponent(value));
  }, []);

  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [agree, setAgree] = React.useState(false);
  const [dommeGiftAgree, setDommeGiftAgree] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [verifyId, setVerifyId] = React.useState<string | null>(null);
  const [verifyCode, setVerifyCode] = React.useState('');
  const [verifyErr, setVerifyErr] = React.useState<string | null>(null);
  const [verifyBusy, setVerifyBusy] = React.useState(false);

  const [resendCooldownSec, setResendCooldownSec] = React.useState<number | null>(null);

  const [err, setErr] = React.useState<string | null>(null);

  const [legalOpen, setLegalOpen] = React.useState(false);
  const [legalTab, setLegalTab] = React.useState<LegalTab>('terms');

  // NEW: Domme-Disclaimer auf/zu
  const [dommeOpen, setDommeOpen] = React.useState(false);

  const ready =
    !!handle &&
    !!role &&
    agree &&
    (!isDomme || dommeGiftAgree) &&
    (
      oauthMode
        ? true
        : isValidEmail(email) && pw.length >= 8 && pw === pw2
    );

  // --- Splash Host & Portal-Container ---
  const [splashAlive, setSplashAlive] = React.useState(true);
  const hostRef = React.useRef<HTMLElement | null>(null);
  const portalContainerRef = React.useRef<HTMLDivElement | null>(null);

  // Lazy JSON (HMR-freundlich)
  const [animData, setAnimData] = React.useState<object | null>(null);
  React.useEffect(() => {
    let alive = true;
    import('@/lotties/heart-throw-Lottie.json')
      .then(m => alive && setAnimData((m).default ?? m))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Host finden, stabilen Child-Container anhängen & auf "done" hören
  React.useEffect(() => {
    const host = document.getElementById('boot-splash-lottie') as HTMLElement | null;
    hostRef.current = host;

    if (host && !portalContainerRef.current) {
      const el = document.createElement('div');
      el.style.width = '100%';
      el.style.height = '100%';
      el.setAttribute('data-portal-owner', 'signup-account');
      try { host.appendChild(el); } catch {}
      portalContainerRef.current = el;
    }

    const onDone = () => setSplashAlive(false);
    window.addEventListener('boot:splash-done', onDone, { once: true });

    return () => {
      window.removeEventListener('boot:splash-done', onDone);
      // defensives Cleanup (verhindert removeChild-Fehler bei HMR)
      const hostNow = hostRef.current;
      const el = portalContainerRef.current;
      if (hostNow && el && el.parentNode === hostNow) {
        try { hostNow.removeChild(el); } catch {}
      }
      portalContainerRef.current = null;
      hostRef.current = null;
    };
  }, []);

  // Event zum Layout schicken, sobald Lottie fertig
  const signalSplashDone = React.useCallback(() => {
    window.dispatchEvent(new Event('boot:splash-done'));
  }, []);

  const submit: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    if (!ready || loading) return;

    if (oauthMode) {
      await signInWithGoogle();
      return;
    }

    try {
      setLoading(true);
      setErr(null);

      const res = await fetch('/api/signup/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handle,
          role,
          email,
          password: pw,
          dommeGiftDisclaimerAccepted: isDomme ? true : undefined,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setErr(json?.error || `HTTP ${res.status}`);
        return;
      }

      if (json?.needsEmailVerify && typeof json?.verifyId === 'string') {
        setVerifyId(json.verifyId);
        setVerifyCode('');
        setVerifyErr(null);
        setVerifyOpen(true);
        return;
      }

      // fallback (falls du später provider signups hast)
      await signIn('credentials', {
        redirect: true,
        callbackUrl: `/${locale}`,
        identifier: isValidEmail(email) ? email : handle,
        password: pw,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : t('errors.signupFailed'));
    } finally {
      setLoading(false);
    }
  };

  const emailOk = email.length === 0 || isValidEmail(email);
  
  const signInWithGoogle = async () => {
    try {
      if (!handle || !role) {
        setErr(t('errors.signupFailed'));
        return;
      }

      setLoading(true);
      setErr(null);

      // Signup-Kontext serverseitig frisch setzen
      const res = await fetch('/api/signup/start', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          handle,
          role,
        }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok || !json?.ok) {
        setErr(json?.error || t('errors.signupFailed'));
        setLoading(false);
        return;
      }

      // Danach Google OAuth starten
      await signIn('google', {
        callbackUrl: `/${locale}`,
      });
    } catch (e) {
      console.error(e);
      setErr(t('errors.signupFailed'));
      setLoading(false);
    }
  };

  const roleLabel = isDomme ? tRole('domme') : tRole('submissive');

  const baseInput =
    'bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20';

  return (
    <div
      className="relative grid min-h-[100svh] place-items-center px-3 py-4
                 bg-[#0b0b0c] overflow-hidden rounded-none md:rounded-2xl
                 [background-image:radial-gradient(00%_40%_at_50%_0%,rgba(255,255,255,.08),transparent_60%)]"
    >
      {/* Lottie -> Splash hosten, nur solange Host lebt */}
      {(splashAlive &&
        animData &&
        hostRef.current?.isConnected &&
        portalContainerRef.current) &&
        createPortal(
          <Lottie
            animationData={animData}
            loop={false}
            autoplay
            onComplete={signalSplashDone}
            style={{ width: '100%', height: '100%' }}
          />,
          portalContainerRef.current
        )
      }
      {/* Blobs auf Mobile kleiner/versteckt */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 md:h-72 md:w-72 rounded-full bg-purple-500/20 blur-3xl hidden sm:block" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 md:h-80 md:w-80 rounded-full bg-purple-500/20 blur-[90px] hidden sm:block" />

      <div className="w-full max-w-[380px] sm:max-w-md">
        <Card className="rounded-2xl bg-[rgba(162,89,255,0.12)] backdrop-blur-xl ring-1 ring-white/20 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
                  <CardContent
                              className="p-5 sm:p-6 md:p-8 pt-3 sm:pt-1 md:pt-2
                                         bg-[rgba(0,0,0,0.7)]
                                         overflow-visible
                                         sm:max-h-[92svh] sm:overflow-auto sm:overscroll-contain"
                            >
            {/* Header */}
            <div className="text-center mb-6 sm:mb-6">
              <div className="flex justify-center mb-2 sm:mb-3">
                <Image
                                  src="/logo-bigger.png"
                                  alt='Subm8 logo'
                                  width={120}
                                  height={36}
                                  priority
                                  className="h-7 sm:h-10 w-auto drop-shadow-md"
                                />
              </div>
              <div className="text-[13px] sm:text-sm text-white/70">{t('headerTop')}</div>
              <h1 className="text-white text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight mt-1 leading-tight">
                {t('headerTitle')}
              </h1>
              <p className="mt-2 text-[13px] sm:text-sm text-white/80">
                @{handle} · {roleLabel}
              </p>
            </div>

            {/* Domme Disclaimer – einklappbar */}
            {isDomme && (
              <div className="mt-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10">
                <div className="p-4 pb-2">
                  <div className="font-semibold text-yellow-100 text-sm sm:text-base">
                    ⚠️ {t('dommeDisclaimer.title')}
                    <ul className="text-[13px] sm:text-sm text-white/85 list-disc pl-5 space-y-1">
                        <li>{t('dommeDisclaimer.li1')}</li>
                    </ul>    
                  </div>

                  {/* Collapsible area: nur die Liste ist einklappbar */}
                  {dommeOpen ? (
                    <div className="mt-3">
                      <ul className="text-[13px] sm:text-sm text-white/85 list-disc pl-5 space-y-1">
                        <li>{t('dommeDisclaimer.li1')}</li>
                        <li>{t('dommeDisclaimer.li2')}</li>
                        <li>{t('dommeDisclaimer.li3')}</li>
                        <li>{t('dommeDisclaimer.li4')}</li>
                      </ul>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setDommeOpen(false)}
                          className="text-[12px] sm:text-sm underline text-yellow-100 hover:text-white"
                        >
                          {t('dommeDisclaimer.readLess')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() => setDommeOpen(true)}
                        className="text-[12px] sm:text-sm underline text-yellow-100 hover:text-white 
                                  py-2 px-1 rounded-md active:bg-white/10"
                      >
                        {t('dommeDisclaimer.readMore')}
                      </button>
                    </div>
                  )}

                  {/* Checkbox bleibt immer sichtbar */}
                  <label
                    className="mt-3 flex items-start gap-3 p-3 rounded-lg cursor-pointer 
                              hover:bg-white/5 active:bg-white/10 transition"
                  >
                    <input
                      type="checkbox"
                      className="accent-[var(--purple)] w-5 h-5"
                      checked={dommeGiftAgree}
                      onChange={(e) => setDommeGiftAgree(e.target.checked)}
                    />
                    <span className="text-[13px] sm:text-sm text-white/90">{t('dommeDisclaimer.checkbox')}</span>
                  </label>
                </div>
              </div>
            )}

            {/* Formular */}
            <form className="mt-6 space-y-4 sm:space-y-5" onSubmit={submit} noValidate>
              <div>
                {oauthMode ? (
                  <div className="rounded-xl border border-blue-300/40 bg-blue-300/15 p-3 text-[13px] sm:text-sm text-blue-100">
                    {oauthPendingEmail ? (
                      <>Google account: <strong>{oauthPendingEmail}</strong></>
                    ) : (
                      <>Google account will be used for this signup.</>
                    )}
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium mb-1 text-white/90">
                        {t('fields.email.label')}
                      </label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('fields.email.placeholder')}
                        autoComplete="email"
                        required
                        aria-invalid={email.length > 0 && !emailOk ? true : undefined}
                        className={`${baseInput} h-10 sm:h-11 ${email.length > 0 && !emailOk ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                      />
                      {email.length > 0 && !emailOk && (
                        <div className="mt-1 text-[12px] text-red-300">
                          {t('errors.emailInvalid', { default: 'Please enter a valid email address.' })}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium mb-1 text-white/90">
                        {t('fields.password.label')}
                      </label>
                      <Input
                        type="password"
                        value={pw}
                        onChange={(e) => setPw(e.target.value)}
                        placeholder={t('fields.password.placeholder')}
                        className={`${baseInput} h-10 sm:h-11`}
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                      <div className="mt-1 text-[12px] text-white/70">{t('fields.password.help')}</div>
                    </div>

                    <div>
                      <label className="block text-[13px] sm:text-sm font-medium mb-1 text-white/90">
                        {t('fields.password2.label')}
                      </label>
                      <Input
                        type="password"
                        value={pw2}
                        onChange={(e) => setPw2(e.target.value)}
                        className={`${baseInput} h-10 sm:h-11`}
                        autoComplete="new-password"
                        required
                        minLength={8}
                      />
                      {pw2.length > 0 && pw !== pw2 && (
                        <div className="mt-1 text-[12px] text-red-300">{t('errors.passwordMismatch')}</div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <label className="flex items-start gap-2 text-[13px] sm:text-sm text-white/90">
                <input
                  type="checkbox"
                  className="accent-[var(--purple)] mt-[3px]"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  {t('agree').split('Terms')[0]}
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
                  {t('agree').split('Terms')[1]?.split('Privacy Policy')[0] ?? ' & '}
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
                  {t('agree').split('Privacy Policy')[1] ?? '.'}
                </span>
              </label>

              {err && <div className="text-sm text-red-300">{err}</div>}

              <div className="space-y-3">
                {!oauthMode && (
                  <button
                    type="submit"
                    disabled={!ready || loading}
                    className="w-full rounded-full py-3 sm:py-3.5 text-[16px] min-h-[48px] sm:text-base font-semibold
                              bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                              disabled:opacity-50 disabled:cursor-not-allowed
                              transition-colors"
                  >
                    {loading ? t('buttons.creating') : t('buttons.create')}
                  </button>
                )}

                <button
                  type={oauthMode ? 'submit' : 'button'}
                  onClick={oauthMode ? undefined : signInWithGoogle}
                  disabled={loading || !handle || !role || !agree || (isDomme && !dommeGiftAgree)}
                  className="w-full rounded-full py-3 text-[15px] min-h-[48px] sm:text-sm font-medium
                            border border-white/20 bg-black/20 hover:bg-black/30
                            disabled:opacity-50 disabled:cursor-not-allowed
                            transition-colors"
                >
                  {t('buttons.google')}
                </button>
              </div>

              <div className="text-center text-[13px] sm:text-sm text-white/80">
                {t('login.cta')}{' '}
                <Link
                  href={`/${locale}/signin`}
                  className="text-purple-200 hover:text-purple-100 underline"
                  prefetch={false}
                >
                  {t('login.link')}
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      {verifyOpen && verifyId && (
        <div
          className="fixed inset-0 z-[200] grid place-items-center p-4"
          onClick={() => !verifyBusy && setVerifyOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-[360px] rounded-2xl border border-white/10 bg-[#0b0b0d] p-5 shadow-[0_18px_50px_-14px_rgba(0,0,0,.65)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold text-white">{tv('title')}</div>
              <button
                type="button"
                className="w-9 h-9 rounded-full hover:bg-white/10 text-white/80"
                onClick={() => !verifyBusy && setVerifyOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="mt-2 text-[13px] text-white/70">
              {tv('subtitle', { email })}
            </div>

            <input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoFocus
              placeholder={tv('codePlaceholder')}
              className="mt-4 w-full rounded-xl bg-white/[.03] border border-white/10 px-3 py-3 text-[18px] tracking-[0.3em] text-white outline-none"
            />

            {verifyErr && (
              <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                {verifyErr}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between gap-2">
              {/* ✅ RESEND */}
              <button
                type="button"
                disabled={verifyBusy}
                className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 text-[13px] disabled:opacity-60"
                onClick={async () => {
                  setVerifyBusy(true);
                  setVerifyErr(null);

                  try {
                    const r = await fetch('/api/auth/resend-verify-email', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ email, locale }), // ✅ verifyId NICHT senden
                    });

                    const j = await r.json().catch(() => null);

                    // ✅ Cooldown sauber (429)
                    if (r.status === 429 && j?.cooldown && typeof j?.retryAfterSec === 'number') {
                      setResendCooldownSec(j.retryAfterSec);
                      setVerifyErr(tv('alerts.cooldown', { seconds: j.retryAfterSec }));
                      return;
                    }

                    if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);

                    // ✅ Resend gibt neue verifyId zurück -> update
                    if (typeof j?.verifyId === 'string') setVerifyId(j.verifyId);

                    setResendCooldownSec(null);
                    setVerifyErr(null);
                  } catch (e) {
                    setVerifyErr(e instanceof Error ? e.message : tv('errors.resendFailed'));
                  } finally {
                    setVerifyBusy(false);
                  }
                }}
              >
                {verifyBusy ? tv('actions.resending') : tv('actions.resend')}
              </button>

              {/* ✅ VERIFY */}
              <button
                type="button"
                disabled={verifyBusy || verifyCode.length !== 6}
                className="px-4 py-2 rounded-lg bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white text-[13px] disabled:opacity-60"
                onClick={async () => {
                  setVerifyBusy(true);
                  setVerifyErr(null);

                  try {
                    const r = await fetch('/api/auth/verify-email', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ verifyId, email, code: verifyCode }),
                    });

                    const j = await r.json().catch(() => null);
                    if (!r.ok || !j?.ok) throw new Error(j?.error || tv('errors.wrongCode'));

                    // ✅ verified -> sign in
                    await signIn('credentials', {
                      redirect: true,
                      callbackUrl: `/${locale}`,
                      identifier: email,
                      password: pw,
                    });
                  } catch (e) {
                    setVerifyErr(e instanceof Error ? e.message : tv('errors.verifyFailed'));
                  } finally {
                    setVerifyBusy(false);
                  }
                }}
              >
                {verifyBusy ? tv('actions.verifying') : tv('actions.verify')}
              </button>
            </div>

            {resendCooldownSec !== null && (
              <div className="mt-3 text-[12px] text-yellow-200">
                {tv('alerts.cooldown', { seconds: resendCooldownSec })}
              </div>
            )}

            <div className="mt-3 text-[12px] text-white/55">
              {tv('hintExpires', { minutes: 10 })}
            </div>
          </div>
        </div>
      )}
      <TermsPrivacyModal open={legalOpen} onClose={() => setLegalOpen(false)} initialTab={legalTab} />
    </div>
  );
}
