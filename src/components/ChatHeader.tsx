'use client';
import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import type { ChatUser } from '@/types/chat';

export default function ChatHeader({ other }: { other: ChatUser & { role: 'domme'|'submissive'|'DOMME'|'SUBMISSIVE' } }) {
  const locale = useLocale();

  const iconSize = 'clamp(28px, 3.6vw, 34px)';
  const titleSz  = 'clamp(17px, 2.1vw, 19px)';
  const metaSz   = 'clamp(12px, 1.6vw, 13px)';
  const gapY     = '2px';
  const vPad     = '6px';

  const headerH =
    `max(calc(${titleSz} + ${metaSz} + ${gapY} + ${vPad} * 2),
          calc(${iconSize} + ${vPad} * 2))`;

  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const prevChat = root.style.getPropertyValue('--chat-header-h');
    root.style.setProperty('--chat-header-h', headerH);
    return () => {
      root.style.setProperty('--chat-header-h', prevChat || '');
    };
  }, [headerH]);

  const isDomme = String(other.role).toUpperCase() === 'DOMME';
  const roleLabel = isDomme ? 'Domme' : 'Sub';

  const styleVars: React.CSSProperties & { ['--icon-size']?: string } = {
    '--icon-size': iconSize,
    height: 'var(--chat-header-h)',
  };

  return (
    <header
      className="fixed z-40 left-1/2 -translate-x-1/2
                 top-[var(--header-h,56px)]
                 w-[min(100vw,760px)]
                 border-b border-white/10
                 bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/50 px-3"
      style={styleVars}
    >
      <div
        className="grid h-full items-center"
        style={{ gridTemplateColumns: 'var(--icon-size) 1fr var(--icon-size)', padding: `${vPad} 0` }}
      >
        <Link
          href={`/${locale}/chat`}
          aria-label="Back"
          className="justify-self-start inline-grid place-items-center rounded hover:bg-white/5"
          style={{ width: iconSize, height: iconSize }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
               style={{ width: '68%', height: '68%', color: 'rgba(255,255,255,.95)' }}>
            <path d="M15 6 9 12l6 6" />
          </svg>
        </Link>

        <div className="justify-self-center flex flex-col items-center leading-tight select-none -translate-y-[1px]">
          <h1 className="font-semibold truncate" style={{ fontSize: titleSz, lineHeight: 1.1 }}>
            {other.displayName}
          </h1>
          <div className="flex items-center gap-2 text-muted"
               style={{ fontSize: metaSz, lineHeight: 1.1, marginTop: gapY }}>
            <span className="truncate">@{other.username}</span>
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
          </div>
        </div>

        <button
          aria-label="More"
          className="justify-self-end inline-grid place-items-center rounded hover:bg-white/5"
          style={{ width: iconSize, height: iconSize }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor"
               style={{ width: '56%', height: '56%', color: 'rgba(255,255,255,.95)' }}>
            <circle cx="12" cy="5" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="12" cy="19" r="2" />
          </svg>
        </button>
      </div>
    </header>
  );
}
