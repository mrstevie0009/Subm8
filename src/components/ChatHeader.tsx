// src/components/ChatHeader.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { ChatUser } from '@/types/chat';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import { reportUserAction } from '@/app/actions/reports';
import { createPortal } from 'react-dom';
import { UserBadges } from '@/components/UserBadges';

const isPremiumActive = (iso?: string | null) =>
  !!iso && new Date(iso).getTime() > Date.now();

type Props = {
  other: ChatUser & { role: 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE' };
  viewerHasBlocked?: boolean;
  isBlockedByOther?: boolean;
  onBlockStateChange?: (blockedEither: boolean) => void;
  loading?: boolean;
};

export default function ChatHeader({
  other,
  viewerHasBlocked = false,
  isBlockedByOther = false,
  onBlockStateChange,
  loading = false,
}: Props) {
  const locale = useLocale();
  const t = useTranslations('chat.chatHeader');
  const b = useTranslations('common')

  // Responsive Größen
  const iconSize = 'clamp(28px, 3.6vw, 34px)';
  const avatar   = 'clamp(28px, 4.2vw, 40px)';
  const titleSz  = 'clamp(17px, 2.1vw, 19px)';
  const metaSz   = 'clamp(12px, 1.6vw, 13px)';

  // Höhe als CSS-Variable setzen
  const headerH = `max(${avatar}, calc(${titleSz} + ${metaSz} + 10px))`;
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const prev = root.style.getPropertyValue('--chat-header-h');
    root.style.setProperty('--chat-header-h', `calc(${headerH} + 18px)`);
    return () => root.style.setProperty('--chat-header-h', prev || '');
  }, [headerH]);

  const isDomme = String(other.role).toUpperCase() === 'DOMME';
  const roleLabel = isDomme ? t('role.domme') : t('role.sub');

  // Block-UI-State
  const [iBlocked, setIBlocked] = React.useState<boolean>(!!viewerHasBlocked);
  const blockedEither = loading ? false : (iBlocked || isBlockedByOther);

  React.useEffect(() => {
    onBlockStateChange?.(blockedEither);
    try {
      window.dispatchEvent(new CustomEvent('chat:block-change', { detail: { blocked: blockedEither } }));
    } catch {}
  }, [blockedEither, onBlockStateChange]);

  // 3-Punkte-Menü → Portal + fixed Position
  const [menuOpen, setMenuOpen] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);

  // Position berechnen, wenn offen (und bei Scroll/Resize neu)
  React.useLayoutEffect(() => {
    if (!menuOpen) return;

    function compute() {
      const el = btnRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const menuW = 224; // ≈ w-56
      const gap = 8;

      // Rechts ausrichten, aber Viewportränder respektieren
      const maxLeft = window.innerWidth - menuW - 8;
      const left = Math.max(8, Math.min(maxLeft, r.right - menuW));
      const top = r.bottom + gap; // unterhalb des Headers
      setMenuPos({ top, left });
    }

    compute();
    const onScroll = () => compute();
    const onResize = () => compute();

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [menuOpen]);

  // ESC zum Schließen
  React.useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const profileHref = `/${locale}/u/${other.username}`;

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/65 backdrop-blur">
      <div className="mx-auto w-full max-w-[760px] px-3 py-2 overflow-x-hidden">
        <div className="flex items-center gap-3">
          {/* Back */}
          <Link
            href={`/${locale}/chat`}
            aria-label={t('aria.back')}
            className="inline-grid place-items-center rounded hover:bg-white/5"
            style={{ width: iconSize, height: iconSize }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                 style={{ width: '68%', height: '68%', color: 'rgba(255,255,255,.95)' }}>
              <path d="M15 6 9 12l6 6" />
            </svg>
          </Link>

          {/* Avatar → Profil */}
          {loading ? (
            <div
              className="relative overflow-hidden rounded-full border border-white/15 bg-white/10 animate-pulse block"
              style={{ width: avatar, height: avatar }}
              aria-hidden
            />
          ) : (
            <Link
              href={profileHref}
              prefetch={false}
              aria-label={t('aria.profile', { name: other.displayName })}
              className="relative overflow-hidden rounded-full border border-white/15 bg-white/10 block"
              style={{ width: avatar, height: avatar }}
            >
              <Image
                src={other.avatarUrl || '/images/avatar-placeholder.png'}
                alt=""
                fill
                className="object-cover"
                sizes={avatar}
              />
            </Link>
          )}

          {/* Name + Handle + Badges */}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-2">
              {/* Displayname → Profil */}
              {loading ? (
                <div className="h-[18px] w-40 max-w-[55vw] rounded bg-white/10 animate-pulse" aria-hidden />
              ) : (
                <h1 className="font-semibold" style={{ fontSize: titleSz, lineHeight: 1.1 }}>
                  <span className="inline-flex items-center gap-1 max-w-full">
                    <Link
                      href={profileHref}
                      prefetch={false}
                      className="hover:underline truncate"
                      rel="author"
                    >
                      {other.displayName}
                    </Link>

                    {/* 🟣 Badges direkt neben dem Namen */}
                    <UserBadges
                      role={other.role}
                      isPremium={isPremiumActive(other.premiumUntil)}
                      isFirstAdopter={!!other.isFirstAdopter}
                      size={16}           // 16–18 passt gut zur Header-Zeile
                      className="shrink-0"
                      premiumLabel={b('badges.verified')}        // z.B. „Verifiziertes Konto“
                      firstAdopterLabel={b('badges.firstAdopter')}
                    />
                  </span>
                </h1>
              )}

              {/* Rolle */}
              <span
                className="px-2 py-[2px] rounded-full text-[10px] leading-none"
                style={{
                  color: 'var(--purple)',
                  background: 'rgba(139,92,246,.18)',
                  border: '1px solid rgba(139,92,246,.28)',
                  opacity: loading ? 0.5 : 1,
                }}
              >
                {roleLabel}
              </span>

              {/* Block-Badges */}
              {!loading && isBlockedByOther && (
                <Badge tone="danger">{t('badges.blockedYou')}</Badge>
              )}
              {!loading && !isBlockedByOther && iBlocked && (
                <Badge tone="danger">{t('badges.youBlocked')}</Badge>
              )}
            </div>

            {/* Handle → Profil */}
            {loading ? (
              <div className="mt-1 h-[14px] w-24 rounded bg-white/10 animate-pulse" aria-hidden />
            ) : (
              <div className="truncate" style={{ fontSize: metaSz }}>
                <Link
                  href={profileHref}
                  prefetch={false}
                  className="text-muted hover:underline"
                  rel="author"
                >
                  @{other.username}
                </Link>
              </div>
            )}
          </div>

          {/* More */}
          <div className="relative">
            <button
              ref={btnRef}
              aria-label={t('aria.more')}
              className="inline-grid place-items-center rounded hover:bg-white/5 disabled:opacity-50"
              style={{ width: iconSize, height: iconSize }}
              onClick={() => setMenuOpen(v => !v)}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" fill="currentColor"
                   style={{ width: '56%', height: '56%', color: 'rgba(255,255,255,.95)' }}>
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Menü via Portal außerhalb des Headers */}
      {menuOpen && !loading && menuPos && createPortal(
        <>
          {/* Click-away Layer */}
          <div
            className="fixed inset-0 z-[2147483646]"
            onMouseDown={() => setMenuOpen(false)}
          />
          <div
            className="fixed z-[2147483647] w-56 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1"
            role="menu"
            style={{ top: menuPos.top, left: menuPos.left }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Link
              href={profileHref}
              className="block px-3 py-2 rounded hover:bg-white/10"
              onClick={() => setMenuOpen(false)}
            >
              {t('menu.viewProfile')}
            </Link>

            {/* Mute (Stub) */}
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={() => {
                setMenuOpen(false);
                alert(t('menu.muteSoon'));
              }}
            >
              {t('menu.mute')}
            </button>

            {/* Block/Unblock */}
            {!iBlocked ? (
              <form
                action={blockUserAction}
                onSubmit={() => {
                  setIBlocked(true);
                  setMenuOpen(false);
                }}
              >
                <input type="hidden" name="blockedHandle" value={other.username} />
                <input type="hidden" name="handle" value={other.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                  {t('menu.block')}
                </button>
              </form>
            ) : (
              <form
                action={unblockUserAction}
                onSubmit={() => {
                  setIBlocked(false);
                  setMenuOpen(false);
                }}
              >
                <input type="hidden" name="blockedHandle" value={other.username} />
                <input type="hidden" name="handle" value={other.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                  {t('menu.unblock')}
                </button>
              </form>
            )}

            {/* Report user (Chat) */}
            <form action={reportUserAction} onSubmit={() => setMenuOpen(false)}>
              <input type="hidden" name="handle" value={other.username} />
              <input type="hidden" name="reason" value="DM_ABUSE" />
              <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                {t('menu.reportConversation')}
              </button>
            </form>
          </div>
        </>,
        document.body
      )}
    </header>
  );
}

function Badge({ children, tone = 'danger' }: { children: React.ReactNode; tone?: 'danger' | 'info' }) {
  const styles =
    tone === 'danger'
      ? { color: '#fca5a5', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)' }
      : { color: 'rgba(255,255,255,.9)', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' };
  return (
    <span className="px-2 py-[2px] text-[10px] leading-none rounded-full" style={styles}>
      {children}
    </span>
  );
}
