'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import type { ChatUser } from '@/types/chat';

export default function ChatHeader({
  other,
}: {
  other: ChatUser & { role: 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE' };
}) {
  const locale = useLocale();

  // Responsive Größen
  const iconSize = 'clamp(28px, 3.6vw, 34px)';
  const avatar   = 'clamp(28px, 4.2vw, 40px)';
  const titleSz  = 'clamp(17px, 2.1vw, 19px)';
  const metaSz   = 'clamp(12px, 1.6vw, 13px)';

  // Höhe als CSS-Variable setzen, damit die Seite korrekt top-padding berechnet
  const headerH = `max(${avatar}, calc(${titleSz} + ${metaSz} + 10px))`;
  React.useLayoutEffect(() => {
    const root = document.documentElement;
    const prev = root.style.getPropertyValue('--chat-header-h');
    root.style.setProperty('--chat-header-h', `calc(${headerH} + 18px)`); // + vert. Padding
    return () => root.style.setProperty('--chat-header-h', prev || '');
  }, [headerH]);

  const isDomme = String(other.role).toUpperCase() === 'DOMME';
  const roleLabel = isDomme ? 'Domme' : 'Sub';

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/65 backdrop-blur">
      <div className="mx-auto w-full max-w-[760px] px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Back */}
          <Link
            href={`/${locale}/chat`}
            aria-label="Back"
            className="inline-grid place-items-center rounded hover:bg-white/5"
            style={{ width: iconSize, height: iconSize }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}
                 style={{ width: '68%', height: '68%', color: 'rgba(255,255,255,.95)' }}>
              <path d="M15 6 9 12l6 6" />
            </svg>
          </Link>

          {/* Avatar */}
          <div
            className="relative overflow-hidden rounded-full border border-white/15 bg-white/10"
            style={{ width: avatar, height: avatar }}
            aria-hidden="true"
          >
            <Image
              src={other.avatarUrl || '/images/avatar-placeholder.png'}
              alt=""
              fill
              className="object-cover"
              sizes={avatar}
            />
          </div>

          {/* Name + Handle */}
          <div className="min-w-0 flex-1 leading-tight">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold truncate" style={{ fontSize: titleSz, lineHeight: 1.1 }}>
                {other.displayName}
              </h1>
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
            <div className="text-muted truncate" style={{ fontSize: metaSz }}>
              @{other.username}
            </div>
          </div>

          {/* More */}
          <button
            aria-label="More"
            className="inline-grid place-items-center rounded hover:bg-white/5"
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
      </div>
    </header>
  );
}
