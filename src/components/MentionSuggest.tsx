// src/components/MentionSuggest.tsx
'use client';

import * as React from 'react';

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
  /** Anker-Element (Wrapper um das Textfeld) */
  anchorRef: React.RefObject<HTMLElement>;
  /** aktueller Textinhalt */
  value: string;
  /** Updater, der den Text ändert (setzt @-Sequenz ein) */
  onChange: (next: string) => void;
  /** max. Treffer */
  limit?: number;
};

const MENTION_TRIGGER = /(^|\s)@([a-z0-9_]{1,20})$/i;
const GAP = 22;          // ⬅️ größerer Abstand nach oben
const MIN_MARGIN = 8;    // Abstand zum Viewport-Rand
const PANEL_MAX_W = 580; // Sicherheits-Breite

export default function MentionSuggest({
  anchorRef,
  value,
  onChange,
  limit = 8,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [items, setItems] = React.useState<SuggestItem[]>([]);
  const [index, setIndex] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  // Panel-Position / -Größe
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number }>({
    top: -9999,
    left: -9999,
    width: 0,
  });

  // prüft, ob am Ende eine @-Sequenz steht
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

  // fetch Vorschläge (prefix-Match auf dem Server; zusätzlich clientseitig filtern)
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
    return () => {
      aborted = true;
    };
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

  // Keyboard-Navigation solange Panel offen ist
  React.useEffect(() => {
    if (!open) return;

    const onKey = (evt: KeyboardEvent) => {
      if (!open) return;
      if (evt.key === 'ArrowDown') {
        evt.preventDefault();
        setIndex((i) => (i + 1) % Math.max(items.length, 1));
      } else if (evt.key === 'ArrowUp') {
        evt.preventDefault();
        setIndex((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
      } else if (evt.key === 'Enter' || evt.key === 'Tab') {
        if (items[index]) {
          evt.preventDefault();
          pick(items[index]);
        }
      } else if (evt.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, items, index, pick]);

  // Position über dem Textfeld berechnen (mit extra Abstand)
  const updatePosition = React.useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const r = anchor.getBoundingClientRect();
    const panelH = panel.getBoundingClientRect().height || 0;

    // Links am Textfeld ausrichten, aber an den Viewport klammern
    const left = Math.max(MIN_MARGIN, Math.min(r.left, window.innerWidth - MIN_MARGIN - PANEL_MAX_W));
    // OBEN über dem Textfeld + zusätzlicher GAP; nicht über den oberen Rand gehen
    const desiredTop = r.top - panelH - GAP;
    const top = Math.max(MIN_MARGIN, desiredTop);

    const width = Math.min(PANEL_MAX_W, Math.max(280, r.width)); // Breite nahe Textfeld
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

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        zIndex: 2147483601, // über Modals/Composer
        pointerEvents: 'auto',
      }}
      onMouseDown={(e) => e.preventDefault()} // verhindert blur im Textarea
    >
      <div className="rounded-xl border border-white/12 bg-black/92 backdrop-blur p-1 shadow-2xl">
        {loading && (
          <div className="px-3 py-2 text-sm text-muted">Searching…</div>
        )}
        {!loading && err && (
          <div className="px-3 py-2 text-sm text-red-400">{err}</div>
        )}
        {!loading && !err && items.length === 0 && (
          <div className="px-3 py-2 text-sm text-muted">No matches</div>
        )}
        {!loading &&
          !err &&
          items.map((u, i) => (
            <button
              key={u.id}
              type="button"
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-white/10 ${
                i === index ? 'bg-white/10' : ''
              }`}
              onClick={() => pick(u)}
            >
              {/* Avatar-Placeholder */}
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
}
