'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import { CONVERSATIONS } from '@/data/chatSeed';

const AVATAR_PH = '/images/avatar-placeholder.png';

function timeAgoShort(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default function ChatListPage() {
  const locale = useLocale();

  return (
    <main
      className="mx-auto px-3"
      style={{
        maxWidth: 760,
        paddingTop: 'calc(var(--chat-header-h, var(--header-h, 56px)) + 8px)',
        paddingBottom: 'calc(var(--bottomnav-h, 72px) + 8px)',
      }}
    >
      {/* Suche */}
      <div
        className="sticky z-10 py-2 bg-transparent"
        style={{ top: 'calc(var(--chat-header-h, var(--header-h, 56px)) + 1px)' }}
      >
        <input
          placeholder="Search through messages"
          className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
        />
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {CONVERSATIONS.map((c) => (
          <Link
            key={c.id}
            href={`/${locale}/chat/${c.id}`}
            className="grid grid-cols-[3.2em_1fr_auto] items-center gap-3 rounded-app border border-sub bg-card p-3 hover:bg-white/5"
          >
            {/* Avatar links (wie PostCard) */}
            <div className="shrink-0 w-[3.2em] flex flex-col items-center">
              <div className="size-[3.2em] rounded-full overflow-hidden grid place-items-center bg-white/10 relative">
                <Image
                  src={c.other.avatarUrl || AVATAR_PH}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="3.2em"
                />
              </div>
            </div>

            {/* Infos */}
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <div className="font-medium truncate">{c.other.displayName}</div>
                <div className="text-[11px] text-muted truncate">@{c.other.username}</div>
              </div>
              <div className="text-sm text-muted truncate">{c.lastSnippet}</div>
            </div>

            {/* Meta rechts */}
            <div className="flex flex-col items-end gap-1">
              <span className="text-[11px] text-muted whitespace-nowrap">
                {timeAgoShort(c.lastMessageAt)}
              </span>
              {c.unread ? (
                <span className="px-2 py-[2px] rounded-full text-[11px] bg-[var(--purple)]/20 text-[var(--purple)]">
                  {c.unread}
                </span>
              ) : null}
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
