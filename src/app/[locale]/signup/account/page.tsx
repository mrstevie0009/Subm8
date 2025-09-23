// src/app/[locale]/signup/account/page.tsx
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { signIn } from 'next-auth/react';

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export default function SignupAccountPage() {
  const sp = useSearchParams();
  const locale = useLocale();

  // ⬇️ Angepasste Namespaces
  const t = useTranslations('common.auth.signupAccount');
  const tRole = useTranslations('common.post.role');

  const handle = (sp.get('handle') || '').toLowerCase();
  const roleParam = sp.get('role');
  const role = roleParam === 'DOMME' || roleParam === 'SUBMISSIVE' ? roleParam : null;

  const isDomme = role === 'DOMME';

  const [email, setEmail] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [agree, setAgree] = React.useState(false);
  const [dommeGiftAgree, setDommeGiftAgree] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const ready =
    !!handle &&
    !!role &&
    isValidEmail(email) &&
    pw.length >= 8 &&
    pw === pw2 &&
    agree &&
    (!isDomme || dommeGiftAgree);

  const submit: React.FormEventHandler<HTMLFormElement> = async (ev) => {
    ev.preventDefault();
    if (!ready || loading) return;

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

  const disabled = !ready || loading;
  const roleLabel = isDomme ? tRole('domme') : tRole('submissive');

  return (
    <main className="min-h-[calc(100vh-0px)] grid place-items-center px-4">
      <section className="w-full max-w-[500px] rounded-3xl border border-white/10 bg-white/[.04] backdrop-blur shadow-app p-6 md:p-8">
        <div className="text-center">
          <div className="text-sm text-muted">{t('headerTop')}</div>
          <div className="text-3xl md:text-4xl font-extrabold tracking-tight">{t('headerTitle')}</div>
          <p className="mt-2 text-sm text-muted">
            @{handle} · {roleLabel}
          </p>
        </div>

        {/* Domme Disclaimer */}
        {isDomme && (
          <div className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4">
            <div className="font-semibold">⚠️ {t('dommeDisclaimer.title')}</div>
            <ul className="mt-2 text-sm text-white/85 list-disc pl-5 space-y-1">
              <li>{t('dommeDisclaimer.li1')}</li>
              <li>{t('dommeDisclaimer.li2')}</li>
              <li>{t('dommeDisclaimer.li3')}</li>
              <li>{t('dommeDisclaimer.li4')}</li>
            </ul>
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-[var(--purple)] mt-[3px]"
                checked={dommeGiftAgree}
                onChange={(e) => setDommeGiftAgree(e.target.checked)}
              />
              <span>{t('dommeDisclaimer.checkbox')}</span>
            </label>
          </div>
        )}

        <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
          <div>
            <label className="block text-sm font-medium mb-1">{t('fields.email.label')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('fields.email.placeholder')}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('fields.password.label')}</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder={t('fields.password.placeholder')}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <div className="mt-1 text-[12px] text-muted">{t('fields.password.help')}</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">{t('fields.password2.label')}</label>
            <input
              type="password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-[var(--purple)]"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
            />
            {t('agree')}
          </label>

          {err && <div className="text-sm text-red-400">{err}</div>}

          <button
            type="submit"
            disabled={disabled}
            className="w-full rounded-full py-3 font-semibold bg-[var(--purple)]/70 hover:bg-[var(--purple)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('buttons.creating') : t('buttons.create')}
          </button>

          <div className="text-center">
            <Link
              prefetch={false}
              href={`/api/auth/signin?provider=google&handle=${encodeURIComponent(handle)}&role=${role ?? ''}`}
              className="inline-block mt-2 text-sm text-[var(--purple)] hover:underline"
            >
              {t('buttons.google')}
            </Link>
          </div>
        </form>

        <div className="mt-4 text-center text-sm text-muted">
          {t('login.cta')}{' '}
          <Link href={`/${locale}/signin`} className="text-[var(--purple)] hover:underline" prefetch={false}>
            {t('login.link')}
          </Link>
        </div>
      </section>
    </main>
  );
}
