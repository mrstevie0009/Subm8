// src/components/ChatHeader.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import type { ChatUser } from '@/types/chat';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import { reportUserAction } from '@/app/actions/reports';

type Props = {
  other: ChatUser & { role: 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE' };
  viewerHasBlocked?: boolean;
  isBlockedByOther?: boolean;
  onBlockStateChange?: (blockedEither: boolean) => void;
};

export default function ChatHeader({
  other,
  viewerHasBlocked = false,
  isBlockedByOther = false,
  onBlockStateChange,
}: Props) {
  const locale = useLocale();
  const t = useTranslations('common.chatHeader');

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
  const blockedEither = iBlocked || isBlockedByOther;

  React.useEffect(() => {
    onBlockStateChange?.(blockedEither);
    try {
      window.dispatchEvent(new CustomEvent('chat:block-change', { detail: { blocked: blockedEither } }));
    } catch {}
  }, [blockedEither, onBlockStateChange]);

  // 3-Punkte-Menü
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as Node | null;
      if (!menuRef.current?.contains(t as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  const profileHref = `/${locale}/u/${other.username}`;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/65 backdrop-blur">
      <div className="mx-auto w-full max-w-[760px] px-3 py-2">
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

          {/* Name + Handle + Badges */}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-2">
              {/* Displayname → Profil */}
              <h1 className="font-semibold truncate" style={{ fontSize: titleSz, lineHeight: 1.1 }}>
                <Link
                  href={profileHref}
                  prefetch={false}
                  className="hover:underline truncate"
                  rel="author"
                >
                  {other.displayName}
                </Link>
              </h1>

              {/* Rolle */}
              <span
                className="px-2 py-[2px] rounded-full text-[10px] leading-none"
                style={{
                  color: 'var(--purple)',
                  background: 'rgba(139,92,246,.18)',
                  border: '1px solid rgba(139,92,246,.28)',
                }}
              >
                {roleLabel}
              </span>

              {/* Block-Badges */}
              {isBlockedByOther && (
                <Badge tone="danger">{t('badges.blockedYou')}</Badge>
              )}
              {!isBlockedByOther && iBlocked && (
                <Badge tone="danger">{t('badges.youBlocked')}</Badge>
              )}
            </div>

            {/* Handle → Profil */}
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
          </div>

          {/* More */}
          <div className="relative" ref={menuRef}>
            <button
              aria-label={t('aria.more')}
              className="inline-grid place-items-center rounded hover:bg-white/5"
              style={{ width: iconSize, height: iconSize }}
              onClick={() => setMenuOpen(v => !v)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor"
                   style={{ width: '56%', height: '56%', color: 'rgba(255,255,255,.95)' }}>
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-56 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1 z-50"
                role="menu"
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
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10  text-red-300">
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
                    <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10  text-red-300">
                      {t('menu.unblock')}
                    </button>
                  </form>
                )}

                {/* Report user (Chat) */}
                <form
                  action={reportUserAction}
                  onSubmit={() => setMenuOpen(false)}
                >
                  <input type="hidden" name="handle" value={other.username} />
                  <input type="hidden" name="reason" value="DM_ABUSE" />
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                    {t('menu.reportConversation')}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
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
