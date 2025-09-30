// src/app/[locale]/signin/passkey/page.tsx
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import Image from 'next/image';
import { startAuthentication } from '@simplewebauthn/browser';
import { Card, CardContent } from '@/components/ui/card';

export default function SignInPasskeyPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const locale = useLocale();
  const t = useTranslations('common.auth.signinPasskey');
  const tc = useTranslations('common');

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const auto = sp.get('manual') !== '1';

  async function runPasskey() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // 1) Optionen laden (setzt serverseitig das Challenge-Cookie)
      const optRes = await fetch('/api/2fa/passkey/authentication-options', {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (!optRes.ok) {
        const txt = await optRes.text();
        throw new Error(txt || 'Options failed');
      }
      const optionsJSON = await optRes.json();

      // 2) Browser-Passkey-Dialog starten
      const assertion = await startAuthentication(optionsJSON);

      // 3) Server-Verify (liest Challenge aus Cookie)
      const verifyRes = await fetch('/api/2fa/passkey/authentication-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(assertion),
      });

      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        throw new Error(data?.error || 'Verification failed');
      }

      // 4) Erfolgreich → zum Feed
      router.replace(`/${locale}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg || t('errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    if (auto) {
      // automatisch versuchen, sobald die Seite geladen ist
      runPasskey().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

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
              <p className="text-white/80 mb-2">{t('subtitle')}</p>
              <h1 className="text-white text-3xl mb-2 font-extrabold">{t('title')}</h1>
              <p className="text-white/70">{t('hint')}</p>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border p-3 text-sm border-red-400/40 bg-red-400/15 text-red-100">
                {t('errors.prefix')} {error}
              </div>
            )}

            <div className="space-y-4">
              <button
                type="button"
                onClick={runPasskey}
                disabled={busy}
                className="w-full rounded-full py-3 font-semibold
                           bg-[var(--purple)]/80 hover:bg-[var(--purple)]
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors"
              >
                {busy ? t('buttons.verifying') : t('buttons.usePasskey')}
              </button>

              <div className="text-center text-sm text-white/80">
                <Link
                  href={`/${locale}/signin`}
                  className="text-purple-200 hover:text-purple-100 underline"
                  prefetch={false}
                >
                  {t('backToPassword')}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
