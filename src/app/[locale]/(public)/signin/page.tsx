// src/app/[locale]/signin/page.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { startAuthentication } from '@simplewebauthn/browser';

// Lottie nur clientseitig laden
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
// JSON direkt importieren (stelle sicher, dass "resolveJsonModule": true in tsconfig ist)
import heartThrow from '@/lotties/heart-throw-Lottie.json';

// shadcn/ui
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

type TwoFAMethod = 'passkey' | 'sms';

export default function SignInPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  // i18n
  const t = useTranslations('auth.auth.signin');
  const tc = useTranslations('common');
  const t2fa = useTranslations('auth.auth.signin2fa');
  const tv = useTranslations('auth.auth.signupAccount.emailVerify');

  const preset = sp.get('email') ?? sp.get('handle')?.replace(/^@/, '') ?? '';

  const registered = sp.get('registered') === '1';
  const resetSuccess = sp.get('reset') === 'success';
  const topErrorMsg = sp.get('error');
  const topPretty = mapAuthError(topErrorMsg);

  const [identifier, setIdentifier] = React.useState(preset);
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const [invalid, setInvalid] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);
  const [needsEmailVerify, setNeedsEmailVerify] = React.useState(false);
  const [resendBusy, setResendBusy] = React.useState(false);
  const [resendOk, setResendOk] = React.useState(false);

  const [verifyOpen, setVerifyOpen] = React.useState(false);
  const [verifyId, setVerifyId] = React.useState<string | null>(null);
  const [verifyCode, setVerifyCode] = React.useState('');
  const [verifyBusy, setVerifyBusy] = React.useState(false);
  const [verifyErr, setVerifyErr] = React.useState<string | null>(null);
  const [resendCooldownSec, setResendCooldownSec] = React.useState<number | null>(null);
  const [verifyEmail, setVerifyEmail] = React.useState<string | null>(null);

  // "Passwort vergessen" State
  const [forgotMode, setForgotMode] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [forgotDone, setForgotDone] = React.useState(false);

  // ------ 2FA Modal State ------
  const [show2FA, setShow2FA] = React.useState(false);
  const [twoFAMethods, setTwoFAMethods] = React.useState<TwoFAMethod[]>([]);
  const [chosen, setChosen] = React.useState<TwoFAMethod | null>(null);
  const [twoFABusy, setTwoFABusy] = React.useState(false);
  const [smsCode, setSmsCode] = React.useState('');
  const [twoFAError, setTwoFAError] = React.useState<string | null>(null);
  const [smsSent, setSmsSent] = React.useState(false);
  const [showBruteModal, setShowBruteModal] = React.useState(false);
  const [bruteInfo, setBruteInfo] = React.useState<{ ok?: boolean; reason?: 'temp' | 'perm'; until?: string | null } | null>(null);

  // ---- Splash-Portal-Ziel finden (SSR-Splash im Layout) ----
  const [splashHost, setSplashHost] = React.useState<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  function mapAuthError(code?: string | null) {
    if (!code) return null;

    if (code === 'BRUTE_BLOCK') {
      return t('alerts.bruteBlocked', { contact: 'support@subm8.com' });
    }
    if (code === 'EMAIL_NOT_VERIFIED') {
      return t('errors.emailNotVerified'); // i18n key gleich unten ergänzen
    }
    if (code === 'CredentialsSignin') {
      return t('errors.invalidCredentials');
    }
    if (code === 'ACCOUNT_DEACTIVATED') {
      return t('alerts.deactivated');
    }

    //Google OAuth kein Account vorhanden
    if (code === 'OAuthAccountNotLinked') {
      return t('errors.oauthAccountNotLinked');
    }

    return code;
  }

  React.useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;

    const isAuthScope = document.body?.dataset?.scope === 'auth';
    const pathOk = /\/[^/]+\/(signin|signup)(\?|$)/.test(location.pathname);
    const el = document.getElementById('boot-splash-lottie') as HTMLElement | null;

    // Harte Guards
    if (!isAuthScope || !pathOk || !el) {
      setSplashHost(null);
      return;
    }
    setSplashHost(el);

    return () => setSplashHost(null);
  }, []);

  // ---- Event senden: Layout blendet SSR-Splash aus ----
  const signalSplashDone = React.useCallback(() => {
    window.dispatchEvent(new Event('boot:splash-done'));
  }, []);

  function resetAll() {
    setIdentifier('');
    setPassword('');
    setShow2FA(false);
    setTwoFAMethods([]);
    setChosen(null);
    setTwoFABusy(false);
    setSmsCode('');
    setSmsSent(false);
  }

  async function fetchTwoFAStatus(): Promise<{ needed: boolean; methods: TwoFAMethod[] }> {
    const res = await fetch('/api/2fa/status', {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return { needed: false, methods: [] };
    return res.json();
  }

  async function runPasskey() {
    try {
      setTwoFABusy(true);
      setTwoFAError(null);
      const optRes = await fetch('/api/2fa/passkey/authentication-options', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      });
      if (!optRes.ok) throw new Error('options_failed');
      const optionsJSON = await optRes.json();
      const assertion = await startAuthentication(optionsJSON);
      const verifyRes = await fetch('/api/2fa/passkey/authentication-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) {
        const j = await verifyRes.json().catch(() => ({}));
        throw new Error(j?.error || 'verify_failed');
      }
      router.replace(`/${locale}`);
    } catch {
      setTwoFAError(t2fa('errors.passkeyFailed'));
      resetAll();
      setInvalid(true);
      setInlineError(t('errors.invalidCredentials'));
    } finally {
      setTwoFABusy(false);
    }
  }

  async function sendSms() {
    try {
      setTwoFABusy(true);
      setTwoFAError(null);
      const r = await fetch('/api/2fa/sms/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error || 'sms_start_failed');
      setSmsSent(true);
    } catch {
      setTwoFAError(t2fa('errors.smsSendFailed'));
      resetAll();
      setInvalid(true);
      setInlineError(t('errors.invalidCredentials'));
    } finally {
      setTwoFABusy(false);
    }
  }

  async function verifySms() {
    try {
      if (!/^\d{6}$/.test(smsCode)) {
        setTwoFAError(t2fa('errors.codeFormat'));
        return;
      }
      setTwoFABusy(true);
      setTwoFAError(null);
      const r = await fetch('/api/2fa/sms/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: smsCode }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) throw new Error(j?.error || 'sms_verify_failed');
      router.replace(`/${locale}`);
    } catch {
      setTwoFAError(t2fa('errors.codeInvalid'));
      resetAll();
      setInvalid(true);
      setInlineError(t('errors.invalidCredentials'));
    } finally {
      setTwoFABusy(false);
    }
  }

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setInvalid(false);
    setInlineError(null);

    try {
      const twoFAReq = fetchTwoFAStatus();
      const res = await signIn('credentials', {
        redirect: false,
        callbackUrl: `/${locale}`,
        identifier,
        password,
      });

      if (res?.error) {
        //Email verify Edge-Case: Passwort korrekt, aber email noch nicht verified
        if (res.error === 'EMAIL_NOT_VERIFIED') {
          setNeedsEmailVerify(true);
          setInvalid(true);
          setInlineError(t('errors.emailNotVerified'));
          return;
        }

        await twoFAReq;
        try {
          const r = await fetch(`/api/auth/brute-status?identifier=${encodeURIComponent(identifier)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            credentials: 'include',
          });
          const j: { ok: boolean; reason?: 'temp'|'perm'; until?: string|null } = await r.json();

          // wenn Block aktiv → show modal (große Warnung)
          if (!j.ok) {
            setBruteInfo(j);
            setShowBruteModal(true);
            // optional: markiere Felder als invalid damit rote Rahmen bleiben
            setInvalid(true);
            return;
          }

          // Nicht geblockt → normaler Invalid-Creds-Fall
          setInvalid(true);
          setInlineError(t('errors.invalidCredentials'));
          return;
        } catch {
          // Fallback: wenn Status-Call schiefgeht
          setInvalid(true);
          setInlineError(t('errors.invalidCredentials'));
          return;
        }
      }

      // Erfolgsweg wie gehabt:
      const status = await fetchTwoFAStatus();
      if (!status.needed || status.methods.length === 0) {
        const url = res?.url ?? `/${locale}`;
        router.replace(url);
        return;
      }
      setTwoFAMethods(status.methods);
      setChosen(status.methods.length === 1 ? status.methods[0] : null);
      setShow2FA(true);
      if (status.methods.length === 1 && status.methods[0] === 'passkey') await runPasskey();
      if (status.methods.length === 1 && status.methods[0] === 'sms') await sendSms();
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (forgotLoading) return;
    setForgotLoading(true);
    setForgotDone(false);

    try {
      await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail, locale }),
      });
      setForgotDone(true);
    } finally {
      setForgotLoading(false);
    }
  }

  const baseInput =
    'bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20';

  return (
    <div
      className="relative grid min-h-[100svh] place-items-center px-3 py-4
                 bg-[#0b0b0c] overflow-hidden rounded-none md:rounded-2xl
                 [background-image:radial-gradient(00%_40%_at_50%_0%,rgba(255,255,255,.08),transparent_60%)]"
    >
      {/* Lottie wird in den SSR-Splash (Layout) portaliert */}
      {mounted && splashHost &&
        createPortal(
          <Lottie
            key="boot-splash"
            animationData={heartThrow as unknown as object}
            loop={false}
            autoplay
            onComplete={signalSplashDone}
            style={{ width: '100%', height: '100%' }}
          />,
          splashHost
        )
      }

      {/* dekorative Blobs */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 md:h-72 md:w-72 rounded-full bg-purple-500/20 blur-3xl hidden sm:block" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 md:h-80 md:w-80 rounded-full bg-purple-500/20 blur-[90px] hidden sm:block" />

      {/* --- ab hier DEINE bestehende Sign-in Card --- */}
      <div className="w-full max-w-[380px] sm:max-w-md">
        <Card className="rounded-2xl bg-[rgba(162,89,255,0.12)] backdrop-blur-xl ring-1 ring-white/20 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <CardContent
            className="p-5 sm:p-6 md:p-8 pt-3 sm:pt-1 md:pt-2
                       bg-[rgba(0,0,0,0.7)]
                       overflow-visible
                       sm:max-h-[92svh] sm:overflow-auto sm:overscroll-contain"
          >
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex justify-center mb-1 sm:mb-2">
                <Image
                  src="/logo-bigger.png"
                  alt={`${tc('brand.name')} logo`}
                  width={120}
                  height={36}
                  priority
                  className="h-7 sm:h-8 w-auto drop-shadow-md"
                />
              </div>
              <p className="text-white/80 mb-1 sm:mb-2 text-[13px] sm:text-sm">
                {t('welcome', { brand: tc('brand.name') })}
              </p>
              <div className="mb-1 sm:mb-2">
                <Image
                  src="/Sub m8.png"
                  alt={`${tc('brand.name')} logo`}
                  width={240}
                  height={80}
                  priority
                  className="mx-auto w-[180px] sm:w-[220px] md:w-[240px] h-auto"
                />
              </div>
              <p className="text-white/70 text-[13px] sm:text-sm">{t('title')}</p>
            </div>

            {(registered || topPretty || resetSuccess) && (
              <div
                className={`mb-4 sm:mb-5 rounded-xl border p-2.5 sm:p-3 text-[13px] sm:text-sm
                ${registered
                    ? 'border-blue-300/40 bg-blue-300/15 text-blue-100'
                    : resetSuccess
                      ? 'border-green-400/40 bg-green-400/15 text-green-100'
                      : 'border-red-400/40 bg-red-400/15 text-red-100'}`}
              >
                {registered ? (
                  t('alerts.registered')
                ) : resetSuccess ? (
                  t('alerts.resetSuccess')
                ) : topPretty ? (
                  <div className="space-y-1.5">
                    <div>{topPretty}</div>

                    {topErrorMsg === 'OAuthAccountNotLinked' && (
                      <Link
                        href={`/${locale}/signup${preset ? `?email=${encodeURIComponent(preset)}` : ''}`}
                        className="underline text-red-100 hover:text-white"
                        prefetch={false}
                      >
                        {t('errors.oauthAccountNotLinkedCta')}
                      </Link>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {!forgotMode ? (
              <form onSubmit={handleCredentials} className="space-y-4 sm:space-y-5" noValidate>
                <div>
                  <label htmlFor="identifier" className="block text-[13px] sm:text-sm font-medium mb-1 text-white/90">
                    {t('fields.identifier.label')}
                  </label>
                  <Input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => { 
                      setIdentifier(e.target.value);
                      //reset verify context when user changes identifier
                      setVerifyEmail(null);
                      setVerifyId(null);
                      setVerifyOpen(false);
                      setVerifyCode('');
                      setVerifyErr(null);

                      if (invalid) {
                        setInvalid(false);
                        setInlineError(null);
                      }
                      setNeedsEmailVerify(false);
                      setResendOk(false);
                    }}
                    type="text"
                    autoComplete="username"
                    required
                    placeholder={t('fields.identifier.placeholder')}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? 'identifier-error' : undefined}
                    className={`${baseInput} h-10 sm:h-11 ${invalid ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                  />
                  {invalid && (
                    <p id="identifier-error" className="mt-1 text-[12px] text-red-300">{inlineError}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-[13px] sm:text-sm font-medium mb-1 text-white/90">
                    {t('fields.password.label')}
                  </label>
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => { 
                      setPassword(e.target.value); 
                      if (invalid) { 
                        setInvalid(false); 
                        setInlineError(null); 
                      } 
                      setNeedsEmailVerify(false); 
                      setResendOk(false);}}
                    type="password"
                    autoComplete="current-password"
                    required
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? 'password-error' : undefined}
                    className={`${baseInput} h-10 sm:h-11 ${invalid ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                  />
                  {invalid && (
                    <p id="password-error" className="mt-1 text-[12px] text-red-300">{inlineError}</p>
                  )}
                  <div className="mt-1 text-right">
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-[11px] sm:text-xs text-purple-200 hover:text-purple-100 underline"
                    >
                      {t('forgot.link')}
                    </button>
                  </div>
                </div>

                {needsEmailVerify && (
                  <div className="mt-2 rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-3">
                    <div className="text-[13px] text-yellow-100">
                      {t('errors.emailNotVerified')}
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={resendBusy}
                        onClick={async () => {
                          try {
                            setResendBusy(true);
                            setResendOk(false);

                            // Modal errors zurücksetzen
                            setVerifyErr(null);

                            const r = await fetch('/api/auth/resend-verify-email', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email: identifier, locale }),
                            });

                            const j = await r.json().catch(() => ({}));
                            setVerifyEmail(null);

                            // ✅ Cooldown sauber
                            if (r.status === 429 && j?.cooldown && typeof j?.retryAfterSec === 'number') {
                              setResendCooldownSec(j.retryAfterSec);
                              setInlineError(tv('alerts.cooldown', { seconds: j.retryAfterSec }));
                              setInvalid(false);
                              return;
                            }

                            if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);

                            // ✅ verifyId übernehmen und Modal öffnen
                            if (typeof j?.verifyId === 'string') setVerifyId(j.verifyId);
                            if (typeof j?.emailUsed === 'string') setVerifyEmail(j.emailUsed);
                            setVerifyCode('');
                            setVerifyErr(null);
                            setVerifyOpen(true);

                            setResendCooldownSec(null);
                            setResendOk(true);
                          } catch (e) {
                            setInlineError(e instanceof Error ? e.message : t('errors.verifyResendFailed'));
                          } finally {
                            setResendBusy(false);
                          }
                        }}
                        className="rounded-full px-4 py-2 text-[13px] font-medium border border-white/20 bg-black/20 hover:bg-black/30 disabled:opacity-60"
                      >
                        {resendBusy ? t('actions.sending') : t('actions.resendCode')}
                      </button>

                      {resendOk && (
                        <span className="text-[12px] text-green-200">
                          {t('alerts.verifyCodeSent')}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-2.5 sm:py-3 text-[15px] sm:text-base font-semibold
                             bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                             disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? t('buttons.submitLoading') : t('buttons.submit')}
                </button>

                <div className="text-center text-[12px] sm:text-xs text-white/60">{t('or')}</div>

                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl: `/${locale}` })}
                  className="w-full rounded-full py-2 text-[14px] sm:text-sm font-medium mt-1
                            border border-white/20 bg-black/20 hover:bg-black/30 transition-colors"
                >
                  {t('buttons.google')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4 sm:space-y-5" noValidate>
                {!forgotDone ? (
                  <>
                    <div>
                      <label htmlFor="forgotEmail" className="block text-[13px] sm:text-sm font-medium mb-1 text-white/90">
                        {t('forgot.emailLabel')}
                      </label>
                      <Input
                        id="forgotEmail"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        type="email"
                        required
                        placeholder={t('forgot.emailPlaceholder')}
                        className={`${baseInput} h-10 sm:h-11`}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full rounded-full py-2.5 sm:py-3 text-[15px] sm:text-base font-semibold
                                 bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                                 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {forgotLoading ? t('forgot.submitLoading') : t('forgot.submit')}
                    </button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setForgotMode(false)}
                        className="text-[11px] sm:text-xs text-purple-200 hover:text-purple-100 underline"
                      >
                        {t('forgot.back')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-green-100 text-[13px] sm:text-sm">
                    {t('forgot.success')}
                  </p>
                )}
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-white/10 text-center text-[13px] sm:text-sm text-white/80">
              {t('signup.cta')}{' '}
              <Link
                href={`/${locale}/signup`}
                className="text-purple-200 hover:text-purple-100 underline"
                prefetch={false}
              >
                {t('signup.link')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* --- BRUTE / BLOCK Modal --- */}
      {showBruteModal && bruteInfo && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => { /* Klick auf Overlay schließt modal nicht automatisch */ }}
          />
          <div className="relative z-10 w-full max-w-3xl mx-auto rounded-3xl border border-red-400/30 bg-[#1a0b0f] p-6 sm:p-8 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="h-14 w-14 rounded-full bg-red-600/20 flex items-center justify-center ring-1 ring-red-400/30">
                  <svg className="h-8 w-8 text-red-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v4" strokeLinecap="round" strokeLinejoin="round"/><path d="M12 17h.01" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
              </div>

              <div className="min-w-0">
                <h2 className="text-2xl font-semibold text-red-100 mb-2">
                  {bruteInfo.reason === 'perm' ? t('alerts.bruteBlockedPermanent') : t('alerts.bruteBlocked')}
                </h2>

                {bruteInfo.reason === 'temp' && bruteInfo.until ? (
                  (() => {
                    const untilDate = new Date(bruteInfo.until);
                    const mins = Math.max(1, Math.ceil((+untilDate - Date.now()) / 60000));
                    return (
                      <p className="text-sm text-red-200 mb-4">
                        {t('alerts.bruteBlockedUntilMins', { minutes: mins })}
                      </p>
                    );
                  })()
                ) : (
                  <p className="text-sm text-red-200 mb-4">
                    {t('alerts.bruteBlocked', { contact: 'support@subm8.com' })}
                  </p>
                )}

                <div className="flex gap-3 flex-col sm:flex-row">
                  <a
                    href={`mailto:support@subm8.com?subject=${encodeURIComponent('Account lock / support')}`}
                    className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium bg-red-600/80 hover:bg-red-600 text-white shadow-sm"
                  >
                    {t('actions.contactSupport') ?? 'Kontakt Support'}
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      setShowBruteModal(false);
                      setBruteInfo(null);
                      // optional: clear password field so user must re-type
                      setPassword('');
                    }}
                    className="inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium border border-white/10 bg-white/5 hover:bg-white/10 text-white"
                  >
                    {t('actions.close') ?? 'Schließen'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 2FA Modal */}
      {show2FA && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div className="w-full max-w-[380px] sm:max-w-md rounded-2xl border border-white/20
                          bg-zinc-900/90 backdrop-blur-xl p-4 sm:p-5">
            <div className="mb-3">
              <h3 className="text-lg font-semibold text-white">{t2fa('title')}</h3>
              <p className="text-sm text-white/70">
                {t2fa('subtitle')}
              </p>
            </div>

            {twoFAError && (
              <div className="mb-3 rounded-lg border border-red-400/40 bg-red-400/15 text-red-100 p-2 text-sm">
                {twoFAError}
              </div>
            )}

            {chosen === null && twoFAMethods.length > 1 && (
              <div className="mb-4 space-y-2">
                <p className="text-sm text-white/80">{t2fa('chooseMethod')}</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setChosen('passkey')}
                    className="flex-1 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 px-3 py-2 text-sm"
                  >
                    {t2fa('passkeyButton')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setChosen('sms'); void sendSms(); }}
                    className="flex-1 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 px-3 py-2 text-sm"
                  >
                    {t2fa('smsButton')}
                  </button>
                </div>
              </div>
            )}

            {chosen === 'passkey' && (
              <div className="space-y-3">
                <p className="text-sm text-white/70">
                  {t2fa('passkeyIntro')}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={runPasskey}
                    disabled={twoFABusy}
                    className="flex-1 rounded-full bg-[var(--purple)]/80 hover:bg-[var(--purple)] px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    {twoFABusy ? t2fa('verifying') : t2fa('confirmPasskey')}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShow2FA(false); }}
                    className="rounded-full border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
                  >
                    {tc('actions.cancel')}
                  </button>
                </div>
              </div>
            )}

            {chosen === 'sms' && (
              <div className="space-y-3">
                {!smsSent ? (
                  <button
                    type="button"
                    onClick={sendSms}
                    disabled={twoFABusy}
                    className="w-full rounded-full bg-[var(--purple)]/80 hover:bg-[var(--purple)] px-4 py-2 font-semibold disabled:opacity-50"
                  >
                    {twoFABusy ? t2fa('sending') : t2fa('sendSms')}
                  </button>
                ) : (
                  <>
                    <div>
                      <label htmlFor="smsCode" className="block text-sm font-medium mb-1 text-white/90">
                        {t2fa('smsCodeLabel')}
                      </label>
                      <Input
                        id="smsCode"
                        value={smsCode}
                        onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        inputMode="numeric"
                        placeholder={t2fa('smsCodePlaceholder')}
                        className="bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={verifySms}
                        disabled={twoFABusy || smsCode.length !== 6}
                        className="flex-1 rounded-full bg-[var(--purple)]/80 hover:bg-[var(--purple)] px-4 py-2 font-semibold disabled:opacity-50"
                      >
                        {twoFABusy ? t2fa('verifying') : t2fa('verifySms')}
                      </button>
                      <button
                        type="button"
                        onClick={sendSms}
                        disabled={twoFABusy}
                        className="rounded-full border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
                      >
                        {t2fa('resendSms')}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShow2FA(false); }}
                        className="rounded-full border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 text-sm"
                      >
                        {tc('actions.cancel')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ✅ EMAIL VERIFY MODAL (Signin) */}
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
              {tv('subtitle', { email: verifyEmail ?? identifier })}
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
                  if (verifyBusy) return;
                  setVerifyBusy(true);
                  setVerifyErr(null);

                  try {
                    const r = await fetch('/api/auth/resend-verify-email', {
                      method: 'POST',
                      headers: { 'content-type': 'application/json' },
                      body: JSON.stringify({ email: identifier, locale }),
                    });
                    const j = await r.json().catch(() => null);

                    if (r.status === 429 && j?.cooldown && typeof j?.retryAfterSec === 'number') {
                      setResendCooldownSec(j.retryAfterSec);
                      setVerifyErr(tv('alerts.cooldown', { seconds: j.retryAfterSec }));
                      return;
                    }

                    if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);

                    if (typeof j?.verifyId === 'string') setVerifyId(j.verifyId);
                    if (typeof j?.emailUsed === 'string') setVerifyEmail(j.emailUsed);

                    setResendCooldownSec(null);
                    // optional: Code-Feld leeren nach neuem Code
                    setVerifyCode('');
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
                      body: JSON.stringify({ verifyId, email: verifyEmail ?? identifier, code: verifyCode }),
                    });

                    const j = await r.json().catch(() => null);
                    if (!r.ok || !j?.ok) throw new Error(j?.error || tv('errors.wrongCode'));

                    // ✅ verified -> try sign in again
                    const res = await signIn('credentials', {
                      redirect: false,
                      callbackUrl: `/${locale}`,
                      identifier,
                      password,
                    });

                    if (res?.error) throw new Error(res.error);

                    setVerifyOpen(false);
                    router.replace(res?.url ?? `/${locale}`);
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

    </div>
  );
}
