'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function PostDetailHeader() {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };
  const tPost = useTranslations('post');

  const goBack = React.useCallback(() => {
    // Wenn es eine History gibt → zurück; sonst sauber auf den Feed der aktuellen Locale
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${locale}`);
    }
  }, [router, locale]);

  return (
    <header className="sticky top-0 z-40 bg-card/90 backdrop-blur border-b border-sub">
      <div className="max-w-2xl mx-auto flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={goBack}
          aria-label={tPost('ariaBack')}
          className="rounded-full p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">{tPost('headerTitle')}</h1>
      </div>
    </header>
  );
}
