'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

type SuggestItem = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  verified?: boolean;
};

type ApiResponse =
  | { ok: true; users: SuggestItem[] }
  | { ok: false; error?: string };

type Props = {
  /** Anker (Wrapper um Textarea+Tools) */
  anchorRef: React.RefObject<HTMLElement>;
  /** aktueller Text */
  value: string;
  /** Textersetzer (setzt @mention ein) */
  onChange: (next: string) => void;
  /** max. Ergebnisse */
  limit?: number;
};

const MENTION_TRIGGER = /(^|\s)@([a-z0-9_]{1,20})$/i;

// Layout-Konstanten
const GAP = 18;               // Abstand ÜBER dem Anker
const MIN_MARGIN = 8;         // Abstand zum Viewport-Rand
const PANEL_MAX_W = 640;
const PANEL_MIN_W = 280;
const Z = 2147483646;

export default function MentionSuggestChat({
  anchorRef,
  value,
  onChange,
  limit = 8,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<SuggestItem[]>([]);
  const [index, setIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Position (mit sofortiger Fallback-Position damit es sichtbar ist)
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number }>(() => {
    // Fallback: unten mittig, wird gleich korrigiert
    return {
      top: Math.max(MIN_MARGIN, window.innerHeight - 220),
      left: Math.max(MIN_MARGIN, Math.round((window.innerWidth - 360) / 2)),
      width: 360,
    };
  });

  // Trigger erkennen
  React.useEffect(() => {
    const m = value.match(MENTION_TRIGGER);
    if (!m) {
      setOpen(false);
      setQuery('');
      setItems([]);
      setIndex(0);
      return;
    }
    const q = m[2] ?? '';
    setQuery(q);
    setOpen(q.length > 0);
  }, [value]);

  // Vorschläge laden (Server + Client-Prefixfilter)
  React.useEffect(() => {
    let aborted = false;
    async function run() {
      if (!open || !query) return;
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(
          `/api/users/suggest?q=${encodeURIComponent(query)}&limit=${limit}`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: ApiResponse = await res.json();
        if (!json.ok) throw new Error(json.error || 'Failed');

        const onlyPrefix = (json.users || []).filter((u) =>
          u.handle.toLowerCase().startsWith(query.toLowerCase())
        );
        if (!aborted) {
          setItems(onlyPrefix);
          setIndex(0);
        }
      } catch (e) {
        if (!aborted) {
          setErr(e instanceof Error ? e.message : 'Failed');
          setItems([]);
        }
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    void run();
    return () => { aborted = true; };
  }, [open, query, limit]);

  // Auswahl einsetzen
  const pick = React.useCallback(
    (it: SuggestItem) => {
      if (!query) return;
      const next = value.replace(MENTION_TRIGGER, (_whole, p1: string) => {
        return `${p1}@${it.handle} `;
      });
      onChange(next);
      setOpen(false);
    },
    [onChange, query, value]
  );

  // Keyboard
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => (i + 1) % Math.max(items.length, 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (items[index]) {
          e.preventDefault();
          pick(items[index]);
        }
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, index, pick]);

  // Position berechnen (immer ÜBER dem Anker)
  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const r = anchor.getBoundingClientRect();
    const ph = panel.getBoundingClientRect().height || 200; // default 200, falls noch leer

    const width = Math.min(PANEL_MAX_W, Math.max(PANEL_MIN_W, r.width));
    const left = Math.max(MIN_MARGIN, Math.min(r.left, window.innerWidth - MIN_MARGIN - width));

    const desiredTop = r.top - ph - GAP;
    const top = Math.max(MIN_MARGIN, desiredTop);

    setPos({ top, left, width });
  }, [anchorRef]);

  React.useEffect(() => {
    if (!open) return;
    updatePosition();
    const onWin = () => updatePosition();
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);
    return () => {
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
    };
  }, [open, items, updatePosition]);

  if (!mounted || !open) return null;

  const panel = (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: Z,
      }}
      onMouseDown={(e) => e.preventDefault()} // verhindert blur im Textarea
    >
      <div className="rounded-xl border border-white/12 bg-black/92 backdrop-blur p-1 shadow-2xl">
        {loading && <div className="px-3 py-2 text-sm text-muted">Searching…</div>}
        {!loading && err && <div className="px-3 py-2 text-sm text-red-400">{err}</div>}
        {!loading && !err && items.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted">No matches</div>
        )}
        {!loading && !err && items.map((u, i) => (
          <button
            key={u.id}
            type="button"
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-white/10 ${
              i === index ? 'bg-white/10' : ''
            }`}
            onClick={() => pick(u)}
          >
            <span
              className="shrink-0 rounded-full bg-white/10 border border-white/10"
              style={{ width: 36, height: 36 }}
              aria-hidden
            />
            <span className="min-w-0">
              <div className="truncate">{u.displayName}</div>
              <div className="text-sm text-muted truncate">@{u.handle}</div>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
