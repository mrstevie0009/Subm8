'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl'; // ✅ NEU
import dynamic from 'next/dynamic';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import heartThrow from '@/lotties/heart-throw-Lottie.json';
import { createPortal } from 'react-dom';
import Image from 'next/image';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export default function ResetPasswordPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const locale = useLocale();

  const t = useTranslations('auth.auth.resetPage'); // ✅ NEU
  const tc = useTranslations('common');

  const token = sp.get('token') ?? '';
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [splashHost, setSplashHost] = React.useState<HTMLElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const el = document.getElementById('boot-splash-lottie') as HTMLElement | null;
    setSplashHost(el ?? null);
    const tmo = window.setTimeout(() => {
      window.dispatchEvent(new Event('boot:splash-done'));
    }, 2500);
    return () => window.clearTimeout(tmo);
  }, []);

  const signalSplashDone = React.useCallback(() => {
    window.dispatchEvent(new Event('boot:splash-done'));
  }, []);

  const minLen = 10;
  const tooShort = pw.length > 0 && pw.length < minLen;
  const mismatch = pw2.length > 0 && pw !== pw2;
  const canSubmit = !busy && token && pw.length >= minLen && pw2.length >= minLen && !mismatch;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      if (pw !== pw2) {
        setError(t('errors.mismatch')); // ✅ i18n
        setBusy(false);
        return;
      }

      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: pw }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? 'failed');
      setDone(true);
      setTimeout(() => router.push(`/${locale}/signin?reset=success`), 1200);
    } catch {
      setError(t('errors.failed')); 
    } finally {
      setBusy(false);
    }
  }

  const baseInput =
    'bg-black/30 border-white/20 text-white placeholder:text-white/50 focus:border-white/40 focus:ring-white/20';

  return (
    <div className="relative grid place-items-center min-h-[100svh] bg-[#0b0b0c] px-3">
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

      <Card className="max-w-md w-full bg-[rgba(162,89,255,0.12)] backdrop-blur-xl ring-1 ring-white/20">
        <CardContent className="p-6">
            {/* Logo-Header – gleiches Styling wie auf Sign-in */}
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

            {/* Optional: zweite Wortmarke wie bei Sign-in */}
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
            </div>
          {!done ? (
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <h2 className="text-white text-lg font-semibold">{t('title')}</h2>

              <div>
                <label className="block text-sm font-medium mb-1 text-white/90">
                  {t('fields.newPw')}
                </label>
                <Input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder={t('placeholders.newPw')}
                  className={baseInput}
                  required
                  minLength={minLen}
                  aria-invalid={tooShort || undefined}
                />
                {tooShort && (
                  <p className="mt-1 text-[12px] text-red-300">
                    {t('errors.tooShort', { min: minLen })}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-white/90">
                  {t('fields.repeatPw')}
                </label>
                <Input
                  type="password"
                  value={pw2}
                  onChange={(e) => setPw2(e.target.value)}
                  placeholder={t('placeholders.repeatPw')}
                  className={baseInput}
                  required
                  minLength={minLen}
                  aria-invalid={mismatch || undefined}
                />
                {mismatch && (
                  <p className="mt-1 text-[12px] text-red-300">{t('errors.mismatch')}</p>
                )}
              </div>

              {error && <p className="text-red-300 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full rounded-full py-2 bg-[var(--purple)]/80 hover:bg-[var(--purple)] disabled:opacity-50"
              >
                {busy ? t('buttons.saving') : t('buttons.save')}
              </button>
            </form>
          ) : (
            <p className="text-green-100 text-center py-4">
              {t('success')}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
