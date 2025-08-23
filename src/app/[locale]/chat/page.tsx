// src/app/[locale]/chat/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';

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

type Item = {
  id: string;
  other: { id: string; username: string; displayName: string; avatarUrl: string | null };
  lastMessageAt: string;
  lastSnippet: string;
  unread: number;
};

export default function ChatListPage() {
  const locale = useLocale();
  const [items, setItems] = React.useState<Item[]>([]);
  const [q, setQ] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const iconSize = 'clamp(28px, 3.6vw, 34px)';

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/chat', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Unknown error');
        if (!cancelled) setItems(json.items as Item[]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to load chats';
        if (!cancelled) setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(i =>
      i.other.displayName.toLowerCase().includes(qq) ||
      i.other.username.toLowerCase().includes(qq) ||
      i.lastSnippet.toLowerCase().includes(qq)
    );
  }, [items, q]);

  return (
    <main
      className="mx-auto px-3"
      style={{ maxWidth: 760 }}
    >
      {/* Titel */}
      <h1 className="text-6xl md:text-5xl font-extrabold leading-tight tracking-tight mb-3">
        Messages
      </h1>

      {/* Suche + Settings */}
      <div
        className="sticky z-10 bg-black/50 backdrop-blur border-y border-white/10"
        style={{ top: 'calc(var(--chat-header-h, var(--header-h, 56px)) + 1px)' }}
      >
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 px-1 py-2">
          {/* Settings → ?settings=1 */}
          <Link
            href={`/${locale}?settings=1`}
            prefetch={false}
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
          </Link>

          {/* Suchfeld */}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search through messages"
            className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
          />
        </div>
      </div>

      {error && <div className="my-2 text-sm text-red-500">{error}</div>}

      {/* Liste / Empty State */}
      {loading ? (
        <div className="py-8 text-sm text-muted">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-semibold">No conversations</div>
            <p className="mt-2 text-sm text-muted">Start a new chat from a profile.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 mt-2">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/${locale}/chat/${c.id}`}
              className="grid grid-cols-[3.2em_1fr_auto] items-center gap-3 rounded-app border border-sub bg-card p-3 hover:bg-white/5"
            >
              {/* Avatar */}
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
      )}
    </main>
  );
}
