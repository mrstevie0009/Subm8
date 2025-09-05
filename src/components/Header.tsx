'use client';

import Link from 'next/link';
import Image from 'next/image';
import * as React from 'react';
import { useScrollHide } from '../hooks/useScrollHide';
import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';

export default function Header({ locale }: { locale: string }) {
  const hidden = useScrollHide({ threshold: 6, topAlwaysShow: 12 });
  const { data: session } = useSession();
  const pathname = usePathname();

  // Seiten ohne globalen Header
  if (pathname?.startsWith(`/${locale}/settings/bookmarks`)) return null;
  if (pathname?.startsWith(`/${locale}/chat`)) return null;

  const iconSize = 'clamp(24px, 2.8vw, 50px)';
  const headerHeight = `calc(${iconSize} + 16px)`;

  return (
    <header
      id="app-global-header"  // ← NEU: wird vom Feed aus gemessen
      className="fixed top-0 left-0 right-0 z-40 w-full"
      style={{
        height: headerHeight,
        background: 'rgba(0,0,0,.60)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        transform: hidden ? `translateY(calc(-1 * ${headerHeight}))` : 'translateY(0)',
        transition: 'transform 220ms ease',
        willChange: 'transform',
      }}
      aria-label="Subm8 Header"
    >
      <div
        className="mx-auto px-4 h-full grid items-center"
        style={{
          maxWidth: 760,
          gridTemplateColumns: `calc(${iconSize} + 16px) 1fr calc(${iconSize} + 16px)`,
        }}
      >
        {/* Settings */}
        <Link
          href={`/${locale}?settings=1`}
          prefetch={false}
          className="justify-self-start p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center cursor-pointer"
          aria-label="Settings"
          style={{ width: iconSize, height: iconSize }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="pointer-events-none"
               style={{ color: 'rgba(255,255,255,.95)', position: 'absolute', inset: 0, width: '70%', height: '70%', margin: 'auto' }}>
            <rect x="3" y="6" width="18" height="2" rx="1" />
            <rect x="3" y="11" width="18" height="2" rx="1" />
            <rect x="3" y="16" width="18" height="2" rx="1" />
          </svg>
        </Link>

        {/* Logo */}
        <Link href={`/${locale}`} className="justify-self-center flex items-center">
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
        <Link
          href={session ? `/${locale}?compose=1` : `/${locale}/signin?callbackUrl=/${locale}`}
          prefetch={false}
          className="justify-self-end p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center cursor-pointer"
          aria-label={session ? 'New Post' : 'Sign in to post'}
          style={{ width: iconSize, height: iconSize }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="pointer-events-none"
               style={{ color: 'var(--purple)', position: 'absolute', inset: 0, width: '70%', height: '70%', margin: 'auto' }}>
            <path d="M11 5a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
