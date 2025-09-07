'use client';

import * as React from 'react';
import Image from 'next/image';

const AVATAR_PH = '/images/avatar-placeholder.png';

// Tune nach Bedarf
const MIN_FETCH_GAP_MS = 1000; // min. 1s Abstand zwischen Fetches
const EVENT_THROTTLE_MS = 500; // Events werden zusammengelegt

type ApiComment = {
  id: string;
  text: string;
  createdAt: string; // ISO
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
  };
};

export default function CommentsThread({ postId }: { postId: string }) {
  const [items, setItems] = React.useState<ApiComment[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [hasMore, setHasMore] = React.useState(false);

  // Refs für Stabilität / Entkoppelung
  const startedRef = React.useRef(false);               // Strict-Mode Guard
  const inFlightRef = React.useRef(false);              // kein paralleler Fetch
  const lastFetchAtRef = React.useRef<number>(0);       // Mindestabstand
  const cursorRef = React.useRef<string | null>(null);  // Pagination
  const eventTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchOnce = React.useCallback(async (reset = false) => {
    // Blockiere, falls gerade ein Fetch läuft
    if (inFlightRef.current) return;

    // Mindestabstand zwischen zwei Requests
    const now = Date.now();
    if (!reset && now - lastFetchAtRef.current < MIN_FETCH_GAP_MS) return;

    inFlightRef.current = true;
    setLoading(true);
    setErr(null);

    try {
      const url = new URL(`/api/post/${postId}/comments`, window.location.origin);
      const cur = reset ? null : cursorRef.current;
      if (cur) url.searchParams.set('cursor', cur);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'Failed to load comments');

      const next: string | null = json.nextCursor ?? null;
      cursorRef.current = next;
      setHasMore(Boolean(next));

      setItems(prev => (reset ? json.items : [...prev, ...json.items]));
      lastFetchAtRef.current = Date.now();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load comments');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  }, [postId]);

  // Initial laden – bewahrt vor Strict-Mode Doppelstart
  React.useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    // Reset
    setItems([]);
    setHasMore(false);
    setErr(null);
    cursorRef.current = null;
    lastFetchAtRef.current = 0;

    void fetchOnce(true);

    return () => {
      // Cleanup evtl. Timer
      if (eventTimerRef.current) {
        clearTimeout(eventTimerRef.current);
        eventTimerRef.current = null;
      }
      inFlightRef.current = false;
    };
  }, [postId, fetchOnce]);

  // Auf „Kommentar erstellt/gelöscht“-Events reagieren – gedrosselt
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { postId: string };
      if (detail?.postId !== postId) return;

      // Cursor zurücksetzen und Refresh einplanen (throttle)
      cursorRef.current = null;

      if (eventTimerRef.current) return; // bereits geplant
      eventTimerRef.current = setTimeout(() => {
        eventTimerRef.current = null;
        void fetchOnce(true);
      }, EVENT_THROTTLE_MS);
    };

    window.addEventListener('comments:updated', handler as EventListener);
    return () => window.removeEventListener('comments:updated', handler as EventListener);
  }, [postId, fetchOnce]);

  if (err) return <div className="text-sm text-red-400">{err}</div>;

  return (
    <div className="mt-2">
      {items.length === 0 && !loading && (
        <div className="text-sm text-muted">No comments yet.</div>
      )}

      <ul className="space-y-3">
        {items.map((c) => (
          <li key={c.id} className="rounded-app border border-sub bg-card p-3">
            <div className="flex items-start gap-3">
              <div className="relative size-9 rounded-full overflow-hidden bg-white/10">
                <Image
                  src={c.author.avatarUrl || AVATAR_PH}
                  alt=""
                  fill
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm">
                  <span className="font-semibold">{c.author.displayName}</span>{' '}
                  <span className="text-muted">@{c.author.handle}</span>{' '}
                  <span className="text-muted">· {timeAgoShort(c.createdAt)}</span>
                </div>
                <div className="mt-1 whitespace-pre-wrap break-words">
                  {c.text}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="mt-3">
          <button
            className="px-3 h-9 rounded-lg border border-white/15 hover:bg-white/5"
            onClick={() => fetchOnce(false)}
            disabled={loading}
          >
            {loading ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}

      {loading && items.length === 0 && (
        <div className="text-sm text-muted mt-1">Loading…</div>
      )}
    </div>
  );
}

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
