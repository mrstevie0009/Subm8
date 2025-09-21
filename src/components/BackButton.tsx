// src/components/BackButton.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  /** Wohin navigieren, wenn kein Verlauf existiert – oder wenn forceFallback aktiv ist */
  fallbackHref: string;
  ariaLabel?: string;

  /** Wenn true: ignoriere History und gehe immer zu fallbackHref */
  forceFallback?: boolean;

  /** Wenn true: nutze router.replace statt push beim Fallback */
  replaceOnFallback?: boolean;

  /** Optional eigene Klassen */
  className?: string;
};

export default function BackButton({
  fallbackHref,
  ariaLabel = 'Zurück',
  forceFallback = false,
  replaceOnFallback = false,
  className = 'inline-flex items-center justify-center size-8 rounded-full hover:bg-white/10 text-white/90',
}: Props) {
  const router = useRouter();

  const goBack = React.useCallback(() => {
    // erzwungener Fallback-Modus
    if (forceFallback) {
      if (replaceOnFallback) {
        router.replace(fallbackHref);
      } else {
        router.push(fallbackHref);
      }
      return;
    }

    // Standard: wenn History vorhanden → back; sonst Fallback
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      if (replaceOnFallback) {
        router.replace(fallbackHref);
      } else {
        router.push(fallbackHref);
      }
    }
  }, [forceFallback, replaceOnFallback, router, fallbackHref]);

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label={ariaLabel}
      className={className}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 6l-6 6 6 6" />
      </svg>
    </button>
  );
}
