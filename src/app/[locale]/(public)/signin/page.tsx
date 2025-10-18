// src/app/[locale]/signin/page.tsx
'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { startAuthentication } from '@simplewebauthn/browser';

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

  const preset =
    sp.get('email') ??
    sp.get('handle')?.replace(/^@/, '') ??
    '';

  const registered = sp.get('registered') === '1';
  const resetSuccess = sp.get('reset') === 'success';
  const topErrorMsg = sp.get('error');

  const [identifier, setIdentifier] = React.useState(preset);
  const [password, setPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const [invalid, setInvalid] = React.useState(false);
  const [inlineError, setInlineError] = React.useState<string | null>(null);

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

  async function fetchTwoFAStatus(): Promise<{needed:boolean; methods: TwoFAMethod[]}> {
    const res = await fetch('/api/2fa/status', {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'include',
    });
    if (!res.ok) return { needed: false, methods: [] };
    return res.json();
  }

  async function runPasskey() {
    try {
      setTwoFABusy(true);
      setTwoFAError(null);

      // 1) Optionen holen
      const optRes = await fetch('/api/2fa/passkey/authentication-options', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (!optRes.ok) throw new Error('options_failed');
      const optionsJSON = await optRes.json();

      // 2) WebAuthn-Dialog
      const assertion = await startAuthentication(optionsJSON);

      // 3) Verify
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
    } catch{
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
    } catch{
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
      const res = await signIn('credentials', {
        redirect: false,
        callbackUrl: `/${locale}`,
        identifier,
        password,
      });

      if (res?.error) {
        setInvalid(true);
        setInlineError(t('errors.invalidCredentials'));
        return;
      }

      // 2FA-Status
      const status = await fetchTwoFAStatus();

      if (!status.needed || status.methods.length === 0) {
        const url = res?.url ?? `/${locale}`;
        router.replace(url);
        return;
      }

      setTwoFAMethods(status.methods);
      setChosen(status.methods.length === 1 ? status.methods[0] : null);
      setShow2FA(true);

      if (status.methods.length === 1 && status.methods[0] === 'passkey') {
        await runPasskey();
      }
      if (status.methods.length === 1 && status.methods[0] === 'sms') {
        await sendSms();
      }
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
      {/* dekorative Blobs auf Mobile kleiner/weg */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-48 w-48 md:h-72 md:w-72 rounded-full bg-purple-500/20 blur-3xl hidden sm:block" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-56 w-56 md:h-80 md:w-80 rounded-full bg-purple-500/20 blur-[90px] hidden sm:block" />

      <div className="w-full max-w-[380px] sm:max-w-md">
        <Card className="rounded-2xl bg-[rgba(162,89,255,0.12)] backdrop-blur-xl ring-1 ring-white/20 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
          {/* Card auf Mobile kompakter + harte Maxhöhe */}
          <CardContent
            className="p-5 sm:p-6 md:p-8
                        bg-[rgba(162,89,255,0.08)]
                        overflow-visible
                        sm:max-h-[92svh] sm:overflow-auto sm:overscroll-contain"
            >
            <div className="text-center mb-6 sm:mb-8">
              <div className="flex justify-center mb-2 sm:mb-3">
                <Image
                  src="/logo.png"
                  alt={`${tc('brand.name')} logo`}
                  width={120}
                  height={36}
                  priority
                  className="h-7 sm:h-8 w-auto drop-shadow-md" />
              </div>
              {/* Welcome/Brand: auf Mobile knapper */}
              <p className="text-white/80 mb-1 sm:mb-2 text-[13px] sm:text-sm">
                {t('welcome', { brand: tc('brand.name') })}
              </p>
              <Link
                href={`/${locale}`}
                prefetch={false}
                className="text-white text-2xl sm:text-3xl md:text-4xl mb-1 sm:mb-2 inline-block font-extrabold leading-tight"
              >
                {tc('brand.name')}
              </Link>
              <p className="text-white/70 text-[13px] sm:text-sm">{t('title')}</p>
            </div>

            {(registered || topErrorMsg || resetSuccess) && (
              <div
                className={`mb-4 sm:mb-5 rounded-xl border p-2.5 sm:p-3 text-[13px] sm:text-sm
                ${registered
                  ? 'border-blue-300/40 bg-blue-300/15 text-blue-100'
                  : resetSuccess
                  ? 'border-green-400/40 bg-green-400/15 text-green-100'
                  : 'border-red-400/40 bg-red-400/15 text-red-100'}`}
              >
                {registered
                  ? t('alerts.registered')
                  : resetSuccess
                  ? t('alerts.resetSuccess')
                  : topErrorMsg}
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
                    onChange={(e) => { setIdentifier(e.target.value); if (invalid) { setInvalid(false); setInlineError(null); } }}
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
                    onChange={(e) => { setPassword(e.target.value); if (invalid) { setInvalid(false); setInlineError(null); } }}
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

      {/* 2FA-Modal -> auf Mobile auch kompakter */}
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

            {/* Auswahl anzeigen, falls mehrere Methoden */}
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
                    onClick={() => {
                      setChosen('sms');
                      void sendSms();
                    }}
                    className="flex-1 rounded-full border border-white/20 bg-white/10 hover:bg-white/15 px-3 py-2 text-sm"
                  >
                    {t2fa('smsButton')}
                  </button>
                </div>
              </div>
            )}

            {/* PASSKEY STEP */}
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

            {/* SMS STEP */}
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
    </div>
  );
}
