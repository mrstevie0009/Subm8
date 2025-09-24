// src/components/BackButtonStandard.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  ariaLabel: string;
  fallbackHref: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
};

export default function BackButton({
  ariaLabel,
  fallbackHref,
  className,
  style,
  children,
}: Props) {
  const router = useRouter();

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Nur bei linken Klicks ohne Modifikator-Tasten übernehmen wir
    if (
      e.button !== 0 ||
      e.metaKey ||
      e.altKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.defaultPrevented
    ) {
      return;
    }
    e.preventDefault();

    const canGoBack = window.history.length > 1;
    const cameFromSameOrigin =
      typeof document !== 'undefined' &&
      !!document.referrer &&
      new URL(document.referrer).origin === window.location.origin;

    if (canGoBack || cameFromSameOrigin) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  };

  return (
    <a
      href={fallbackHref}
      aria-label={ariaLabel}
      onClick={onClick}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
