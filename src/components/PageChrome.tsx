// src/components/PageChrome.tsx
'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SettingsDrawerMount from '@/components/SettingsDrawerMount';
import ComposePostOverlayMount from '@/components/ComposePostOverlayMount';

import ToastHost from '@/components/ToastHost';

export default function PageChrome({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const pathnameRaw = usePathname();
  const pathname = React.useMemo(
    () => (pathnameRaw === '/' ? '/' : pathnameRaw.replace(/\/+$/, '')),
    [pathnameRaw]
  );

  const inBookmarks = pathname.startsWith(`/${locale}/settings/bookmarks`);
  const inSettings = pathname.startsWith(`/${locale}/settings`);

  const inProfile = pathname.startsWith(`/${locale}/u/`);
  const inEditProfile = pathname.startsWith(`/${locale}/u/`) && pathname.endsWith('/edit');

  const chatBase = `/${locale}/chat`;
  const inChatThread = pathname.startsWith(`${chatBase}/`);
  const isAuthPage =
   pathname === `/${locale}/signin` ||
   pathname.startsWith(`/${locale}/signin`) ||
   pathname === `/${locale}/signup` ||
   pathname.startsWith(`/${locale}/signup`);

  // Header in Threads aus, in Chat-Übersicht an
  const hideHeader = inBookmarks || inChatThread || isAuthPage || inSettings || inProfile || inEditProfile;
  const hideBottomNav = inChatThread;

  const contentTopPad = hideHeader ? '12px' : 'calc(clamp(24px, 2.8vw, 50px) + 20px)';
  const contentBottomPad = hideBottomNav ? '12px' : 'calc(var(--bottomnav-h, 72px) + 12px)';

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
            ['--bottomnav-h']: bottomNavHeight,
          } as CSSVars
        }
      >
        {children}
      </div>

      {!hideBottomNav && <BottomNav />}

      <SettingsDrawerMount />
      <ComposePostOverlayMount />
      {/* Neu: Toasts global rendern */}
      <ToastHost />
    </>
  );
}
