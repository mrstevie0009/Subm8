// src/app/[locale]/signup/account/page.tsx
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { signIn } from 'next-auth/react';

// shadcn/ui
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

function isValidEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/* ---------------- Modal: Terms / Privacy ---------------- */
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
  const tTerms = useTranslations('common.legal.terms');
  const tPrivacy = useTranslations('common.legal.privacy');
  const tShared = useTranslations('common.legal.shared');

  const [tab, setTab] = React.useState<LegalTab>(initialTab);
  React.useEffect(() => setTab(initialTab), [initialTab, open]);

  // kleines, neutrales Datum wie auf Terms-Seite
  const updatedStr = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date());

  return open ? (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={tab === 'terms' ? tTerms('title') : tPrivacy('title')}
      className="fixed inset-0 z-[100] grid place-items-center p-4"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div className="relative w-full max-w-3xl rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/40 shadow-[0_8px_40px_rgba(0,0,0,.5)] overflow-hidden">
        {/* Header with tabs */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="inline-flex rounded-full bg-black/30 p-1 ring-1 ring-white/10">
            <button
              type="button"
              onClick={() => setTab('terms')}
              className={`px-4 py-1.5 text-sm rounded-full transition ${
                tab === 'terms'
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white/90'
              }`}
            >
              {tTerms('title')}
            </button>
            <button
              type="button"
              onClick={() => setTab('privacy')}
              className={`px-4 py-1.5 text-sm rounded-full transition ${
                tab === 'privacy'
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:text-white/90'
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

        {/* Body (scrollable) */}
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
                <div className="font-semibold text-blue-100">
                  {tTerms('content.callout_title')}
                </div>
                <p className="text-white/90 mt-1">
                  {tTerms('content.callout_body')}
                </p>
              </div>
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

              <div className="mt-4 rounded-xl border border-yellow-300/30 bg-yellow-300/10 p-4">
                <div className="font-semibold text-yellow-100">
                  {tPrivacy('content.callout_title')}
                </div>
                <p className="text-white/90 mt-1">
                  {tPrivacy('content.callout_body')}
                </p>
              </div>
            </article>
          )}
        </div>

        {/* Footer */}
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

  // i18n
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

  // modal state
  const [legalOpen, setLegalOpen] = React.useState(false);
  const [legalTab, setLegalTab] = React.useState<LegalTab>('terms');

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

  const baseInput =
    'bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20';
  const muted = 'text-white/70';

  return (
    <div
      className="relative grid min-h-[90svh] place-items-center p-4
                 bg-[#0b0b0c] overflow-hidden rounded-2xl
                 [background-image:radial-gradient(00%_40%_at_50%_0%,rgba(255,255,255,.08),transparent_60%)]"
    >
      {/* weiche Blur-Blobs – wie auf der ersten Seite */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-purple-500/20 blur-[90px]" />

      <div className="w-full max-w-md">
        <Card className="rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/50 shadow-[0_8px_30px_rgba(0,0,0,.35)] overflow-hidden">
          <CardContent className="p-8 bg-[rgba(162,89,255,0.45)]">
            {/* Header + kleines Logo */}
            <div className="text-center mb-6">
              <div className="flex justify-center mb-3">
                <Image
                  src="/logo.png"
                  alt="Subm8 logo"
                  width={140}
                  height={42}
                  priority
                  className="h-9 w-auto drop-shadow-md"
                />
              </div>
              <div className={`text-sm ${muted}`}>{t('headerTop')}</div>
              <h1 className="text-white text-3xl md:text-4xl font-extrabold tracking-tight mt-1">
                {t('headerTitle')}
              </h1>
              <p className="mt-2 text-sm text-white/80">
                @{handle} · {roleLabel}
              </p>
            </div>

            {/* Domme Disclaimer */}
            {isDomme && (
              <div className="mt-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-4">
                <div className="font-semibold text-yellow-100">⚠️ {t('dommeDisclaimer.title')}</div>
                <ul className="mt-2 text-sm text-white/85 list-disc pl-5 space-y-1">
                  <li>{t('dommeDisclaimer.li1')}</li>
                  <li>{t('dommeDisclaimer.li2')}</li>
                  <li>{t('dommeDisclaimer.li3')}</li>
                  <li>{t('dommeDisclaimer.li4')}</li>
                </ul>
                <label className="mt-3 flex items-start gap-2 text-sm text-white/90">
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

            {/* Formular */}
            <form className="mt-6 space-y-5" onSubmit={submit} noValidate>
              {/* Email */}
              <div>
                <label className="block text-sm font-medium mb-1 text-white/90">
                  {t('fields.email.label')}
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('fields.email.placeholder')}
                  className={baseInput}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Passwort */}
              <div>
                <label className="block text-sm font-medium mb-1 text-white/90">
                  {t('fields.password.label')}
                </label>
                <Input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={t('fields.password.placeholder')}
                  className={baseInput}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                <div className="mt-1 text-[12px] text-white/70">{t('fields.password.help')}</div>
              </div>

              {/* Passwort bestätigen */}
              <div>
                <label className="block text-sm font-medium mb-1 text-white/90">
                  {t('fields.password2.label')}
                </label>
                <Input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  className={baseInput}
                  autoComplete="new-password"
                  required
                  minLength={8}
                />
                {(pw2.length > 0 && pw !== pw2) && (
                  <div className="mt-1 text-[12px] text-red-300">
                    {t('errors.passwordMismatch')}
                  </div>
                )}
              </div>

              {/* AGB/Datenschutz — klickbar */}
              <label className="flex items-start gap-2 text-sm text-white/90">
                <input
                  type="checkbox"
                  className="accent-[var(--purple)] mt-[3px]"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  {/* „Terms“ Link */}
                  {t('agree').split('Terms')[0]}
                  <button
                    type="button"
                    className="underline text-purple-100 hover:text-white"
                    onClick={() => {
                      setLegalTab('terms');
                      setLegalOpen(true);
                    }}
                  >
                    Terms
                  </button>
                  {t('agree').split('Terms')[1]?.split('Privacy Policy')[0] ?? ' & '}
                  {/* „Privacy Policy“ Link */}
                  <button
                    type="button"
                    className="underline text-purple-100 hover:text-white"
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

              {/* Fehler */}
              {err && <div className="text-sm text-red-300">{err}</div>}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={disabled}
                  className="w-full rounded-full py-3 font-semibold
                             bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-colors"
                >
                  {loading ? t('buttons.creating') : t('buttons.create')}
                </button>

                {/* Alternative: Google */}
                <Link
                  prefetch={false}
                  href={`/api/auth/signin?provider=google&handle=${encodeURIComponent(handle)}&role=${role ?? ''}`}
                  className="block w-full text-center rounded-full py-2.5 text-sm font-medium
                             border border-white/20 bg-black/20 hover:bg-black/30
                             transition-colors"
                >
                  {t('buttons.google')}
                </Link>
              </div>

              {/* Login-Link */}
              <div className="text-center text-sm text-white/80">
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

      {/* Modal mount */}
      <TermsPrivacyModal
        open={legalOpen}
        onClose={() => setLegalOpen(false)}
        initialTab={legalTab}
      />
    </div>
  );
}
