//src/components/MediaDetailHeader.tsx
'use client';

import * as React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function MediaDetailHeader({
  visible = true,
  title,
  subtitle,
  currentIndex = 0,
  total = 0,
}: {
  visible?: boolean;
  title?: string;
  subtitle?: string;
  currentIndex?: number;
  total?: number;
}) {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };
  const tPost = useTranslations('post');

  const goBack = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(`/${locale}`);
    }
  }, [router, locale]);

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-[60] transition-all duration-300',
        visible
          ? 'opacity-100 translate-y-0'
          : 'pointer-events-none opacity-0 -translate-y-2',
      ].join(' ')}
    >
      <div
        className="relative mx-auto w-full max-w-5xl px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)] sm:px-6"
        style={{ minHeight: 'var(--header-h, 64px)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={goBack}
              aria-label={tPost('ariaBack')}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-white sm:text-base">
                {title || tPost('headerTitle')}
              </div>
              {subtitle ? (
                <div className="truncate text-xs text-white/70 sm:text-sm">
                  {subtitle}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {total > 1 ? (
          <div className="mt-3 flex items-center justify-center gap-1.5">
            {Array.from({ length: total }).map((_, i) => {
              const active = i === currentIndex;
              return (
                <span
                  key={i}
                  className={[
                    'block rounded-full transition-all duration-200',
                    active
                      ? 'h-2 w-5 bg-white'
                      : 'h-2 w-2 bg-white/35',
                  ].join(' ')}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </header>
  );
}