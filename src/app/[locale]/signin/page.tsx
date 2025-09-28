// src/app/[locale]/signin/page.tsx
'use client';

import * as React from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';

// shadcn/ui
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export default function SignInPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  // i18n
  const t = useTranslations('common.auth.signin');
  const tc = useTranslations('common');

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

      const url = res?.url ?? `/${locale}`;
      router.replace(url);
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
      className="relative grid min-h-[90svh] place-items-center p-4
                 bg-[#0b0b0c] overflow-hidden rounded-2xl
                 [background-image:radial-gradient(00%_40%_at_50%_0%,rgba(255,255,255,.08),transparent_60%)]"
    >
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-purple-500/20 blur-[90px]" />

      <div className="w-full max-w-md">
        <Card className="rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/50 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <CardContent className="p-8 bg-[rgba(162,89,255,0.45)]">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-3">
                <Image
                  src="/logo.png"
                  alt={`${tc('brand.name')} logo`}
                  width={160}
                  height={48}
                  priority
                  className="h-10 w-auto drop-shadow-md"
                />
              </div>
              <p className="text-white/80 mb-2">
                {t('welcome', { brand: tc('brand.name') })}
              </p>
              <Link
                href={`/${locale}`}
                prefetch={false}
                className="text-white text-4xl mb-2 inline-block font-extrabold"
              >
                {tc('brand.name')}
              </Link>
              <p className="text-white/70">{t('title')}</p>
            </div>

            {(registered || topErrorMsg || resetSuccess) && (
              <div
                className={`mb-4 rounded-xl border p-3 text-sm
                  ${
                    registered
                      ? 'border-blue-300/40 bg-blue-300/15 text-blue-100'
                      : resetSuccess
                      ? 'border-green-400/40 bg-green-400/15 text-green-100'
                      : 'border-red-400/40 bg-red-400/15 text-red-100'
                  }`}
              >
                {registered
                  ? t('alerts.registered')
                  : resetSuccess
                  ? t('alerts.resetSuccess')
                  : topErrorMsg}
              </div>
            )}

            {!forgotMode ? (
              <form onSubmit={handleCredentials} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="identifier" className="block text-sm font-medium mb-1 text-white/90">
                    {t('fields.identifier.label')}
                  </label>
                  <Input
                    id="identifier"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      if (invalid) {
                        setInvalid(false);
                        setInlineError(null);
                      }
                    }}
                    type="text"
                    autoComplete="username"
                    required
                    placeholder={t('fields.identifier.placeholder')}
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? 'identifier-error' : undefined}
                    className={`${baseInput} ${invalid ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                  />
                  {invalid && (
                    <p id="identifier-error" className="mt-1 text-[12px] text-red-300">
                      {inlineError}
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-1 text-white/90">
                    {t('fields.password.label')}
                  </label>
                  <Input
                    id="password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (invalid) { setInvalid(false); setInlineError(null); }
                    }}
                    type="password"
                    autoComplete="current-password"
                    required
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? 'password-error' : undefined}
                    className={`${baseInput} ${invalid ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                  />
                  {invalid && (
                    <p id="password-error" className="mt-1 text-[12px] text-red-300">
                      {inlineError}
                    </p>
                  )}
                  {/* Move the link here */}
                  <div className="mt-1 text-right">
                    <button
                      type="button"
                      onClick={() => setForgotMode(true)}
                      className="text-xs text-purple-200 hover:text-purple-100 underline"
                    >
                      {t('forgot.link')}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full py-3 font-semibold
                             bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  {loading ? t('buttons.submitLoading') : t('buttons.submit')}
                </button>

                <div className="text-center text-xs text-white/60">{t('or')}</div>

                <button
                  type="button"
                  onClick={() => signIn('google', { callbackUrl: `/${locale}` })}
                  className="w-full rounded-full py-2.5 text-sm font-medium
                             border border-white/20 bg-black/20 hover:bg-black/30
                             transition-colors"
                >
                  {t('buttons.google')}
                </button>
              </form>
            ) : (
              <form onSubmit={handleForgot} className="space-y-5" noValidate>
                {!forgotDone ? (
                  <>
                    <div>
                      <label htmlFor="forgotEmail" className="block text-sm font-medium mb-1 text-white/90">
                        {t('forgot.emailLabel')}
                      </label>
                      <Input
                        id="forgotEmail"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        type="email"
                        required
                        placeholder={t('forgot.emailPlaceholder')}
                        className={baseInput}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full rounded-full py-3 font-semibold
                                 bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                                 disabled:opacity-50 disabled:cursor-not-allowed
                                 transition-colors"
                    >
                      {forgotLoading ? t('forgot.submitLoading') : t('forgot.submit')}
                    </button>
                    <div className="text-center">
                      <button
                        type="button"
                        onClick={() => setForgotMode(false)}
                        className="text-xs text-purple-200 hover:text-purple-100 underline"
                      >
                        {t('forgot.back')}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-center text-green-100">
                    {t('forgot.success')}
                  </p>
                )}
              </form>
            )}

            <div className="mt-6 text-center text-sm text-white/80">
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
    </div>
  );
}
