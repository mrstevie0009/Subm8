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

  // Bookmarks ohne Header
  const inBookmarks = pathname.startsWith(`/${locale}/settings/bookmarks`);

  // Chats erkennen
  const inChatThread = pathname.startsWith(`/${locale}/chat/`);
  const inChat       = inChatThread;

  // Header/BottomNav ausblenden in Chats
  const hideHeader    = inBookmarks || inChat;
  const hideBottomNav = inChat;

  // Höhen/Padding berechnen
  const contentTopPad    = hideHeader ? '12px' : 'calc(clamp(24px, 2.8vw, 50px) + 20px)';
  const contentBottomPad = hideBottomNav ? '12px' : 'calc(var(--bottomnav-h, 72px) + 12px)';

  // gleiche Formel wie in BottomNav (Icon + vertikaler Puffer + Safe-Area)
  const bottomNavHeight = hideBottomNav
    ? '0px'
    : 'calc(clamp(24px, 2.8vw, 50px) + 20px + env(safe-area-inset-bottom))';

  type CSSVars = React.CSSProperties & { ['--bottomnav-h']?: string };

  return (
    <>
      {!hideHeader && <Header locale={locale} />}

      <div
        className="mx-auto w-full"
        style={
          {
            maxWidth: 760,
            paddingTop: contentTopPad,
            paddingLeft: 16,
            paddingRight: 16,
            paddingBottom: contentBottomPad,
            // WICHTIG: Für Chat-Seiten auf 0 setzen, sonst echte Höhe
            ['--bottomnav-h']: bottomNavHeight,
          } as CSSVars
        }
      >
        {children}
      </div>

      {/* BottomNav nur rendern, wenn NICHT im Chat */}
      {!hideBottomNav && <BottomNav />}

      {/* Globale Overlays / Drawer */}
      <SettingsDrawerMount />
      <ComposePostOverlayMount />
    </>
  );
}
