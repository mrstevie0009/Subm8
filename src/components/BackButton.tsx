'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  fallbackHref: string;          // Wohin, wenn es keinen History-Eintrag gibt
  ariaLabel?: string;
};

export default function BackButton({ fallbackHref, ariaLabel = 'Zurück' }: Props) {
  const router = useRouter();

  function goBack() {
    // Wenn es eine History gibt → zurück; sonst Fallback
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={ariaLabel}
      className="inline-flex items-center justify-center size-8 rounded-full hover:bg-white/10 text-white/90"
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}
