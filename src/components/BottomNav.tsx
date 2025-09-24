// src/components/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useScrollShowOnDown } from '../hooks/useScrollShowonDown';

type TabProps = {
  href: string;
  label: string;
  active: boolean;
  render: (color: string) => React.ReactNode;
  badge?: boolean;
};

function Tab({ href, label, active, render, badge }: TabProps) {
  const color = active ? 'var(--purple)' : 'rgba(255,255,255,.95)';
  const size = 'clamp(24px, 2.8vw, 50px)';
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative inline-grid place-items-center rounded hover:bg-white/5 select-none"
      style={{ width: size, height: size, padding: 8 }}
    >
      {badge && (
        <span
          aria-hidden
          className="absolute -top-0.5 -right-0.5 rounded-full ring-2 ring-black"
          style={{ width: 10, height: 10, background: 'var(--purple)', boxShadow: '0 0 0 2px rgba(0,0,0,.4)' }}
        />
      )}
      <div
        className="pointer-events-none"
        style={{ position: 'absolute', inset: 0, width: '70%', height: '70%', margin: 'auto' }}
      >
        {render(color)}
      </div>
    </Link>
  );
}

function NavContent() {
  const pathname = usePathname();
  const locale = useLocale();
  const isActive = (seg: string) =>
    pathname === `/${locale}${seg}` || pathname.startsWith(`/${locale}${seg}/`);

  const show = useScrollShowOnDown({ threshold: 6, topAlwaysShow: 12 });

  // --- Notifications badge ---
  const [hasNewNoti, setHasNewNoti] = React.useState(false);
  const notificationsActive = isActive('/notifications');

  const checkNoti = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=1', { cache: 'no-store' });
      if (!res.ok) {
        setHasNewNoti(false);
        return;
      }
      const j: { ok: boolean; items?: Array<{ time: string }> } = await res.json();
      const latestIso = j?.ok && j.items && j.items[0]?.time;
      if (!latestIso) {
        setHasNewNoti(false);
        return;
      }
      const latest = new Date(latestIso).getTime();
      const seen = Number(localStorage.getItem('notiLastSeen') || 0);
      setHasNewNoti(latest > seen && !notificationsActive);
    } catch {
      setHasNewNoti(false);
    }
  }, [notificationsActive]);

  React.useEffect(() => {
    checkNoti();
    const onVis = () => {
      if (document.visibilityState === 'visible') checkNoti();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [checkNoti]);

  React.useEffect(() => {
    if (notificationsActive) {
      localStorage.setItem('notiLastSeen', String(Date.now()));
      setHasNewNoti(false);
    }
  }, [notificationsActive]);

  React.useEffect(() => {
    if (!notificationsActive) checkNoti();
  }, [pathname, locale, notificationsActive, checkNoti]);

  // --- Chat badge (ungelesene Nachrichten) ---
  const [hasUnreadChat, setHasUnreadChat] = React.useState(false);
  const chatActive = isActive('/chat');

  const checkChat = React.useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      if (!res.ok) {
        setHasUnreadChat(false);
        return;
      }
      const j: { ok: boolean; items?: Array<{ unread?: number }> } = await res.json();
      const anyUnread = Boolean(j?.ok && j.items?.some((it) => (it.unread ?? 0) > 0));
      // Badge nur zeigen, wenn wir NICHT auf /chat sind – analog zu Notifications
      setHasUnreadChat(anyUnread && !chatActive);
    } catch {
      setHasUnreadChat(false);
    }
  }, [chatActive]);

  React.useEffect(() => {
    checkChat();
    const onVis = () => {
      if (document.visibilityState === 'visible') checkChat();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [checkChat]);

  React.useEffect(() => {
    if (chatActive) {
      // Im Chat-Bereich Badge ausblenden
      setHasUnreadChat(false);
    } else {
      checkChat();
    }
  }, [pathname, locale, chatActive, checkChat]);

  const navHeight = 'calc(clamp(24px, 2.8vw, 50px) + 20px + env(safe-area-inset-bottom))';

  return (
    <nav
      role="navigation"
      aria-label="Bottom navigation"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        height: navHeight,
        paddingBottom: 'env(safe-area-inset-bottom)',
        background: 'rgba(0,0,0,.60)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,.10)',
        zIndex: 2147483647,
        transform: show ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 220ms ease',
        willChange: 'transform',
      }}
    >
      <div
        className="mx-auto h-full grid justify-items-center items-center"
        style={{ maxWidth: 760, gridTemplateColumns: 'repeat(5, 1fr)' }}
      >
        {/* Home */}
        <Tab
          href={`/${locale}`}
          label="Home"
          active={pathname === `/${locale}`}
          render={(color) => (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ color, width: '100%', height: '100%' }} aria-hidden="true">
              <mask id="homeDoorMask"><rect width="24" height="24" fill="white" /><rect x="10.2" y="16.2" width="3.6" height="6" rx="1.1" fill="black" /></mask>
              <path d="M3.2 10.6 12 3l8.8 7.6V20.5c0 .83-.67 1.5-1.5 1.5H4.7c-.83 0-1.5-.67-1.5-1.5V10.6Z" mask="url(#homeDoorMask)" />
              <rect x="6.2" y="12.1" width="2.4" height="2.4" rx=".5" fill="#fff" opacity=".22" />
              <rect x="15.4" y="12.1" width="2.4" height="2.4" rx=".5" fill="#fff" opacity=".22" />
            </svg>
          )}
        />

        {/* Search */}
        <Tab
          href={`/${locale}/search`}
          label="Search"
          active={isActive('/search')}
          render={(color) => (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ color, width: '100%', height: '100%' }} aria-hidden="true">
              <path fillRule="evenodd" clipRule="evenodd" d="M10.5 3a7.5 7.5 0 0 1 5.917 12.136l4.473 4.474a1.5 1.5 0 1 1-2.122 2.121l-4.473-4.473A7.5 7.5 0 1 1 10.5 3Zm0 3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z" />
              <circle cx="14.2" cy="8.8" r="1.05" opacity=".35" />
            </svg>
          )}
        />

        {/* Notifications */}
        <Tab
          href={`/${locale}/notifications`}
          label="Notifications"
          active={notificationsActive}
          badge={hasNewNoti}
          render={(color) => (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ color, width: '100%', height: '100%' }} aria-hidden="true">
              <path d="M12 22a2.75 2.75 0 0 0 2.62-2H9.38A2.75 2.75 0 0 0 12 22Zm7-6V11a7 7 0 1 0-14 0v5l-1.8 1.8c-.3.3-.2.7.2.7H20.6c.4 0 .5-.4.2-.7L19 16Z" />
              <circle cx="15.8" cy="7.6" r=".9" fill="#fff" opacity=".28" />
            </svg>
          )}
        />

        {/* Communities */}
        <Tab
          href={`/${locale}/communities`}
          label="Communities"
          active={isActive('/communities')}
          render={(color) => (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ color, width: '100%', height: '100%' }} aria-hidden="true">
              <circle cx="12" cy="8.2" r="3.2" />
              <circle cx="6.2" cy="9.2" r="2.4" />
              <circle cx="17.8" cy="9.2" r="2.4" />
              <path d="M2.8 20c0-4.2 4.2-7.6 9.2-7.6s9.2 3.4 9.2 7.6H2.8Z" />
              <circle cx="13.8" cy="6.8" r=".9" fill="#fff" opacity=".28" />
              <circle cx="7.7" cy="8.2" r=".6" fill="#fff" opacity=".22" />
              <circle cx="18.3" cy="8.2" r=".6" fill="#fff" opacity=".22" />
            </svg>
          )}
        />

        {/* Chat */}
        <Tab
          href={`/${locale}/chat`}
          label="Chat"
          active={isActive('/chat')}
          badge={hasUnreadChat}
          render={(color) => (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ color, width: '100%', height: '100%' }} aria-hidden="true">
              <path d="M4 6.5C4 4.3 5.8 2.5 8 2.5h8c2.2 0 4 1.8 4 4v5c0 2.2-1.8 4-4 4h-3.2L8 20.5v-4H8c-2.2 0-4-1.8-4-4v-6Z" />
              <circle cx="9.25" cy="10.2" r="1.05" fill="#fff" opacity=".85" />
              <circle cx="12"   cy="10.2" r="1.05" fill="#fff" opacity=".85" />
              <circle cx="14.75" cy="10.2" r="1.05" fill="#fff" opacity=".85" />
            </svg>
          )}
        />
      </div>
    </nav>
  );
}

export default function BottomNav() {
  const [mounted, setMounted] = React.useState(false);
  const elRef = React.useRef<HTMLElement | null>(null);

  // NEU: Overlay-Status
  const [overlayOpen, setOverlayOpen] = React.useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.body?.dataset?.overlayOpen === 'true';
    });

  React.useEffect(() => {
    const onToggle = (e: Event) => {
      const ce = e as CustomEvent<{ open: boolean }>;
      setOverlayOpen(!!ce?.detail?.open);
    };
    window.addEventListener('ui:overlay-toggle', onToggle as EventListener);
    // Falls sich nur das data-Flag ändert, ohne Event:
    const obs = new MutationObserver(() => {
      setOverlayOpen(document.body?.dataset?.overlayOpen === 'true');
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ['data-overlay-open'] });
    return () => {
      window.removeEventListener('ui:overlay-toggle', onToggle as EventListener);
      obs.disconnect();
    };
  }, []);

  React.useEffect(() => {
    const el = document.createElement('div');
    el.style.position = 'relative';
    document.body.appendChild(el);
    elRef.current = el;
    setMounted(true);
    return () => {
      if (elRef.current && elRef.current.parentNode) {
        elRef.current.parentNode.removeChild(elRef.current);
      }
    };
  }, []);

  if (!mounted || !elRef.current) return null;

  // NEU: Wenn Overlay offen, Nav nicht rendern
  if (overlayOpen) return null;

  return createPortal(<NavContent />, elRef.current);
}
