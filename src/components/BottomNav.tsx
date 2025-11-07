// src/components/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { useScrollHide } from '../hooks/useScrollHide';

const CHAT_MINI_DISMISS_KEY = 'chatMiniDismiss:v1';
const CHAT_DING_KEY = 'chatLastDingByConv:v1';
const NOTI_DING_KEY = 'notiLastDingMs:v1';

function readChatDingMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CHAT_DING_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch { return {}; }
}
function writeChatDingMap(map: Record<string, number>) {
  try { localStorage.setItem(CHAT_DING_KEY, JSON.stringify(map)); } catch {}
}
function readNotiDingMs(): number {
  try { return Number(localStorage.getItem(NOTI_DING_KEY) || 0); } catch { return 0; }
}
function writeNotiDingMs(ms: number) {
  try { localStorage.setItem(NOTI_DING_KEY, String(ms)); } catch {}
}

function readChatMiniDismiss(): Record<string, number> {
  try {
    const raw = localStorage.getItem(CHAT_MINI_DISMISS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}
function writeChatMiniDismiss(map: Record<string, number>) {
  try {
    localStorage.setItem(CHAT_MINI_DISMISS_KEY, JSON.stringify(map));
  } catch {}
}

type WindowWithWebkit = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function getAudioContextCtor(): typeof AudioContext {
  const w = window as WindowWithWebkit;
  return w.webkitAudioContext ?? window.AudioContext;
}

// ⬇️ ding-hook ohne `any` & mit iOS-Unlock
function useDing() {
  const ctxRef = React.useRef<AudioContext | null>(null);

  // versuche AudioContext nach einer User-Interaktion zu unlocken (Mobile/iOS)
  React.useEffect(() => {
    const unlock = () => {
      try {
        if (!ctxRef.current) ctxRef.current = new (getAudioContextCtor())();
        // iOS: resume, falls im suspended state
        ctxRef.current?.resume?.();
      } catch {}
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
  }, []);

  const play = React.useCallback(async () => {
    try {
      if (!ctxRef.current) ctxRef.current = new (getAudioContextCtor())();
      const ctx = ctxRef.current;
      await ctx.resume?.();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // weicher Envelope
      const now = ctx.currentTime;
      const dur = 0.2; // 200ms
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + 0.02); // Attack
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur); // Decay

      // kleiner “message”-Sound: kurzer Sweep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + dur);
    } catch {
      // Browser blockt evtl. ohne User-Interaktion – still akzeptieren
    }
  }, []);

  return play;
}

type TabProps = {
  href: string;
  label: string;
  active: boolean;
  render: (color: string) => React.ReactNode;
  badge?: boolean;
  innerRef?: React.Ref<HTMLAnchorElement>;
};

function Tab({ href, label, active, render, badge, innerRef }: TabProps) {
  const color = active ? 'var(--purple)' : 'rgba(255,255,255,.95)';
  return (
    <Link
      ref={innerRef}
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className="relative inline-grid place-items-center rounded hover:bg-white/5 select-none"
      style={{ width: 'var(--icon-size)', height: 'var(--icon-size)', padding: 8 }}
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

/* ---------------- Mini Popup (Chat/Notifications) ---------------- */
type MiniPopupProps = {
  anchorEl: HTMLElement | null;
  avatarUrl: string | null;
  unreadCount: number;
  hidden: boolean;
  variant?: 'chat' | 'noti';
  href: string;
};

function MiniPopup({ anchorEl, avatarUrl, unreadCount, hidden, variant = 'chat', href }: MiniPopupProps) {
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);

  const compute = React.useCallback(() => {
    if (!anchorEl) return setPos(null);
    const r = anchorEl.getBoundingClientRect();

    // Mittig über dem Icon ausrichten
    const left = Math.round(r.left + r.width / 2);
    const top = Math.round(r.top - 17);
    setPos({ left, top });
  }, [anchorEl]);

  React.useEffect(() => {
    compute();
    const on = () => compute();
    window.addEventListener('resize', on, { passive: true });
    window.addEventListener('scroll', on, { passive: true });
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('scroll', on);
    };
  }, [compute]);

  if (!anchorEl || !pos || hidden || !unreadCount) return null;

  const node = (
    <div
      style={{
        position: 'fixed',
        left: pos.left,
        top: pos.top,
        transform: 'translate(-50%, -120%)',
        zIndex: 2147483646,
        pointerEvents: 'auto',
      }}
      aria-live="polite"
    >
      {/* klickbar machen */}
      <Link href={href} aria-label={variant === 'chat' ? 'Open chat' : 'Open notifications'}>
        <div className="relative cursor-pointer" role="button" tabIndex={0}>
        <div
          className="rounded-full overflow-hidden border border-white/20 shadow-xl grid place-items-center"
          style={{
            width: 36,
            height: 36,
            background: 'rgba(0,0,0,.45)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {variant === 'chat' ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl || '/images/avatar-placeholder.png'}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
              />
            </>
          ) : (
            // Bell Icon for notifications
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="2" aria-hidden>
              <path d="M6 9a6 6 0 1 1 12 0c0 4 2 5 2 6H4c0-1 2-2 2-6Z" />
              <path d="M9 19a3 3 0 0 0 6 0" />
            </svg>
          )}
        </div>

        {/* Unread Counter (rechts oben) */}
        <div
          className="absolute -top-1 -right-1 grid place-items-center rounded-full text-[11px] font-semibold"
          style={{
            minWidth: 18,
            height: 18,
            padding: '0 5px',
            background: 'var(--purple)',
            color: 'white',
            boxShadow: '0 0 0 2px rgba(0,0,0,.6)',
          }}
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>

        {/* V-Pfeil */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: '50%',
            top: '100%',
            transform: 'translate(-50%, 6px)',
            width: 18,
            height: 10,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 1,
              top: 0,
              width: 10,
              height: 2,
              background: 'var(--purple)',
              borderRadius: 2,
              transform: 'rotate(35deg)',
              boxShadow: '0 0 0 1px rgba(0,0,0,.35)',
              display: 'block',
            }}
          />
          <span
            style={{
              position: 'absolute',
              right: 1,
              top: 0,
              width: 10,
              height: 2,
              background: 'var(--purple)',
              borderRadius: 2,
              transform: 'rotate(-35deg)',
              boxShadow: '0 0 0 1px rgba(0,0,0,.35)',
              display: 'block',
            }}
          />
        </div>
      </div>
      </Link>
    </div>
  );

  return createPortal(node, document.body);
}

/* --------------------------------------------------- */

type CSSVars = React.CSSProperties & {
  ['--icon-size']?: string;
};

function NavContent() {
  const pathname = usePathname();
  const locale = useLocale();
  const ding = useDing();
  const ICON_MIN = 30;             
  const ICON_MAX = 30;              
  const ICON_FLUID = '5vw';
  const iconSize = `clamp(${ICON_MIN}px, ${ICON_FLUID}, ${ICON_MAX}px)`;
  const navHeight = `calc(${iconSize} + 20px + env(safe-area-inset-bottom))`;
  // UI-Preferences
  const [prefs, setPrefs] = React.useState<{ sound: boolean; popup: boolean }>(() => {
    if (typeof window === 'undefined') return { sound: true, popup: true };
    const s = localStorage.getItem('uiNotiSound');
    const p = localStorage.getItem('uiNotiPopup');
    return { sound: s == null ? true : s === '1', popup: p == null ? true : p === '1' };
  });
  React.useEffect(() => {
    const read = () => {
      try {
        const s = localStorage.getItem('uiNotiSound');
        const p = localStorage.getItem('uiNotiPopup');
        setPrefs({ sound: s == null ? true : s === '1', popup: p == null ? true : p === '1' });
      } catch {}
    };
    const onPrefs = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      if (typeof d.sound === 'boolean' || typeof d.popup === 'boolean') {
        setPrefs((old) => ({ sound: d.sound ?? old.sound, popup: d.popup ?? old.popup }));
      }
    };
    window.addEventListener('ui:noti-prefs', onPrefs as EventListener);
    window.addEventListener('storage', read);
    read();
    return () => {
      window.removeEventListener('ui:noti-prefs', onPrefs as EventListener);
      window.removeEventListener('storage', read);
    };
  }, []);
  
  const isActive = (seg: string) =>
    pathname === `/${locale}${seg}` || pathname.startsWith(`/${locale}${seg}/`);

  const hidden = useScrollHide({ threshold: 6, topAlwaysShow: 12 });

  // --- Notifications badge ---
  const [hasNewNoti, setHasNewNoti] = React.useState(false);
  const [latestNotiMs, setLatestNotiMs] = React.useState<number | null>(null);
  const [miniNotiVisible, setMiniNotiVisible] = React.useState(false);
  const notificationsActive = isActive('/notifications');

  const checkNoti = React.useCallback(async () => {
    try {
      const res = await fetch('/api/notifications?limit=1', { cache: 'no-store' });
      if (!res.ok) {
        setHasNewNoti(false);
        setMiniNotiVisible(false);
        setLatestNotiMs(null);
        return;
      }
      const j: { ok: boolean; items?: Array<{ time: string }> } = await res.json();
      const latestIso = j?.ok && j.items && j.items[0]?.time;
      if (!latestIso) {
        setHasNewNoti(false);
        setMiniNotiVisible(false);
        setLatestNotiMs(null);
        return;
      }
      const latest = new Date(latestIso).getTime();
      setLatestNotiMs(latest);
      const seen = Number(localStorage.getItem('notiLastSeen') || 0);
      const fresh = latest > seen && !notificationsActive;
      setHasNewNoti(fresh);
      setMiniNotiVisible(fresh);
    } catch {
      setHasNewNoti(false);
      setMiniNotiVisible(false);
      setLatestNotiMs(null);
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
      setMiniNotiVisible(false); // Seite besucht → Popup weg
    }
  }, [notificationsActive]);

  React.useEffect(() => {
    if (!notificationsActive) checkNoti();
  }, [pathname, locale, notificationsActive, checkNoti]);

  // --- Chat badge + Mini-Popup ---
  const [hasUnreadChat, setHasUnreadChat] = React.useState(false);
  const chatActive = isActive('/chat');

  // Mini popup state (chat)
  const [miniUser, setMiniUser] = React.useState<{
    conversationId: string;
    userId: string;
    avatarUrl: string | null;
    unread: number;
    lastMs: number;
  } | null>(null);

    React.useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<{ conversationId?: string; userId?: string }>;
      if (
        miniUser &&
        (ce.detail?.conversationId === miniUser.conversationId ||
        ce.detail?.userId === miniUser.userId)
      ) {
        setMiniUser(null);
      }
    };
    window.addEventListener('chat:thread-opened', onOpen as EventListener);
    return () => window.removeEventListener('chat:thread-opened', onOpen as EventListener);
  }, [miniUser]);

  const chatTabRef = React.useRef<HTMLAnchorElement | null>(null);
  const notiTabRef = React.useRef<HTMLAnchorElement | null>(null);

  // Dismiss logic: wenn Thread offen ist → Overlay verstecken
  const currentThreadId = React.useMemo(() => {
    // erwartet Pfad: /[locale]/chat/[id]
    const parts = pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('chat');
    return idx >= 0 && parts[idx + 1] ? parts[idx + 1] : null;
  }, [pathname]);

  const checkChat = React.useCallback(async () => {
    try {
      const res = await fetch('/api/chat', { cache: 'no-store' });
      if (!res.ok) {
        setHasUnreadChat(false);
        setMiniUser(null);
        return;
      }
      const j: {
        ok: boolean;
        items?: Array<{
          id: string;
          other: { id: string; avatarUrl: string | null };
          lastMessageAt: string;
          unread?: number;
          muted?: boolean;
        }>;
      } = await res.json();

      const list = (j?.ok && Array.isArray(j.items) ? j.items : []);
      const anyUnread = list.some((it) => (it.unread ?? 0) > 0);

      // ⬇️ Badge am Chat-Tab immer zeigen, wenn es irgendwo Unread gibt
      setHasUnreadChat(anyUnread);

      const latestUnread = list
        .filter((it) => (it.unread ?? 0) > 0)
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())[0];

      if (!latestUnread) {
        setMiniUser(null);
        return;
      }

      // Wenn genau dieser Thread offen ist → kein Popup
      const openId = currentThreadId;
      const shouldHide = openId && latestUnread.id === openId;

      // Dismiss-Sperre: erst wieder zeigen, wenn spätere Nachricht kommt
      const dismissMap = readChatMiniDismiss();
      const lastDismissTs = dismissMap[latestUnread.id] || 0;
      const lastMsgTs = new Date(latestUnread.lastMessageAt).getTime();
      const suppressedByDismiss = lastDismissTs > 0 && lastMsgTs <= lastDismissTs;

      if (shouldHide || suppressedByDismiss) {
        setMiniUser(null);
        return;
      }

      setMiniUser({
        conversationId: latestUnread.id,
        userId: latestUnread.other.id,
        avatarUrl: latestUnread.other.avatarUrl ?? null,
        unread: latestUnread.unread ?? 0,
        lastMs: lastMsgTs,
      });
    } catch {
      setHasUnreadChat(false);
      setMiniUser(null);
    }
  }, [currentThreadId]);


  React.useEffect(() => {
    checkChat();
    const onVis = () => {
      if (document.visibilityState === 'visible') checkChat();
    };
    document.addEventListener('visibilitychange', onVis);
    const int = window.setInterval(checkChat, 5000);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(int);
    };
  }, [checkChat]);

  React.useEffect(() => {
    if (chatActive) {
      setHasUnreadChat(false);
    } else {
      checkChat();
    }
  }, [pathname, locale, chatActive, checkChat]);

  // Reagiere auf Chat-Open Events (Popup sofort weg)
  React.useEffect(() => {
    const onOpen = (e: Event) => {
      const ce = e as CustomEvent<{ conversationId?: string; userId?: string }>;
      if (miniUser &&
          (ce.detail?.conversationId === miniUser.conversationId ||
          ce.detail?.userId === miniUser.userId)) {
        setMiniUser(null);
      }

      // ⬇️ NEU: Dismiss-Sperre setzen für den geöffneten Thread
      const cid = ce.detail?.conversationId;
      if (cid) {
        const map = readChatMiniDismiss();
        map[cid] = Date.now();         // „gesehen/unterdrücken bis etwas Neueres kommt“
        writeChatMiniDismiss(map);

        const dingMap = readChatDingMap();
        dingMap[cid] = Date.now();
        writeChatDingMap(dingMap);
      }
    };
    window.addEventListener('chat:thread-opened', onOpen as EventListener);
    return () => window.removeEventListener('chat:thread-opened', onOpen as EventListener);
  }, [miniUser]);


  // 🔔 Sound abspielen (Chat)
  React.useEffect(() => {
    if (!miniUser || !prefs.sound) return;

    // Schon geklingelt für diesen Thread bei dieser Zeit?
    const map = readChatDingMap();
    const lastPlayed = map[miniUser.conversationId] || 0;
    if (miniUser.lastMs <= lastPlayed) return;  // ⬅️ nichts Neues → kein Ton

    // Nur im sichtbaren Tab
    if (document.visibilityState !== 'visible') return;

    // Sofort persistieren (gegen Remounts) und dann spielen
    map[miniUser.conversationId] = miniUser.lastMs;
    writeChatDingMap(map);

    const t = setTimeout(() => { ding(); }, 30);
    return () => clearTimeout(t);
  }, [miniUser, prefs.sound, ding]);

  // 🔔 Sound abspielen (Notifications)
  React.useEffect(() => {
    if (!miniNotiVisible || !latestNotiMs || !prefs.sound) return;
    if (document.visibilityState !== 'visible') return;

    const lastPlayed = readNotiDingMs();
    if (latestNotiMs <= lastPlayed) return;   // nichts Neues

    writeNotiDingMs(latestNotiMs);
    const t = setTimeout(() => { ding(); }, 30);
    return () => clearTimeout(t);
  }, [miniNotiVisible, latestNotiMs, prefs.sound, ding]);

  return (
    <>
      <nav
        role="navigation"
        aria-label="Bottom navigation"
        style={
          {
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
            transform: hidden ? 'translateY(100%)' : 'translateY(0)',
            transition: 'transform 220ms ease',
            willChange: 'transform',
            ['--icon-size']: iconSize, // sauber getypt
          } as CSSVars
        }
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
            innerRef={notiTabRef}
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
            innerRef={chatTabRef}
            href={`/${locale}/chat`}
            label="Chat"
            active={isActive('/chat')}
            badge={hasUnreadChat}
            render={(color) => (
              <svg
                viewBox="0 0 50 50"
                fill="currentColor"
                style={{ color, width: '100%', height: '100%' }}
                aria-hidden="true"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M 19 2 C 9.075 2 1 9.178 1 18 C 1 22.216 2.8130938 26.156109 6.1210938 29.162109 C 5.1360937 32.180109 1.5858281 34.157688 1.5488281 34.179688 C 1.2828281 34.325688 1.0979219 34.584812 1.0449219 34.882812 C 0.99192187 35.181812 1.0763906 35.486844 1.2753906 35.714844 C 1.4633906 35.929844 2.541125 37 5.328125 37 C 11.568125 37 14.630766 34.551547 15.509766 33.685547 C 16.687766 33.894547 17.859 34 19 34 C 28.925 34 37 26.822 37 18 C 37 9.178 28.925 2 19 2 z M 11 14 L 27 14 C 27.553 14 28 14.447 28 15 C 28 15.553 27.553 16 27 16 L 11 16 C 10.447 16 10 15.553 10 15 C 10 14.447 10.447 14 11 14 z M 38.617188 14.523438 C 38.863187 15.649438 39 16.811 39 18 C 39 27.925 30.028 36 19 36 C 18.048 36 17.078563 35.934734 16.101562 35.802734 C 15.823562 36.017734 15.479516 36.250328 15.103516 36.486328 C 18.130516 41.545328 24.117 45 31 45 C 32.141 45 33.313187 44.894547 34.492188 44.685547 C 35.472187 45.633547 38.534875 48 44.671875 48 C 47.459875 48 48.535656 46.931797 48.722656 46.716797 C 48.922656 46.488797 49.006125 46.181813 48.953125 45.882812 C 48.901125 45.584812 48.717172 45.326641 48.451172 45.181641 C 48.413172 45.160641 44.844953 43.169063 43.876953 40.164062 C 47.185953 37.157063 49 33.217 49 29 C 49 22.6 44.740187 17.080438 38.617188 14.523438 z M 11 20 L 20 20 C 20.553 20 21 20.447 21 21 C 21 21.553 20.553 22 20 22 L 11 22 C 10.447 22 10 21.553 10 21 C 10 20.447 10.447 20 11 20 z M 24 20 L 27 20 C 27.553 20 28 20.447 28 21 C 28 21.553 27.553 22 27 22 L 24 22 C 23.447 22 23 21.553 23 21 C 23 20.447 23.447 20 24 20 z" />
              </svg>
            )}
          />
        </div>
      </nav>

      {/* Mini-Popups gerendert via Portal an die richtige Position */}
      <MiniPopup
        variant="chat"
        anchorEl={chatTabRef.current}
        avatarUrl={miniUser?.avatarUrl ?? null}
        unreadCount={miniUser?.unread ?? 0}
        hidden={!miniUser || !prefs.popup}
        href={
          miniUser?.conversationId
            ? `/${locale}/chat/${miniUser.conversationId}`
            : `/${locale}/chat`
        }
      />

      <MiniPopup
        variant="noti"
        anchorEl={notiTabRef.current}
        avatarUrl={null}
        unreadCount={miniNotiVisible ? 1 : 0}
        hidden={!miniNotiVisible || !prefs.popup}
        href={`/${locale}/notifications`}
      />
    </>
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
  if (overlayOpen) return null;

  return createPortal(<NavContent />, elRef.current);
}
