// src/app/[locale]/chat/page.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

import { reportUserAction } from '@/app/actions/reports';
import { blockUserAction } from '@/app/actions/blocks';

const AVATAR_PH = '/images/avatar-placeholder.png';
const PINS_STORAGE_KEY = 'chat:pinned:v1';

// ---- Envelope Prefixes (müssen mit Thread-Seite übereinstimmen) ----
const TIPREQ_PREFIX  = 'TIPREQ::';
const TIPPAID_PREFIX = 'TIPPAID::';
const OWNREQ_PREFIX  = 'OWNREQ::';
const OWNACC_PREFIX  = 'OWNACC::';
const ADREQ_PREFIX   = 'ADREQ::';
const ADACC_PREFIX   = 'ADACC::';
const REACT_PREFIX   = 'REACT::';
const REPLY_PREFIX   = 'REPLY::';
const CHAT_CACHE_KEY = 'chat:list:v1';

function readCachedItems(): Item[] | null {
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; items: Item[] };
    // max 3 Minuten gültig
    if (Date.now() - parsed.ts > 3 * 60 * 1000) return null;
    return parsed.items || null;
  } catch { return null; }
}

function writeCachedItems(items: Item[]) {
  try {
    localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

function fmtCurrency(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

type OwnershipReqSnippet = {
  avatar?: true;
  banner?: true;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  avatarDataUrl?: string;
  bannerDataUrl?: string;
};

type ReactionPayload = { to: string; emoji: string; op?: 'add' | 'remove' };
function parseReactionEnvelope(raw?: string | null): ReactionPayload | null {
  if (!raw || !raw.startsWith(REACT_PREFIX)) return null;
  try {
    const obj = JSON.parse(raw.slice(REACT_PREFIX.length));
    if (obj && typeof obj.to === 'string' && typeof obj.emoji === 'string') {
      return obj as ReactionPayload;
    }
  } catch {}
  return null;
}

type ReplyPayload = { to: string; text: string };
function parseReplyEnvelope(raw?: string | null): ReplyPayload | null {
  if (!raw || !raw.startsWith(REPLY_PREFIX)) return null;
  try {
    const obj = JSON.parse(raw.slice(REPLY_PREFIX.length));
    if (obj && typeof obj.to === 'string' && typeof obj.text === 'string') {
      return obj as ReplyPayload;
    }
  } catch {}
  return null;
}

function withQuery(
  pathname: string | null,
  search: ReturnType<typeof useSearchParams>,
  patch: Record<string, string | undefined>
) {
  const p = pathname ?? '/';
  const next = new URLSearchParams(search.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${p}?${qs}` : p;
}

/* ---------- Erkennung von geteilten App-Links (Post/Profil/allg. Link) ---------- */
type LinkKind =
  | { kind: 'post' }
  | { kind: 'profile'; handle: string }
  | { kind: 'link' };

function classifyAppLink(raw: string): LinkKind | null {
  const s = raw.trim();
  if (!s) return null;

  const looksLikeUrl = /^(https?:\/\/|\/)/i.test(s);
  if (!looksLikeUrl) return null;

  let u: URL;
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    u = new URL(s, base);
  } catch {
    return null;
  }

  const seg = u.pathname.split('/').filter(Boolean);

  if (seg[0] === 'p' && seg[1]) return { kind: 'post' };
  if (seg[0] === 'u' && seg[1]) return { kind: 'profile', handle: seg[1] };

  return { kind: 'link' };
}

function truncateMid(s: string, max = 80) {
  const t = s.trim().replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + '…';
}

type Item = {
  id: string;
  other: { id: string; username: string; displayName: string; avatarUrl: string | null };
  lastMessageAt: string; // ISO
  lastSnippet: string;
  /** Wer hat die letzte Nachricht gesendet? Optional; wenn nicht vorhanden, wird other als Actor verwendet. */
  lastAuthorId?: string;
  unread: number;
  muted?: boolean;
  lastMediaType?: 'image' | 'video' | 'audio' | 'file';
};

/* ------------ ActionMenu (Portal) ------------ */
type MenuProps = {
  anchorRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
};

function ActionMenu({ anchorRect, onClose, children }: MenuProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; openUpwards: boolean } | null>(null);

  const gap = 8;
  const margin = 8;

  const compute = React.useCallback(() => {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const width = Math.max(260, Math.min(340, anchorRect.width));

    let left = Math.round(anchorRect.left);
    left = Math.min(Math.max(margin, left), winW - width - margin);

    const spaceAbove = Math.max(0, anchorRect.top - margin);
    const spaceBelow = Math.max(0, winH - anchorRect.bottom - margin);

    let openUpwards = spaceAbove > spaceBelow;

    let top = openUpwards ? Math.round(anchorRect.top - gap) : Math.round(anchorRect.bottom + gap);

    const h = panelRef.current?.offsetHeight ?? 0;

    if (h > 0) {
      if (openUpwards) {
        const topEdge = top - h;
        if (topEdge < margin) {
          openUpwards = false;
          top = Math.round(anchorRect.bottom + gap);
        }
      }
      if (!openUpwards) {
        const bottomEdge = top + h;
        if (bottomEdge > winH - margin) {
          if (spaceAbove >= h + gap) {
            openUpwards = true;
            top = Math.round(anchorRect.top - gap);
          } else {
            top = Math.max(margin, winH - margin - h);
          }
        }
      }
    }

    setPos({ top, left, width, openUpwards });
  }, [anchorRect]);

  React.useLayoutEffect(() => {
    compute();
  }, [compute]);

  React.useEffect(() => {
    const onOutside = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!panelRef.current) return;
      if (target && panelRef.current.contains(target)) return;
      onClose();
    };
    document.addEventListener('pointerdown', onOutside, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onOutside);
    };
  }, [onClose]);

  React.useEffect(() => {
    const reflow = () => compute();
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, { passive: true });
    return () => {
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow);
    };
  }, [compute]);

  if (!pos) return null;

  const containerStyle: React.CSSProperties = {
    position: 'fixed',
    left: pos.left,
    top: pos.top,
    width: pos.width,
    transform: pos.openUpwards ? 'translateY(-100%)' : undefined,
    zIndex: 2147483601,
  };

  const panel = (
    <div style={containerStyle}>
      <div ref={panelRef} className="rounded-xl border border-white/12 bg-black/90 backdrop-blur p-1 shadow-2xl">
        {children}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

/* ------------ Einzelne Chat-Zeile mit Long-Press ------------ */
function ChatRow({
  c,
  locale,
  isPinned,
  onPinnedChange,
  onDeleted,
  onMutedChange,
}: {
  c: Item;
  locale: string;
  isPinned: boolean;
  onPinnedChange: (id: string, pinned: boolean) => void;
  onDeleted: (id: string) => void;
  onMutedChange: (id: string, muted: boolean) => void;
}) {
  const t = useTranslations('chat.chat');
  const tTime = useTranslations('common.time');

  const MEDIA_PREFIX = 'MEDIA::';
  function parseMediaEnvelope(raw?: string | null): 'image' | 'video' | 'audio' | 'file' | null {
    if (!raw || !raw.startsWith(MEDIA_PREFIX)) return null;
    const k = raw.slice(MEDIA_PREFIX.length);
    return (k === 'image' || k === 'video' || k === 'audio' || k === 'file') ? k : null;
  }

  // Snippet-Shape für Anzeige
  type Snippet =
    | { type: 'text'; text: string }
    | { type: 'reaction'; text: string; emoji: string };

  // i18n-Formatter inkl. Envelopes
  const formatSnippet = React.useCallback((raw: string, actorName?: string | null): Snippet => {

    const m = parseMediaEnvelope(raw);
    if (m) {
      // Keine i18n-Keys in deinem Bundle → kurze, neutrale Labels:
      const label = m === 'image' ? 'Photo'
                  : m === 'video' ? 'Video'
                  : m === 'audio' ? 'Audio'
                  : 'File';
      return { type: 'text', text: label };
    }
    if (!raw) return { type: 'text', text: '' };

    // Reactions (REACT::)
    const rx = parseReactionEnvelope(raw);
    if (rx) {
      const emoji = rx.emoji || '👍';
      const op = rx.op === 'remove' ? 'remove' : 'add';
      const user = actorName || t('you');
      return {
        type: 'reaction',
        emoji,
        text:
          op === 'remove'
            ? t('system.reaction.removed', { user, emoji })
            : t('system.reaction.added', { user, emoji }),
      };
    }

    // Reply (REPLY::)
    const reply = parseReplyEnvelope(raw);
    if (reply) {
      const who = actorName || t('you');
      const text = reply.text ? truncateMid(reply.text, 80) : '';
      return { type: 'text', text: `↩︎ ${who}: ${text}` };
    }

    // Ownership accepted
    if (raw.startsWith(OWNACC_PREFIX)) return { type: 'text', text: t('system.ownershipAccepted') };

    // Ownership request
    if (raw.startsWith(OWNREQ_PREFIX)) {
      try {
        const p = JSON.parse(raw.slice(OWNREQ_PREFIX.length)) as OwnershipReqSnippet;
        const parts: string[] = [];
        if (p.avatar || p.avatarUrl || p.avatarDataUrl) parts.push(t('system.part.avatar'));
        if (p.banner || p.bannerUrl || p.bannerDataUrl) parts.push(t('system.part.banner'));
        if (p.bio && p.bio.trim()) parts.push(t('system.part.bio'));
        return {
          type: 'text',
          text: parts.length
            ? t('system.ownershipRequestWithParts', { parts: parts.join(', ') })
            : t('system.ownershipRequest'),
        };
      } catch {
        return { type: 'text', text: t('system.ownershipRequest') };
      }
    }

    // Tip request
    if (raw.startsWith(TIPREQ_PREFIX)) {
      try {
        const body = JSON.parse(raw.slice(TIPREQ_PREFIX.length)) as { amountCents?: number; currency?: string };
        if (typeof body?.amountCents === 'number') {
          const amount = fmtCurrency(body.amountCents, body?.currency || 'EUR');
          return { type: 'text', text: t('system.tipRequest', { amount }) };
        }
      } catch {}
    }

    // Tip paid
    if (raw.startsWith(TIPPAID_PREFIX)) {
      try {
        const body = JSON.parse(raw.slice(TIPPAID_PREFIX.length)) as { amountCents?: number; currency?: string };
        if (typeof body?.amountCents === 'number') {
          const amount = fmtCurrency(body.amountCents, body?.currency || 'EUR');
          return { type: 'text', text: t('system.tipPaid', { amount }) };
        }
      } catch {}
    }

    // Auto-Drain request / accepted (kurze Labels)
    if (raw.startsWith(ADREQ_PREFIX)) {
      try {
        const body = JSON.parse(raw.slice(ADREQ_PREFIX.length)) as { amountCents?: number; currency?: string; cadence?: string };
        const amount = typeof body?.amountCents === 'number' ? fmtCurrency(body.amountCents, body?.currency || 'EUR') : '';
        const cad = body?.cadence ? ` • ${body.cadence}` : '';
        return { type: 'text', text: `Auto-drain request: ${amount}${cad}` };
      } catch {
        return { type: 'text', text: 'Auto-drain request' };
      }
    }
    if (raw.startsWith(ADACC_PREFIX)) {
      try {
        const body = JSON.parse(raw.slice(ADACC_PREFIX.length)) as { amountCents?: number; currency?: string; cadence?: string };
        const amount = typeof body?.amountCents === 'number' ? fmtCurrency(body.amountCents, body?.currency || 'EUR') : '';
        const cad = body?.cadence ? ` • ${body.cadence}` : '';
        return { type: 'text', text: `Auto-drain enabled: ${amount}${cad}` };
      } catch {
        return { type: 'text', text: 'Auto-drain enabled' };
      }
    }

    // Freitext oder Link-Share
    const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const first = lines[0] ?? '';
    const note  = lines.slice(1).join(' ').trim();

    const link = classifyAppLink(first);
    if (link) {
      const label =
        link.kind === 'post'
          ? t('system.shared.post')
          : link.kind === 'profile'
          ? t('system.shared.profile', { handle: link.handle })
          : t('system.shared.link');
      return { type: 'text', text: note ? `${label} — ${truncateMid(note, 80)}` : label };
    }

    // Normale Nachricht
    return { type: 'text', text: raw.replace(/\s+/g, ' ').trim() };
  }, [t]);

  const timeAgoShort = React.useCallback((iso: string) => {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = Math.max(0, now - then);
    const m = Math.floor(diff / 60000);
    if (m < 1) return tTime('now');
    if (m < 60) return tTime('m', { count: m });
    const h = Math.floor(m / 60);
    if (h < 24) return tTime('h', { count: h });
    const d = Math.floor(h / 24);
    return tTime('d', { count: d });
  }, [tTime]);

  const router = useRouter();
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

  function openChat() {
    router.push(`/${locale}/chat/${c.id}`);
  }
  const onKeyRow: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openChat();
    }
  };

  async function toggleMute() {
    try {
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
      // optional toast
    } finally {
      setMenuOpen(false);
    }
  }
  function togglePin() {
    onPinnedChange(c.id, !isPinned);
    setMenuOpen(false);
  }

  const profileHref = `/${locale}/u/${c.other.username}`;

  // Wer hat die letzte Nachricht gesendet? Standard: other
  const actorIsOther = c.lastAuthorId ? c.lastAuthorId === c.other.id : true;
  const actorName = actorIsOther ? c.other.displayName : t('you');

  const snippet = React.useMemo(
    () => formatSnippet(c.lastSnippet, actorName),
    [c.lastSnippet, actorName, formatSnippet]
  );

  return (
    
    <div
      ref={rowRef}
      className="grid grid-cols-[3.2em_1fr_auto] items-center gap-3 rounded-app border border-sub bg-card p-3 hover:bg-white/5 cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={openChat}
      onKeyDown={onKeyRow}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
      onClickCapture={handleClickCapture}
    >
      <div className="shrink-0 w-[3.2em] flex flex-col items-center">
        <Link
          href={profileHref}
          prefetch={false}
          className="size-[3.2em] rounded-full overflow-hidden grid place-items-center bg-white/10 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <Image src={c.other.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" sizes="3.2em" />
        </Link>
      </div>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <Link
            href={profileHref}
            prefetch={false}
            className="font-medium truncate hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {c.other.displayName}
          </Link>
          <Link
            href={profileHref}
            prefetch={false}
            className="text-[11px] text-muted truncate hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            @{c.other.username}
          </Link>
          
          {c.muted && (
            <span className="ml-1 text-[10px] px-1.5 py-[1px] rounded-full bg-white/10 text-white/70">
              {t('row.badges.muted')}
            </span>
          )}
          {isPinned && (
            <span className="ml-1 text-[10px] px-1.5 py-[1px] rounded-full bg-[var(--purple)]/15 text-[var(--purple)]">
              {t('row.badges.pinned')}
            </span>
          )}
        </div>

        {/* Snippet (sichtbar mit Absender + Icons) */}
        <div className="text-sm text-muted flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 text-white/80">
            {actorIsOther ? c.other.displayName : t('you')}:
          </span>

          {snippet.type === 'reaction' && (
            <span aria-hidden className="shrink-0">{snippet.emoji}</span>
          )}

          {parseReplyEnvelope(c.lastSnippet) && (
            <span className="shrink-0 opacity-80" aria-hidden>↩︎</span>
          )}

          <span className="flex-1 min-w-0 truncate">
            {snippet.text && snippet.text.trim().length > 0 ? snippet.text : '…'}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1">
        <span className="text-[11px] text-muted whitespace-nowrap">{timeAgoShort(c.lastMessageAt)}</span>
        {c.unread ? (
          <span className="px-2 py-[2px] rounded-full text-[11px] bg-[var(--purple)]/20 text-[var(--purple)]">{c.unread}</span>
        ) : null}
      </div>

      {menuOpen && anchor && (
        <ActionMenu anchorRect={anchor} onClose={() => setMenuOpen(false)}>
          <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10" onClick={togglePin}>
            {isPinned ? t('row.menu.unpin') : t('row.menu.pin')}
          </button>

          <div className="h-px my-1 bg-white/10" />

          <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10" onClick={toggleMute}>
            {c.muted ? t('row.menu.unmute') : t('row.menu.mute')}
          </button>

          <form action={reportUserAction} onSubmit={() => setMenuOpen(false)} className="contents">
            <input type="hidden" name="handle" value={c.other.username} />
            <input type="hidden" name="reason" value="OTHER" />
            <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-300">
              {t('row.menu.report')}
            </button>
          </form>

          <form action={blockUserAction} onSubmit={() => setMenuOpen(false)} className="contents">
            <input type="hidden" name="blockedHandle" value={c.other.username} />
            <button className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-300">
              {t('row.menu.block')}
            </button>
          </form>

          <div className="h-px my-1 bg-white/10" />

          <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-400" onClick={deleteChat}>
            {t('row.menu.delete')}
          </button>
        </ActionMenu>
      )}
    </div>
  );
}


function ChatRowSkeleton() {
  return (
    <div className="grid grid-cols-[3.2em_1fr_auto] items-center gap-3 rounded-app border border-sub bg-card p-3">
      <div className="shrink-0 w-[3.2em]">
        <div className="size-[3.2em] rounded-full bg-white/10 animate-pulse" />
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
          <div className="h-3 w-20 bg-white/10 rounded animate-pulse" />
        </div>
        <div className="mt-2 h-3 w-[75%] bg-white/10 rounded animate-pulse" />
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="h-3 w-10 bg-white/10 rounded animate-pulse" />
        <div className="h-4 w-6 bg-white/10 rounded-full animate-pulse" />
      </div>
    </div>
  );
}

/* ------------ Seite ------------ */
export default function ChatListPage() {
  React.useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);
  const t = useTranslations('chat.chat');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = React.useState<Item[]>([]);
  const [q, setQ] = React.useState('');
  const [qLive, setQLive] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 120);
    return () => clearTimeout(t);
  }, [qLive]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [pinned, setPinned] = React.useState<Set<string>>(new Set());

  type Filter = 'all' | 'unread' | 'pinned';
  const [filter, setFilter] = React.useState<Filter>('all');

  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        // triggert den Effekt oben erneut
        setItems((prev) => prev);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);


  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(PINS_STORAGE_KEY);
      if (raw) setPinned(new Set<string>(JSON.parse(raw)));
    } catch {}
  }, []);

  const persistPins = React.useCallback((next: Set<string>) => {
    setPinned(new Set(next));
    try {
      localStorage.setItem(PINS_STORAGE_KEY, JSON.stringify(Array.from(next)));
    } catch {}
  }, []);

  React.useEffect(() => {
  let cancelled = false;
  const myReq = ++latestReqRef.current;

  (async () => {
    // 1) Erst Cache (wenn vorhanden) → sofort rendern
    const cached = readCachedItems();
    if (!cancelled && cached && cached.length) {
      setItems(cached);
      setLoading(false); // sofort UI zeigen
    }

    // 2) Netz → frische Daten
    try {
      setError(null);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000); // Safety-Timeout
      const res = await fetch('/api/chat', { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'Unknown error');

      if (cancelled || myReq !== latestReqRef.current) return;

      const fresh = json.items as Item[];
      setItems(fresh);
      writeCachedItems(fresh);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('loadingError');
      if (!cancelled && myReq === latestReqRef.current) setError(msg);
    } finally {
      if (!cancelled && myReq === latestReqRef.current) setLoading(false);
    }
  })();

  return () => { cancelled = true; };
}, [t]);

  // 🔹 Leichtes Polling (sichtbar = true)
  React.useEffect(() => {
    const tick = async () => {
      // wenn gerade getippt/gefiltert → trotzdem leise aktualisieren
      const myReq = ++latestReqRef.current;
      try {
        const res = await fetch('/api/chat', { cache: 'no-store' });
        const j = await res.json().catch(() => null);
        if (!j?.ok || myReq !== latestReqRef.current) return;
        const fresh = j.items as Item[];

        // nur updaten wenn sich wirklich was ändert (len oder IDs/Zeitstempel)
        const before = items.map(i => `${i.id}:${i.lastMessageAt}:${i.unread}`).join('|');
        const after  = fresh.map(i => `${i.id}:${i.lastMessageAt}:${i.unread}`).join('|');
        if (before !== after) {
          setItems(fresh);
          writeCachedItems(fresh);
        }
      } catch {}
    };

    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);

    pollRef.current = window.setInterval(() => {
      if (!document.hidden) tick();
    }, 8000);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [items]);

  React.useEffect(() => {
    if (items.length === 0) return;
    const ids = new Set(items.map((i) => i.id));
    const next = new Set(Array.from(pinned).filter((id) => ids.has(id)));
    if (next.size !== pinned.size) persistPins(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const handleDeleted = (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    if (pinned.has(id)) {
      const next = new Set(pinned);
      next.delete(id);
      persistPins(next);
    }
  };

  const handleMutedChange = (id: string, muted: boolean) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, muted } : x)));

  const handlePinnedChange = (id: string, wantPinned: boolean) => {
    const next = new Set(pinned);
    if (wantPinned) next.add(id);
    else next.delete(id);
    persistPins(next);
  };
  // 🔹 letzte Request-ID (verhindert Re-Race älterer Antworten)
  const latestReqRef = React.useRef(0);

  // 🔹 Polling-Timer
  const pollRef = React.useRef<number | null>(null);
  const totalConversations = items.length;
  const unreadConversations = React.useMemo(
    () => items.filter((i) => i.unread > 0).length,
    [items]
  );

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();

    let base = !qq
      ? items
      : items.filter(
          (i) =>
            i.other.displayName.toLowerCase().includes(qq) ||
            i.other.username.toLowerCase().includes(qq) ||
            i.lastSnippet.toLowerCase().includes(qq)
        );

    if (filter === 'unread') {
      base = base.filter((i) => i.unread > 0);
    } else if (filter === 'pinned') {
      base = base.filter((i) => pinned.has(i.id));
    }

    const byTimeDesc = (a: Item, b: Item) =>
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();

    if (filter === 'all') {
      const pinnedItems = base.filter((i) => pinned.has(i.id)).sort(byTimeDesc);
      const normalItems = base.filter((i) => !pinned.has(i.id)).sort(byTimeDesc);
      return [...pinnedItems, ...normalItems];
    } else {
      return base.sort(byTimeDesc);
    }
  }, [items, q, filter, pinned]);

  const openSettings = () => {
    const href = withQuery(pathname, searchParams, { settings: '1' });
    router.push(href, { scroll: false });
  };

  return (
    <main className="mx-auto px-3" style={{ maxWidth: 760 }}>
      {/* Kompakter Seitenkopf */}
      <div className="pt-1 pb-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[clamp(20px,4.2vw,28px)] font-extrabold tracking-tight">
              {t('header.title')}
            </h1>
            <div className="mt-0.5 text-[12px] text-white/60">
              {t('header.subtitle', { total: totalConversations, unread: unreadConversations })}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Toolbar: Suche + Filter + Settings */}
      <div
        className="sticky z-10 bg-black/55 backdrop-blur border-y border-white/10"
        style={{ top: 'calc(var(--chat-header-h, var(--header-h, 56px)) + 1px)' }}
      >
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 px-1 py-2">
          {/* Suche mit Icon */}
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
            </span>
            <input
              value={qLive}
              onChange={(e) => setQLive(e.target.value)}
              placeholder={t('toolbar.searchPlaceholder')}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 pl-9 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/30"
            />
          </div>

          {/* Settings-Button */}
          <button
            type="button"
            onClick={openSettings}
            className="p-2 rounded-lg hover:bg-white/5 inline-grid place-items-center"
            aria-label={t('toolbar.settingsAria')}
            style={{ width: 'clamp(28px, 3.6vw, 36px)', height: 'clamp(28px, 3.6vw, 36px)' }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="pointer-events-none"
                 style={{ color: 'rgba(255,255,255,.95)', width: '70%', height: '70%' }}>
              <rect x="3" y="6" width="18" height="2" rx="1" />
              <rect x="3" y="11" width="18" height="2" rx="1" />
              <rect x="3" y="16" width="18" height="2" rx="1" />
            </svg>
          </button>
        </div>

        {/* Filter-Pills */}
        <div className="px-1 pb-2">
          <div className="inline-flex gap-1 rounded-xl bg-white/[.06] border border-white/10 p-1">
            {(['all','unread','pinned'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  filter === key ? 'bg-[var(--purple)]/20 text-[var(--purple)]' : 'text-white/85 hover:bg-white/10'
                }`}
              >
                {key === 'all' ? t('toolbar.filters.all') : key === 'unread' ? t('toolbar.filters.unread') : t('toolbar.filters.pinned')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="my-2 text-sm text-red-500">{error}</div>}

      {loading ? (
        <div className="space-y-2 mt-2 pb-4">
          {Array.from({ length: 8 }).map((_, i) => <ChatRowSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center" style={{ minHeight: '50vh' }}>
          <div className="text-center">
            <div className="text-2xl md:text-3xl font-semibold">{t('empty.title')}</div>
            <p className="mt-2 text-sm text-muted">{t('empty.subtitle')}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 mt-2">
          {filtered.map((c) => (
            <ChatRow
              key={c.id}
              c={c}
              locale={locale}
              isPinned={pinned.has(c.id)}
              onPinnedChange={handlePinnedChange}
              onDeleted={handleDeleted}
              onMutedChange={handleMutedChange}
            />
          ))}
        </div>
      )}
    </main>
  );
}
