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
  // bestehend
  const inBookmarks = pathname.startsWith(`/${locale}/settings/bookmarks`);
  
  // neu: Chat-Routen erkennen
  const inChatList   = pathname === `/${locale}/chat`;
  const inChatThread = pathname.startsWith(`/${locale}/chat/`);
  const inChat       = inChatList || inChatThread;  

  // Header im Bookmarks-Bereich und im Chat ausblenden
  const hideHeader = inBookmarks || inChat;

  const hideBottomNav = inChat;
  // Content-Padding: kleiner, wenn kein Header vorhanden
  const contentTopPad = hideHeader
    ? '12px'
    : 'calc(clamp(24px, 2.8vw, 50px) + 20px)';
// Platz nach unten – wenn BottomNav ausgeblendet ist, weniger Padding nötig
  const contentBottomPad = hideBottomNav ? '12px' : '84px';

  // Platz nach unten, damit nichts unter die BottomNav rutscht
  //const contentBottomPad = '84px';

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
