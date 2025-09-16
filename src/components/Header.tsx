// src/components/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useScrollHide } from '../hooks/useScrollHide';
import { useSession } from 'next-auth/react';

function withQuery(
  pathname: string | null,
  search: ReturnType<typeof useSearchParams>,
  patch: Record<string, string | undefined>
) {
  const p = pathname ?? '/';
  const next = new URLSearchParams(search.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${p}?${qs}` : p;
}

export default function Header({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const hidden = useScrollHide({ threshold: 6, topAlwaysShow: 12 });

  // Seiten ohne globalen Header
  const inBookmarks = pathname?.startsWith(`/${locale}/settings/bookmarks`) ?? false;

  // Chat: Header auf Übersicht anzeigen (/chat), aber in Threads (/chat/...) ausblenden
  const chatBase = `/${locale}/chat`;
  const inChatThread =
    !!pathname && (pathname === `${chatBase}/` ? false : pathname.startsWith(`${chatBase}/`));

  const hideHeader = inBookmarks || inChatThread;

  const iconSize = 'clamp(24px, 2.8vw, 50px)';
  const headerHeight = `calc(${iconSize} + 16px)`;

  // normale Handler (keine Hooks nötig)
  const openSettings = () => {
    const href = withQuery(pathname, searchParams, { settings: '1' });
    router.push(href, { scroll: false });
  };

  const openCompose = () => {
    if (!session) {
      const backTo = withQuery(pathname, searchParams, {});
      router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(backTo)}`);
      return;
    }
    const href = withQuery(pathname, searchParams, { compose: '1' });
    router.push(href, { scroll: false });
  };

  if (hideHeader) return null;

  type CSSVars = React.CSSProperties & { ['--header-h']?: string };

  return (
    <header
      id="app-global-header"
      className="fixed top-0 left-0 right-0 z-40 w-full"
      style={
        {
          height: headerHeight,
          ['--header-h']: headerHeight, // für sticky Bereiche auf der Seite
          background: 'rgba(0,0,0,.60)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          transform: hidden ? `translateY(calc(-1 * ${headerHeight}))` : 'translateY(0)',
          transition: 'transform 220ms ease',
          willChange: 'transform',
        } as CSSVars
      }
      aria-label="Subm8 Header"
    >
      <div
        className="mx-auto px-4 h-full grid items-center"
        style={{
          maxWidth: 760,
          gridTemplateColumns: `calc(${iconSize} + 16px) 1fr calc(${iconSize} + 16px)`,
        }}
      >
        {/* Settings: bleibt auf der aktuellen Seite und fügt nur ?settings=1 an */}
        <button
          type="button"
          onClick={openSettings}
          className="justify-self-start p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center cursor-pointer"
          aria-label="Settings"
          style={{ width: iconSize, height: iconSize }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="pointer-events-none"
            style={{ color: 'rgba(255,255,255,.95)', position: 'absolute', inset: 0, width: '70%', height: '70%', margin: 'auto' }}
          >
            <rect x="3" y="6" width="18" height="2" rx="1" />
            <rect x="3" y="11" width="18" height="2" rx="1" />
            <rect x="3" y="16" width="18" height="2" rx="1" />
          </svg>
        </button>

        {/* Logo -> Feed */}
        <Link href={`/${locale}`} prefetch={false} className="justify-self-center flex items-center">
          <Image
            src="/logo.png"
            alt="Subm8 Logo"
            width={50}
            height={50}
            priority
            className="select-none"
            style={{ width: iconSize, height: iconSize }}
            sizes="(min-width: 1024px) 50px, (min-width: 640px) 32px, 24px"
          />
        </Link>

        {/* Compose */}
        <button
          type="button"
          onClick={openCompose}
          className="justify-self-end p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center cursor-pointer"
          aria-label={session ? 'New Post' : 'Sign in to post'}
          style={{ width: iconSize, height: iconSize }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="pointer-events-none"
            style={{ color: 'var(--purple)', position: 'absolute', inset: 0, width: '70%', height: '70%', margin: 'auto' }}
          >
            <path d="M11 5a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
