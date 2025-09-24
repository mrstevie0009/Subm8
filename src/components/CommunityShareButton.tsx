// src/components/CommunityShareButton.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { useTranslations} from 'next-intl';

const AVATAR_PH = '/images/avatar-placeholder.png';

/* --- Icon wie in PostCard/CompactHeader --- */
function ShareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v10" strokeLinecap="round" />
      <path d="M8.5 6.5 12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="11" width="16" height="9" rx="2.5" />
    </svg>
  );
}

/* ---------- Positionierung neben dem Anker ---------- */
function useFloatingFromAnchor(
  open: boolean,
  anchorRef: React.RefObject<HTMLElement>,
  width = 240,
  offsetY = 8
) {
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const compute = React.useCallback(() => {
    if (!open) return;
    const a = anchorRef.current;
    if (!a || typeof window === 'undefined') return;
    const r = a.getBoundingClientRect();
    const right = r.right;
    const top = r.bottom + offsetY;
    const vw = window.innerWidth;
    const left = Math.max(8, Math.min(vw - width - 8, right - width)); // rechtsbündig, geclamped
    setPos({ top, left });
  }, [open, anchorRef, width, offsetY]);

  React.useLayoutEffect(() => { compute(); }, [compute]);
  React.useEffect(() => {
    if (!open) return;
    const fn = () => compute();
    window.addEventListener('resize', fn);
    window.addEventListener('scroll', fn, true);
    return () => {
      window.removeEventListener('resize', fn);
      window.removeEventListener('scroll', fn, true);
    };
  }, [open, compute]);

  return pos;
}

/* --- DM-Share Overlay (Portal) für generische Links --- */
function DMShareOverlayLink({
  open,
  onClose,
  url,
}: {
  open: boolean;
  onClose: () => void;
  url: string;
}) {
  const t = useTranslations('common.communities.share');
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Array<{
    id: string;
    other: { username: string; displayName: string; avatarUrl: string | null };
    lastMessageAt: string;
  }>>([]);
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/chat', { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        if (!cancelled) setItems(j.items || []);
      } catch {
        if (!cancelled) setError(t('overlay.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, t]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = !qq
      ? items
      : items.filter(i =>
          i.other.displayName.toLowerCase().includes(qq) ||
          i.other.username.toLowerCase().includes(qq)
        );
    return base.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [items, q]);

  async function send() {
    if (selected.size === 0) return;
    try {
      setSending(true);
      setError(null);
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((conversationId) =>
          fetch('/api/chat/share-link', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ conversationId, url, note: note.trim() || undefined }),
          }).then(async (r) => {
            if (!r.ok) {
              const j = await r.json().catch(() => null);
              throw new Error(j?.error || `HTTP ${r.status}`);
            }
          })
        )
      );
      onClose();
    } catch {
      setError(t('overlay.error'));
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  const overlay = (
    <div
      className="fixed inset-0 z-[2147483602]"
      data-no-nav
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {/* Panel */}
      <div
        className="absolute left-1/2 top-1/2 w-[min(720px,94vw)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#0b0b0d] p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-2 border-b border-white/10">
          <div className="text-[18px] font-semibold">{t('overlay.title')}</div>
          <div className="mt-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('overlay.search')}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
            />
          </div>
        </div>

        <div className="mt-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          {loading && <div className="px-3 py-6 text-sm text-white/70">{t('overlay.loading')}</div>}
          {!loading && error && <div className="px-3 py-3 text-sm text-red-400">{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div className="px-3 py-6 text-sm text-white/70">{t('overlay.empty')}</div>
          )}

          <ul className="divide-y divide-white/10">
            {filtered.map((c) => {
              const checked = selected.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5"
                    onClick={() => toggle(c.id)}
                  >
                    <div className="relative size-10 overflow-hidden rounded-full bg-white/10 shrink-0">
                      <Image
                        src={c.other.avatarUrl || AVATAR_PH}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium truncate">{c.other.displayName}</div>
                      <div className="text-sm text-white/70 truncate">@{c.other.username}</div>
                    </div>
                    <span
                      className={`grid place-items-center rounded-full border ${
                        checked ? 'bg-[var(--purple)] border-[var(--purple)]' : 'border-white/25'
                      }`}
                      style={{ width: 22, height: 22 }}
                      aria-hidden
                    >
                      {checked ? (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="3">
                          <path d="M5 12.5 10 17l9-10" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-3 pt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder={t('overlay.notePlaceholder')}
            className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
          />
        </div>

        <div className="px-3 pb-2 pt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
            disabled={sending}
          >
            {t('overlay.cancel')}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void send(); }}
            disabled={sending || selected.size === 0}
            className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50"
          >
            {sending ? t('overlay.sending') : t('overlay.send')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

/* --- Öffentlicher Button mit Dropdown (via Portal) --- */
export default function CommunityShareButton({
  locale,
  slug,
  name,
}: {
  locale: string;
  slug: string;
  name: string;
}) {
  const t = useTranslations('common.communities.share');
  const tBrand = useTranslations('common.brand');
  const brand = tBrand('name');
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareMenuOpen, setShareMenuOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);

  const communityUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/communities/${slug}`
      : `/${locale}/communities/${slug}`;

  const systemShare = async () => {
    try {
      if ('share' in navigator) {
        await (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share?.({
          title: `${name} – ${brand}`,
          url: communityUrl,
        });
        setShareMenuOpen(false);
        return;
      }
    } catch {}
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(communityUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  // Dropdown-Position berechnen
  const pos = useFloatingFromAnchor(shareMenuOpen, btnRef as React.RefObject<HTMLElement>, 240, 8);

  // Globaler Outside-Click (Capture), aber ignoriere Button & Menü
  React.useEffect(() => {
    if (!shareMenuOpen) return;
    const onDocDown = (e: MouseEvent | PointerEvent) => {
      const tnode = e.target as Node | null;
      const insideBtn = !!(btnRef.current && tnode && btnRef.current.contains(tnode));
      const insideMenu = !!(menuRef.current && tnode && menuRef.current.contains(tnode));
      if (insideBtn || insideMenu) return;
      setShareMenuOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShareMenuOpen(false); };
    document.addEventListener('pointerdown', onDocDown, true);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onDocDown, true);
      document.removeEventListener('keydown', onEsc);
    };
  }, [shareMenuOpen]);

  return (
    <div className="relative" data-no-nav>
      <button
        ref={btnRef}
        type="button"
        className="rounded px-2 py-1.5 hover:bg-white/10"
        onClick={() => setShareMenuOpen((v) => !v)}
        aria-label={t('aria.button')}
        title={t('aria.button')}
      >
        <span
          className="inline-grid place-items-center"
          style={{ width: 28, height: 28, color: 'rgba(255,255,255,.95)' }}
          aria-hidden
        >
          <ShareIcon />
        </span>
      </button>

      {/* Dropdown via Portal, kein Clipping durch Header */}
      {shareMenuOpen && pos && createPortal(
        <div
          ref={menuRef}
          className="z-[2147483601] rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1"
          role="menu"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: 240 }}
          // WICHTIG: verhindert, dass unser globaler capture-Listener feuert
          onPointerDownCapture={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10 flex items-center justify-between"
            onClick={() => {
              setShareMenuOpen(false);
              setShareOpen(true);
            }}
            title={t('aria.dm')}
          >
            {t('menu.dm')}
            <span className="opacity-70 text-xs">→</span>
          </button>

          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
            onClick={copyLink}
            title={t('aria.copy')}
          >
            {copied ? t('menu.copied') : t('menu.copy')}
          </button>

          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
            onClick={systemShare}
            title={t('aria.system')}
          >
            {t('menu.system')}
          </button>
        </div>,
        document.body
      )}

      {/* DM Share Overlay (Community-Link) */}
      {shareOpen && (
        <DMShareOverlayLink
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          url={communityUrl}
        />
      )}
    </div>
  );
}
