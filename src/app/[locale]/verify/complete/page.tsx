'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function VerifyComplete() {
  const t = useTranslations('common.verify.complete'); // 🔹 neue Keys (siehe JSON unten)
  const router = useRouter();
  const sp = useSearchParams();
  const back = sp.get('back') || '/';

  const [checking, setChecking] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
  let t: ReturnType<typeof setTimeout> | undefined;

  async function poll() {
    try {
      const r = await fetch('/api/me', { cache: 'no-store' });
      const me = await r.json();
      if (me?.user?.ageVerified) {
        setChecking(false);
        router.replace(back);
        return;
      }
    } catch {}
    t = setTimeout(poll, 1500);
  }

  setChecking(true);
  poll();

  timeoutRef.current = window.setTimeout(() => setChecking(false), 90_000);

  return () => {
    if (t) clearTimeout(t);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  };
}, [router, back, nonce]); // ⬅️ nonce hinzugefügt


  useEffect(() => {
    // kleine Stoppuhr nur fürs UI
    intervalRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const r = await fetch('/api/me', { cache: 'no-store' });
        const me = await r.json();
        if (me?.user?.ageVerified) {
          setChecking(false);
          router.replace(back);
          return;
        }
      } catch {
        // ignorieren – nächster Poll
      }
      t = setTimeout(poll, 1500);
    }

    setChecking(true);
    poll();

    // Hard timeout: nach 90s zeigen wir einen „Hilfe“-Hinweis
    timeoutRef.current = window.setTimeout(() => setChecking(false), 90_000);

    return () => {
      if (t) clearTimeout(t);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [router, back]);

  return (
    <main className="min-h-[calc(100dvh-0px)] grid place-items-center p-6">
      <div className="w-[min(560px,92vw)] rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span
            className="grid place-items-center rounded-xl border border-white/15 bg-white/[.06] w-11 h-11"
            aria-hidden
          >
            {/* Shield/verify icon */}
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3l7 3v5c0 5-3.5 9-7 10-3.5-1-7-5-7-10V6l7-3z" />
              <path d="M9 12l2 2 4-5" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold">{t('title')}</h1>
            <p className="text-sm text-white/80">{t('subtitle')}</p>
          </div>
        </div>

        {/* Body */}
        <div className="mt-6">
          {/* Loader / Status */}
          <div className="flex items-center gap-3">
            <span className="relative inline-block w-5 h-5">
              <span className="absolute inset-0 rounded-full border-2 border-white/25 border-t-white/90 animate-spin" />
            </span>
            <div className="text-[13px] text-white/85">
              {checking ? t('status.waiting') : t('status.stillWaiting')}
              <span className="text-white/55"> · {t('elapsed', { seconds: elapsed })}</span>
            </div>
          </div>

          <p className="mt-3 text-[13px] text-white/70">{t('redirect')}</p>

          {/* Actions */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95"
              onClick={() => router.replace(back)}
            >
              {t('actions.backNow')}
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-white/15 hover:bg-white/10"
              onClick={() => { setNonce(n => n + 1); router.refresh(); }} // ⬅️ poll neu starten
            >
              {t('actions.refresh')}
            </button>
          </div>

          {/* Help */}
          <details className="mt-6 group">
            <summary className="cursor-pointer text-[13px] text-white/70 hover:text-white/90 list-none">
              <span className="underline">{t('help.title')}</span>
            </summary>
            <ul className="mt-2 text-[13px] text-white/75 space-y-1 pl-4 list-disc">
              <li>{t('help.items.0')}</li>
              <li>{t('help.items.1')}</li>
              <li>{t('help.items.2')}</li>
              <li>{t('help.items.3')}</li>
            </ul>
          </details>
        </div>
      </div>
    </main>
  );
}
