// src/components/PageChrome.tsx
'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SettingsDrawerMount from '@/components/SettingsDrawerMount';
import ComposePostOverlayMount from '@/components/ComposePostOverlayMount';

export default function PageChrome({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const pathname = usePathname();

  // Auf /[locale]/settings/bookmarks den Header GAR NICHT mounten
  const hideHeader =
    pathname?.startsWith(`/${locale}/settings/bookmarks`) ?? false;

  // Content-Padding: kleiner, wenn kein Header vorhanden
  const contentTopPad = hideHeader
    ? '12px'
    : 'calc(clamp(24px, 2.8vw, 50px) + 20px)';

  // Platz nach unten, damit nichts unter die BottomNav rutscht
  const contentBottomPad = '84px';

  return (
    <>
      {!hideHeader && <Header locale={locale} />}

      <div
        className="mx-auto w-full"
        style={{
          maxWidth: 760,
          paddingTop: contentTopPad,
          paddingLeft: 16,
          paddingRight: 16,
          paddingBottom: contentBottomPad,
        }}
      >
        {children}
      </div>

      {/* BottomNav bleibt immer sichtbar */}
      <BottomNav/>

      {/* Globale Overlays / Drawer */}
      <SettingsDrawerMount/>
      <ComposePostOverlayMount/>
    </>
  );
}
