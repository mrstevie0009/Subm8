// src/components/CommunityInviteButton.tsx
'use client';

import * as React from 'react';
import InviteDialog from '@/components/InviteDialog';

type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';

type Props = {
  locale: string;     // darf drinbleiben (wird nur nicht verwendet)
  slug: string;
  name: string;       // darf drinbleiben (wird nur nicht verwendet)
  joined: boolean;
  joinPolicy?: JoinPolicy; // darf drinbleiben (wird nur nicht verwendet)
};

/**
 * Zeigt einen „Einladen“-Button für Communities.
 * Öffnet den tab-basierten InviteDialog (Link-Erstellung + Direkt-Einladung).
 */
export default function CommunityInviteButton(props: Props) {
  // Nur die Props holen, die wir wirklich verwenden – so vermeiden wir no-unused-vars
  const { slug, joined } = props;

  // Hook MUSS vor jedem early return kommen (Rules of Hooks)
  const [open, setOpen] = React.useState(false);

  if (!joined) return null;

  return (
    <div className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 inline-flex items-center gap-2"
        title="Mitglieder einladen"
        aria-haspopup="dialog"
        aria-expanded={open || undefined}
      >
        {/* User-Plus Icon */}
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="9" cy="7" r="4" />
          <path d="M15 19a6 6 0 0 0-12 0" />
          <path d="M19 8v6" />
          <path d="M22 11h-6" />
        </svg>
        <span className="hidden sm:inline">Einladen</span>
      </button>

      <InviteDialog open={open} onClose={() => setOpen(false)} slug={slug} />
    </div>
  );
}
