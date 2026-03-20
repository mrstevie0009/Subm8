// src/components/MediaDetailHeader.tsx
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function MediaDetailHeader({ 
  fixed = false,
  transparentOnHide = false 
}: { 
  fixed?: boolean;
  transparentOnHide?: boolean;
}) {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };
  const tPost = useTranslations('post');

  const goBack = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(`/${locale}`);
  }, [router, locale]);

  const headerClass = fixed
    ? `fixed inset-x-0 top-0 z-50 transition-all duration-300 ${transparentOnHide ? 'bg-transparent border-transparent' : 'bg-black/90 backdrop-blur border-b border-sub'}`
    : 'sticky top-0 z-40 bg-black/90 backdrop-blur border-b border-sub';

  return (
    <header className={headerClass}>
      <div className="max-w-2xl mx-auto flex items-center gap-3 px-3 py-3">
        <button
          type="button"
          onClick={goBack}
          aria-label={tPost('ariaBack')}
          className="rounded-full p-2 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40 transition-colors"
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