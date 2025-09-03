// src/app/[locale]/chat/page.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom'; // ⬅️ Wichtig: Portals kommen aus react-dom
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';

import { reportUserAction } from '@/app/actions/reports';
import { blockUserAction } from '@/app/actions/blocks';

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
  muted?: boolean;
};

/* ------------ ActionMenu (Portal) ------------ */
type MenuProps = {
  anchorRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
};
function ActionMenu({ anchorRect, onClose, children }: MenuProps) {
  const gap = 8;
  const topPreferred = anchorRect.top - gap;
  const openUpwards = topPreferred > 160;
  const style: React.CSSProperties = {
    position: 'fixed',
    left: anchorRect.left,
    width: Math.max(260, Math.min(340, anchorRect.width)),
    top: openUpwards ? topPreferred : anchorRect.bottom + gap,
    transform: openUpwards ? 'translateY(-100%)' : undefined,
    zIndex: 2147483601,
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onClickAway = () => onClose();
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onClickAway);
    window.addEventListener('touchstart', onClickAway);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onClickAway);
      window.removeEventListener('touchstart', onClickAway);
    };
  }, [onClose]);

  const panel = (
    <div style={style} onMouseDown={(e) => e.stopPropagation()}>
      <div className="rounded-xl border border-white/12 bg-black/90 backdrop-blur p-1 shadow-2xl">
        {children}
      </div>
    </div>
  );
  return createPortal(panel, document.body); // ⬅️ hier createPortal verwenden
}

/* ------------ Einzelne Chat-Zeile mit Long-Press ------------ */
function ChatRow({
  c,
  locale,
  onDeleted,
  onMutedChange,
}: {
  c: Item;
  locale: string;
  onDeleted: (id: string) => void;
  onMutedChange: (id: string, muted: boolean) => void;
}) {
  const rowRef = React.useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [anchor, setAnchor] = React.useState<DOMRect | null>(null);
  const pressTimer = React.useRef<number | null>(null);
  const suppressClick = React.useRef(false);

  const openMenu = React.useCallback(() => {
    const rect = rowRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor(rect);
    setMenuOpen(true);
    suppressClick.current = true;
  }, []);

  const clearTimer = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.button === 2) return;
    clearTimer();
    pressTimer.current = window.setTimeout(() => {
      openMenu();
    }, 420);
  };
  const handlePointerUp = () => clearTimer();
  const handlePointerLeave = () => clearTimer();

  const handleContextMenu: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    openMenu();
  };

  const handleClickCapture: React.MouseEventHandler<HTMLDivElement> = (e) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClick.current = false;
    }
  };

  async function toggleMute() {
    try {
      // Optional: API-Call zum Server
      onMutedChange(c.id, !c.muted);
    } finally {
      setMenuOpen(false);
    }
  }
  async function deleteChat() {
    try {
      await fetch(`/api/chat/${c.id}`, { method: 'DELETE' });
      onDeleted(c.id);
    } catch {
      // optional: Toast
    } finally {
      setMenuOpen(false);
    }
  }

  return (
    <div
      ref={rowRef}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
      onClickCapture={handleClickCapture}
    >
      <Link
        href={`/${locale}/chat/${c.id}`}
        className="grid grid-cols-[3.2em_1fr_auto] items-center gap-3 rounded-app border border-sub bg-card p-3 hover:bg-white/5"
        prefetch={false}
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
            {c.muted && (
              <span className="ml-1 text-[10px] px-1.5 py-[1px] rounded-full bg-white/10 text-white/70">
                muted
              </span>
            )}
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

      {menuOpen && anchor && (
        <ActionMenu anchorRect={anchor} onClose={() => setMenuOpen(false)}>
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
            onClick={toggleMute}
          >
            {c.muted ? 'Unmute chat' : 'Mute chat'}
          </button>

          <form action={reportUserAction} onSubmit={() => setMenuOpen(false)} className="contents">
            <input type="hidden" name="handle" value={c.other.username} />
            <input type="hidden" name="reason" value="OTHER" />
            <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-300">
              Report user
            </button>
          </form>

          <form action={blockUserAction} onSubmit={() => setMenuOpen(false)} className="contents">
            <input type="hidden" name="blockedHandle" value={c.other.username} />
            <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-300">
              Block user
            </button>
          </form>

          <div className="h-px my-1 bg-white/10" />

          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-400"
            onClick={deleteChat}
          >
            Delete chat
          </button>
        </ActionMenu>
      )}
    </div>
  );
}

/* ------------ Seite ------------ */
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
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return items;
    return items.filter(
      (i) =>
        i.other.displayName.toLowerCase().includes(qq) ||
        i.other.username.toLowerCase().includes(qq) ||
        i.lastSnippet.toLowerCase().includes(qq)
    );
  }, [items, q]);

  const handleDeleted = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));
  const handleMutedChange = (id: string, muted: boolean) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, muted } : x)));

  return (
    <main className="mx-auto px-3" style={{ maxWidth: 760 }}>
      <h1 className="text-6xl md:text-5xl font-extrabold leading-tight tracking-tight mb-3">
        Messages
      </h1>

      <div
        className="sticky z-10 bg-black/50 backdrop-blur border-y border-white/10"
        style={{ top: 'calc(var(--chat-header-h, var(--header-h, 56px)) + 1px)' }}
      >
        <div className="grid grid-cols-[auto_1fr] items-center gap-2 px-1 py-2">
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
              style={{
                color: 'rgba(255,255,255,.95)',
                position: 'absolute',
                inset: 0,
                width: '70%',
                height: '70%',
                margin: 'auto',
              }}
            >
              <rect x="3" y="6" width="18" height="2" rx="1" />
              <rect x="3" y="11" width="18" height="2" rx="1" />
              <rect x="3" y="16" width="18" height="2" rx="1" />
            </svg>
          </Link>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search through messages"
            className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
          />
        </div>
      </div>

      {error && <div className="my-2 text-sm text-red-500">{error}</div>}

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
            <ChatRow
              key={c.id}
              c={c}
              locale={locale}
              onDeleted={handleDeleted}
              onMutedChange={handleMutedChange}
            />
          ))}
        </div>
      )}
    </main>
  );
}
