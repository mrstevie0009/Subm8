// src/app/[locale]/chat/page.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter} from 'next/navigation';
import { UserBadges } from '@/components/UserBadges';
import { useSession } from 'next-auth/react'; 

import { reportUserAction } from '@/app/actions/reports';
import { blockUserAction } from '@/app/actions/blocks';

const AVATAR_PH = '/images/avatar-placeholder.png';
const PINS_STORAGE_KEY = 'chat:pinned:v1';

const isPremiumActive = (iso?: string | null) =>
  !!iso && new Date(iso).getTime() > Date.now();

// ---- Envelope Prefixes (müssen mit Thread-Seite übereinstimmen) ----
const TIPREQ_PREFIX  = 'TIPREQ::';
const TIPPAID_PREFIX = 'TIPPAID::';
const OWNREQ_PREFIX  = 'OWNREQ::';
const OWNACC_PREFIX  = 'OWNACC::';
const ADREQ_PREFIX   = 'ADREQ::';
const ADACC_PREFIX   = 'ADACC::';
const REACT_PREFIX   = 'REACT::';
const REPLY_PREFIX   = 'REPLY::';
const CHAT_CACHE_KEY = 'chat:list:v3';

function readCachedItems(): Item[] | null {
  try {
    const raw = localStorage.getItem(CHAT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; items: unknown[] };
    // max 3 Minuten gültig
    if (Date.now() - parsed.ts > 3 * 60 * 1000) return null;
    return normalizeList(parsed.items || []);
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

type Item =
  | {
      kind: 'dm';
      id: string;
      other: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
        role?: 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE';
        premiumUntil?: string | null;
        isFirstAdopter?: boolean;
      };
      lastMessageAt: string;
      lastSnippet: string;
      lastAuthorId?: string;
      lastAuthorName?: string; // optional, falls API es liefert
      unread: number;
      muted?: boolean;
      lastMediaType?: 'image' | 'video' | 'audio' | 'file';
    }
  | {
      kind: 'group';
      id: string;
      title: string;
      groupAvatarUrl?: string | null;
      memberCount?: number;
      lastMessageAt: string;
      lastSnippet: string;
      lastAuthorId?: string;
      lastAuthorName?: string; // optional
      unread: number;
      muted?: boolean;
      lastMediaType?: 'image' | 'video' | 'audio' | 'file';
    };

function isDM(i: Item): i is Extract<Item, { kind: 'dm' }> {
  return i.kind === 'dm';
}

// --- Normalizer: formt API-/Cache-Items in unser striktes Item-Shape ---
type UnknownItem = Partial<{
  kind: 'dm' | 'group' | string;
  id: string | number;
  title: string;
  groupAvatarUrl: string | null;
  memberCount: number;
  lastMessageAt: string;
  lastSnippet: string;
  lastAuthorId: string;
  lastAuthorName: string;
  unread: number | string;
  muted: boolean;
  lastMediaType: 'image' | 'video' | 'audio' | 'file' | string;
  other: Partial<{
    id: string | number;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    role?: 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE' | string;
    premiumUntil?: string | null;
    isFirstAdopter?: boolean;
  }> | null;
}>;

// 🔧 helpers to satisfy strict Item types
type RoleStrict = 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE';
type MediaStrict = 'image' | 'video' | 'audio' | 'file';

function safeISO(val?: string): string {
  return typeof val === 'string' && val.length > 0
    ? val
    : new Date(0).toISOString(); // Fallback
}

function asMediaType(v?: string): MediaStrict | undefined {
  return v === 'image' || v === 'video' || v === 'audio' || v === 'file' ? v : undefined;
}

function asRole(v?: string): RoleStrict | undefined {
  return v === 'domme' || v === 'submissive' || v === 'DOMME' || v === 'SUBMISSIVE' ? v : undefined;
}

function normalizeItem(x: UnknownItem): Item {
  if (x?.kind === 'group') {
    return {
      kind: 'group',
      id: String(x.id),
      title: x.title ?? 'Group',
      groupAvatarUrl: x.groupAvatarUrl ?? null,
      memberCount: typeof x.memberCount === 'number' ? x.memberCount : undefined,
      lastMessageAt: safeISO(x.lastMessageAt),       // 🔒 always string
      lastSnippet: x.lastSnippet ?? '',
      lastAuthorId: x.lastAuthorId,
      lastAuthorName: x.lastAuthorName,
      unread: Number(x.unread || 0),
      muted: !!x.muted,
      lastMediaType: asMediaType(x.lastMediaType),   // 🔒 narrow media type
    };
  }

  if (x?.other) {
    return {
      kind: 'dm',
      id: String(x.id),
      other: {
        id: String(x.other.id),
        username: String(x.other.username),
        displayName: String(x.other.displayName),
        avatarUrl: x.other.avatarUrl ?? null,
        role: asRole(x.other.role),                 // 🔒 narrow role
        premiumUntil: x.other.premiumUntil ?? null,
        isFirstAdopter: !!x.other.isFirstAdopter,
      },
      lastMessageAt: safeISO(x.lastMessageAt),       // 🔒 always string
      lastSnippet: x.lastSnippet ?? '',
      lastAuthorId: x.lastAuthorId,
      lastAuthorName: x.lastAuthorName,
      unread: Number(x.unread || 0),
      muted: !!x.muted,
      lastMediaType: asMediaType(x.lastMediaType),   // 🔒 narrow media type
    };
  }

  // Fallback → Group
  return {
    kind: 'group',
    id: String(x.id),
    title: x.title ?? 'Group',
    groupAvatarUrl: x.groupAvatarUrl ?? null,
    memberCount: typeof x.memberCount === 'number' ? x.memberCount : undefined,
    lastMessageAt: safeISO(x.lastMessageAt),         // 🔒 always string
    lastSnippet: x.lastSnippet ?? '',
    lastAuthorId: x.lastAuthorId,
    lastAuthorName: x.lastAuthorName,
    unread: Number(x.unread || 0),
    muted: !!x.muted,
    lastMediaType: asMediaType(x.lastMediaType),     // 🔒 narrow media type
  };
}

function normalizeList(list: unknown[]): Item[] {
  return Array.isArray(list)
    ? list.map((el) => normalizeItem(el as UnknownItem))
    : [];
}

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
    <div style={containerStyle}
        onPointerDown={(e)=>e.stopPropagation()}
        onClick={(e)=>e.stopPropagation()}>
      <div ref={panelRef}
          className="rounded-xl border bg-black/90 backdrop-blur p-1 shadow-2xl"
          onPointerDown={(e)=>e.stopPropagation()}
          onClick={(e)=>e.stopPropagation()}>
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
  const b = useTranslations('common');

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

  function openChat() {
    if (menuOpen) return;
    router.push(`/${locale}/chat/${c.id}`);
  }
  const onKeyRow: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    if (menuOpen) {                 
      e.preventDefault();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openChat();
    }
  };

  async function toggleMute(e?: React.MouseEvent) {
    e?.stopPropagation();
    try { onMutedChange(c.id, !c.muted); } finally { setMenuOpen(false); }
  }
  async function deleteChat(e?: React.MouseEvent) {
    e?.stopPropagation();
    try {
      await fetch(`/api/chat/${c.id}`, { method: 'DELETE' });
      onDeleted(c.id);
    } finally { setMenuOpen(false); }
  }
  function togglePin(e?: React.MouseEvent) {
    e?.stopPropagation();
    onPinnedChange(c.id, !isPinned);
    setMenuOpen(false);
  }

  const profileHref = isDM(c) ? `/${locale}/u/${c.other.username}` : undefined;

  // Wer hat die letzte Nachricht gesendet? Standard: other
  const actorNameDM = isDM(c)
    ? (c.lastAuthorId
        ? (c.lastAuthorId === c.other.id ? c.other.displayName : t('you'))
        : c.other.displayName)
    : (c.lastAuthorName || t('you')); // Group: wenn Name fehlt, fallback "you"/du

  const snippet = React.useMemo(
    () => formatSnippet(c.lastSnippet, actorNameDM),
    [c.lastSnippet, actorNameDM, formatSnippet]
  );

  return (
    
    <div
      ref={rowRef}
      className="grid grid-cols-[3.2em_1fr_auto] items-center gap-3 rounded-app border border-sub bg-card p-3 hover:bg-white/5 cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={openChat}
      onKeyDown={onKeyRow}
      onPointerDownCapture={(e) => {
        // only intercept if the original target is inside THIS row
        const t = e.target as Node | null;
        if (!rowRef.current?.contains(t)) return;     // ← allow portal clicks
        if (menuOpen) e.stopPropagation();
      }}
      onPointerUpCapture={(e) => {
        const t = e.target as Node | null;
        if (!rowRef.current?.contains(t)) return;     // ← allow portal clicks
        if (menuOpen) { e.preventDefault(); e.stopPropagation(); }
      }}
      onClickCapture={(e) => {
        const t = e.target as Node | null;
        if (!rowRef.current?.contains(t)) return;     // ← allow portal clicks
        if (menuOpen) { e.preventDefault(); e.stopPropagation(); }
        if (suppressClick.current) {
          e.preventDefault();
          e.stopPropagation();
          suppressClick.current = false;
        }
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
    >
      <div className="shrink-0 w-[3.2em] flex flex-col items-center">
        {isDM(c) ? (
          <Link
            href={profileHref!}
            prefetch={false}
            className="size-[3.2em] rounded-full overflow-hidden grid place-items-center bg-white/10 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <Image src={c.other.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" sizes="3.2em" />
          </Link>
        ) : (
          <span
            className="size-[3.2em] rounded-xl overflow-hidden grid place-items-center bg-white/10 relative"
            // Gruppen-Avatar (oder Placeholder-Icon)
            title="Group"
          >
            <Image
              src={c.groupAvatarUrl || AVATAR_PH}
              alt=""
              fill
              className="object-cover"
              sizes="3.2em"
            />
          </span>
        )}
      </div>

      <div className="min-w-0">
        {/* Obere Zeile: links Name+Badges, rechts die Vorschau füllt den ganzen Rest */}
        <div className="flex items-center gap-2 min-w-0">
          {/* links: Name + Badges, bekommt nur so viel Breite wie nötig */}
          <div className="-mt-2 shrink-0 flex items-center gap-1">
            <span className="font-medium truncate max-w-[40vw]">
              {isDM(c) ? c.other.displayName : (c.title || 'Group')}
            </span>

            {isDM(c) ? (
              <UserBadges
                role={c.other.role ?? 'submissive'}
                isPremium={isPremiumActive(c.other.premiumUntil)}
                isFirstAdopter={!!c.other.isFirstAdopter}
                size={16}
                className="-ml-0.5"
                premiumLabel={b('badges.verified')}
                firstAdopterLabel={b('badges.firstAdopter')}
              />
            ) : (
              // kleine Gruppen-Pill (optional)
              <span className="px-1.5 py-[1px] rounded-full bg-white/10 text-white/70 text-[11px]">
                Group{typeof c.memberCount === 'number' ? ` · ${c.memberCount}` : ''}
              </span>
            )}
          </div>

          {/* rechts: Vorschau (nimmt komplette Restbreite ein) */}
          <div className="self-center mt-2 flex items-center gap-1 min-w-0 ml-2 md:ml-3 text-[15px] md:text-[16px] text-white/85 truncate">
            {isDM(c) ? (
              <span className="opacity-70 shrink-0">
                {actorNameDM}:
              </span>
            ) : (
              // Group: kein harter Prefix-Name, nur dezentes Pfeilchen
              <span className="shrink-0 opacity-80" aria-hidden>↳</span>
            )}

            {snippet.type === 'reaction' && (
              <span aria-hidden className="shrink-0">{snippet.emoji}</span>
            )}

            {parseReplyEnvelope(c.lastSnippet) && (
              <span className="shrink-0 opacity-80" aria-hidden>↩︎</span>
            )}

            <span className="truncate">
              {snippet.text && snippet.text.trim().length > 0 ? snippet.text : '…'}
            </span>
          </div>
        </div>

        {/* Untere Zeile: Handle + kleine Status-Badges */}
        <div className="-mt-2 flex items-center gap-2 text-[11px] text-muted min-w-0">
          <span className="truncate">
            {isDM(c) ? `@${c.other.username}` : (c.title || 'Group')}
          </span>

          {c.muted && (
            <span className="px-1.5 py-[1px] rounded-full bg-white/10 text-white/70">
              {t('row.badges.muted')}
            </span>
          )}
          {isPinned && (
            <span className="px-1.5 py-[1px] rounded-full bg-[var(--purple)]/15 text-[var(--purple)]">
              {t('row.badges.pinned')}
            </span>
          )}
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
          <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10" onClick={(e)=>togglePin(e)}>
            {isPinned ? t('row.menu.unpin') : t('row.menu.pin')}
          </button>

          <div className="h-px my-1 bg-white/10" />

          <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10" onClick={(e)=>toggleMute(e)}>
            {c.muted ? t('row.menu.unmute') : t('row.menu.mute')}
          </button>

          {isDM(c) && (
            <>
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
            </>
          )}

          <div className="h-px my-1 bg-white/10" />

          <button type="button" className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10 text-red-400" onClick={(e)=>deleteChat(e)}>
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

// --- Verify Prompt (identisch zum Stil im ProfileHeader) ---
function VerifyPrompt({
  open,
  onClose,
  onStart,
  title = 'Altersnachweis erforderlich',
  message = 'Verifiziere einmalig dein Alter, um diese Funktion zu nutzen.',
  confirmLabel = 'Jetzt verifizieren',
  cancelLabel = 'Abbrechen',
}: {
  open: boolean;
  onClose: () => void;
  onStart: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483604] flex items-center justify-center" role="dialog" aria-modal="true" data-no-nav onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-[min(520px,92vw)] rounded-2xl border border-white/12 bg-[#0b0b0d] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[18px] font-semibold">{title}</h2>
        <p className="mt-2 text-white/80">{message}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="px-4 py-2 rounded-lg bg-[var(--purple)] hover:opacity-95 text-white" onClick={() => void onStart()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function NewChatDialog({
  open,
  onClose,
  onStarted,
}: {
  open: boolean;
  onClose: () => void;
  locale: string;
  onStarted: (conversationId: string) => void;
}) {
  const tn = useTranslations('chat.newChat');
  const tRole = (r?: string) =>
    r?.toLowerCase() === 'domme' ? tn('role.domme') : tn('role.sub');
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [qLive, setQLive] = React.useState('');
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<
    Array<{ id: string; handle: string; displayName: string; avatarUrl: string | null; role?: string }>
  >([]);
  const [activeIdx, setActiveIdx] = React.useState<number>(-1); // keyboard focus

  // ▼ NEW: multi-select
  const [selected, setSelected] = React.useState<
    Map<string, { id: string; handle: string; displayName: string }>
  >(new Map());

  const toggleSelect = React.useCallback((u: { id: string; handle: string; displayName: string }) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(u.id)) next.delete(u.id);
      else next.set(u.id, u);
      return next;
    });
  }, []);

  const clearSelection = () => setSelected(new Map());
  const selectedIds = React.useMemo(() => Array.from(selected.keys()), [selected]);
  const selectedList = React.useMemo(() => Array.from(selected.values()), [selected]);

  // Outside close handlers
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current && panelRef.current.contains(t)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown, { passive: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open, onClose]);

  // Debounce + @-Cleanup
  React.useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const cleaned = qLive.trim().replace(/^@+/, '');
      setQ(cleaned);
    }, 180);
    return () => clearTimeout(t);
  }, [qLive, open]);

  // Fetch search
  React.useEffect(() => {
    if (!open) return;
    if (!q) {
      setResults([]);
      setError(null);
      setActiveIdx(-1);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status} ${txt?.slice(0, 120)}`);
        }
        const j = await res.json().catch(() => null);
        const list = Array.isArray(j?.items) ? j.items : Array.isArray(j?.users) ? j.users : [];
        if (!Array.isArray(list)) throw new Error('Bad JSON');
        if (!cancelled) {
          setResults(list);
          setActiveIdx(list.length ? 0 : -1);
        }
      } catch (e) {
        if (!cancelled) {
          setResults([]);
          setActiveIdx(-1);
          setError('Suche fehlgeschlagen.');
          console.warn('users/search failed:', e);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [q, open]);

  // Existing 1:1 start
  async function startChat(userId: string, handle?: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/chat/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // ⬇️ Server erwartet toUserId ODER toHandle
        body: JSON.stringify({ toUserId: userId, toHandle: handle }),
      });

      // nützlicheres Debugging:
      const txt = await res.text();
      let j = null;
      try {
        j = JSON.parse(txt);
      } catch {}

      if (!res.ok || !j?.ok || !j?.id) {
        throw new Error(j?.error || `HTTP ${res.status} ${txt.slice(0, 120)}`);
      }

      onClose();
      onStarted(String(j.id));
    } catch (e) {
      setError(tn('errorStartChat'));
      console.warn('POST /api/chat/start failed:', e);
    } finally {
      setLoading(false);
    }
  }

  // ▼ NEW: start group (or 1:1 if only one selected)
  async function startSelected() {
    if (selectedIds.length === 0) return;

    // 1 User => wie bisher 1:1 starten
    if (selectedIds.length === 1) {
      const u = selectedList[0];
      await startChat(u.id, u.handle);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // kurzer, humaner Titel: "Alice, Bob +2"
      const titleParts = selectedList.slice(0, 2).map((u) => u.displayName);
      const title = titleParts.join(', ') + (selectedIds.length > 2 ? ` +${selectedIds.length - 2}` : '');

      const res = await fetch('/api/chat/start-group', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberIds: selectedIds, title }),
      });
      const txt = await res.text();
      let j = null;
      try {
        j = JSON.parse(txt);
      } catch {}

      if (!res.ok || !j?.ok || !j?.id) {
        throw new Error(j?.error || `HTTP ${res.status} ${txt.slice(0, 120)}`);
      }

      clearSelection();
      onClose();
      onStarted(String(j.id));
    } catch (e) {
      setError(tn('errorStartGroup'));
      console.warn('POST /api/chat/start-group failed:', e);
    } finally {
      setLoading(false);
    }
  }

  // Keyboard navigation / Enter toggles selection (not auto-start)
  const onKeyDownInput: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (i + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const u = results[activeIdx];
      if (u) toggleSelect(u);
    }
  };

  if (!open) return null;

  // Result row with checkbox
  const Item = ({
    u,
    idx,
  }: {
    u: { id: string; handle: string; displayName: string; avatarUrl: string | null; role?: string };
    idx: number;
  }) => {
    const isActive = idx === activeIdx;
    const isChecked = selected.has(u.id);
    return (
      <div
        onMouseEnter={() => setActiveIdx(idx)}
        onClick={() => toggleSelect(u)}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer ${
          isActive ? 'bg-white/10' : 'hover:bg-white/10'
        }`}
        role="button"
        tabIndex={0}
      >
        <span className="size-9 rounded-full overflow-hidden grid place-items-center bg-white/10 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u.avatarUrl || AVATAR_PH} alt="" className="w-full h-full object-cover" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block font-medium truncate">{u.displayName}</span>
          <span className="block text-xs text-white/70 truncate">@{u.handle}</span>
        </span>

        <span className="text-xs px-2 py-[2px] rounded-full bg-[var(--purple)]/15 text-[var(--purple)] mr-2">
          {tRole(u.role)}
        </span>

        {/* Checkbox rechts */}
        <input
          type="checkbox"
          className="size-5 accent-[var(--purple)]"
          onChange={() => toggleSelect(u)}
          checked={isChecked}
          aria-label={tn('checkboxAria', { name: u.displayName })}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483600]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="absolute inset-0 grid place-items-center px-3">
        <div
          ref={panelRef}
          className="w-full max-w-[560px] rounded-2xl border border-white/12 bg-neutral-900 shadow-2xl"
        >
          {/* Header mit Start-Button */}
          <div className="p-3 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="font-semibold">{tn('title')}</div>
            <div className="flex items-center gap-2">
              {selectedIds.length > 0 && (
                <span className="text-xs text-white/70">
                  {tn('selectedCount', { count: selectedIds.length })}
                </span>
              )}
              <button
                type="button"
                onClick={startSelected}
                disabled={selectedIds.length === 0 || loading}
                className={`px-3 py-1.5 rounded-lg ${
                  selectedIds.length === 0 || loading
                    ? 'bg-white/10 text-white/50 cursor-not-allowed'
                    : 'bg-[var(--purple)] text-white hover:opacity-95'
                }`}
              >
                {selectedIds.length <= 1 ? tn('startOne') : tn('startGroup')}
              </button>

              <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" aria-label={tn('closeAria')}>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="p-3">
            {/* Suche */}
            <div className="relative">
              <input
                value={qLive}
                onChange={(e) => {
                  setQLive(e.target.value);
                  setActiveIdx(-1);
                }}
                onFocus={() => {
                  if (!qLive || !/@$/.test(qLive)) setQLive((s) => (s?.startsWith('@') ? s : '@' + (s || '')));
                }}
                onKeyDown={onKeyDownInput}
                placeholder={tn('search.placeholder')}
                className="w-full rounded-xl bg-white/[.06] border border-white/10 pl-3 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/30"
                autoFocus
              />
            </div>

            {/* Ergebnisse */}
            <div className="mt-3 max-h-[50vh] overflow-auto space-y-1">
              {loading && <div className="text-sm text-white/70 px-1 py-2">{tn('loading')}</div>}
              {error && <div className="text-sm text-red-400 px-1 py-2">{tn('errorGeneric')}</div>}
              {!loading && !error && !results.length && q && (
                <div className="text-sm text-white/70 px-1 py-2">{tn('noResults')}</div>
              )}
              {results.map((u, idx) => (
                <Item key={u.id} u={u} idx={idx} />
              ))}
            </div>

            <div className="mt-3 text-xs text-white/50">
              {tn('hint')}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}




/* ------------ Seite ------------ */
export default function ChatListPage() {
  React.useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const t = useTranslations('chat.chat');
  const tVerify = useTranslations('verify');
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();             
  const ageOk = !!session?.user?.ageVerified;         
  const [verifyOpen, setVerifyOpen] = React.useState(false);

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

  const startAgeVerification = React.useCallback(async () => {
   try {
     const back =
       typeof window !== 'undefined'
         ? `${window.location.pathname}${window.location.search}`
         : `/${locale}`;
     if (!session) {
       router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
       return;
     }
     const res = await fetch(`/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`, { method: 'POST' });
     const j = await res.json().catch(() => null);
     if (!res.ok || !j?.url) throw new Error(j?.details || j?.error || `HTTP ${res.status}`);
     router.push(j.url as string);
   } catch {
     // optional: toast.error(...)
     console.warn('Veriff start failed');
   }
 }, [locale, router, session]);

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
      const res = await fetch(`/api/chat?take=25`, { cache: 'no-store', signal: ctrl.signal });
      clearTimeout(timer);

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Unknown error');

        if (cancelled || myReq !== latestReqRef.current) return;

        const fresh = normalizeList(json.items);
        setItems(fresh);
        writeCachedItems(fresh);
        setNextCursor(json?.cursors?.next ?? null);
        setHasMore(Boolean(json?.cursors?.next));
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
        const res = await fetch(`/api/chat?take=25`, { cache: 'no-store' });
        const j = await res.json().catch(() => null);
        if (!j?.ok || myReq !== latestReqRef.current) return;
        const freshTop = normalizeList(j.items);

        // Wir mergen NUR die Top-Seite in bestehende items (danach neu sortieren)
        setItems((prev) => {
          const map = new Map(prev.map(it => [it.id, it]));
          for (const f of freshTop) {
            map.set(f.id, f);
          }
          const merged = Array.from(map.values());
          merged.sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
          return merged;
        });

        // Cursor oben aktualisieren (nur informativ)
        setNextCursor(j?.cursors?.next ?? null);
        setHasMore(Boolean(j?.cursors?.next));
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

  const loadMore = React.useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/chat?take=25&after=${encodeURIComponent(nextCursor)}`, { cache: 'no-store' });
      const j = await res.json().catch(() => null);
      if (!j?.ok) return;
      const more = normalizeList(j.items);

      setItems((prev) => {
        const ids = new Set(prev.map(i => i.id));
        const appended = more.filter(i => !ids.has(i.id));
        const next = [...prev, ...appended];
        next.sort((a, b) => +new Date(b.lastMessageAt) - +new Date(a.lastMessageAt));
        return next;
      });

      setNextCursor(j?.cursors?.next ?? null);
      setHasMore(Boolean(j?.cursors?.next));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, nextCursor]);

  // Window-Scroll am Seitenende
  React.useEffect(() => {
    const onScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight;
      const docH = document.documentElement.scrollHeight || document.body.scrollHeight;
      if (docH - scrollPos < 240) {
        void loadMore();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loadMore]);

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
      : items.filter((i) => {
          if (isDM(i)) {
            return (
              i.other.displayName.toLowerCase().includes(qq) ||
              i.other.username.toLowerCase().includes(qq) ||
              i.lastSnippet.toLowerCase().includes(qq)
            );
          } else {
            return (
              (i.title?.toLowerCase().includes(qq) ?? false) ||
              i.lastSnippet.toLowerCase().includes(qq)
            );
          }
        });

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

  const [newChatOpen, setNewChatOpen] = React.useState(false);

  const handleNewChatStarted = (conversationId: string) => {
    router.push(`/${locale}/chat/${conversationId}`);
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

          {/* Neuer-Chat Button (lila Plus) */}
          <button
            type="button"
            onClick={() => {
              if (!ageOk) { setVerifyOpen(true); return; }
              setNewChatOpen(true);
            }}
            className="p-2 rounded-lg hover:bg-white/5 inline-grid place-items-center"
            aria-label={t('toolbar.newChatAria')}
            style={{ width: 'clamp(40px, 5vw, 48px)', height: 'clamp(40px, 5vw, 48px)' }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="pointer-events-none"
                style={{ width: '82%', height: '82%' }}>
              <path
                d="M12 5v14M5 12h14"
                stroke="var(--purple)"
                strokeWidth="2.6"
                strokeLinecap="round"
                fill="none"
              />
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
        <>
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

          {/* Bottom Loader / End Marker */}
          <div className="py-3 flex items-center justify-center">
            {loadingMore ? (
              <span className="text-sm text-white/70">
                {t('list.loadingMore', { default: 'Ältere Chats werden geladen…' })}
              </span>
            ) : hasMore ? (
              <button
                type="button"
                onClick={() => void loadMore()}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-sm"
              >
                {t('list.loadMore', { default: 'Mehr laden' })}
              </button>
            ) : (
              <span className="text-sm text-white/50">
                {t('list.endReached', { default: 'Keine weiteren Chats.' })}
              </span>
            )}
          </div>
        </>
      )}
      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        locale={locale}
        onStarted={handleNewChatStarted}
      />

      <VerifyPrompt
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onStart={startAgeVerification}
        title={tVerify('modal.title')}
        message={tVerify('modal.message')}
        confirmLabel={tVerify('modal.confirm')}
        cancelLabel={tVerify('modal.cancel')}
     />
    </main>
  );
}
