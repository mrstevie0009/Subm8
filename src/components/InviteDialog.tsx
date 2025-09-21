// src/components/community/InviteDialog.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';

const AVATAR_PH = '/images/avatar-placeholder.png';

export default function InviteDialog({
  open,
  onClose,
  slug,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
}) {
  // --- Link-Zustand ---
  const [linkUrl, setLinkUrl] = React.useState('');
  const [linkLoading, setLinkLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // --- DM-Overlay-Zustand (wie im Profilheader) ---
  const [loadingChats, setLoadingChats] = React.useState(true);
  const [chats, setChats] = React.useState<
    Array<{
      id: string;
      other: { username: string; displayName: string; avatarUrl: string | null };
      lastMessageAt: string;
    }>
  >([]);
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);

  // Link automatisch beim Öffnen erzeugen (einfach, ohne Parameter → Server-Defaults)
  React.useEffect(() => {
    let cancelled = false;
    async function ensureLink() {
      if (!open) return;
      try {
        setLinkLoading(true);
        setError(null);
        const r = await fetch(`/api/communities/${slug}/invites/link`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}), // Server nutzt Default-Ablauf/MaxUses
        });
        const j = await r.json().catch(() => null);
        if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
        if (!cancelled) setLinkUrl(j.url as string);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to create link');
      } finally {
        if (!cancelled) setLinkLoading(false);
      }
    }
    ensureLink();
    return () => {
      cancelled = true;
    };
  }, [open, slug]);

  // Chats laden beim Öffnen
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingChats(true);
        setError(null);
        const res = await fetch('/api/chat', { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        if (!cancelled) setChats(j.items || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load chats');
      } finally {
        if (!cancelled) setLoadingChats(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = !qq
      ? chats
      : chats.filter(
          (i) =>
            i.other.displayName.toLowerCase().includes(qq) ||
            i.other.username.toLowerCase().includes(qq)
        );
    return base.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [chats, q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  async function copyLink() {
    try {
      if (!linkUrl) return;
      await navigator.clipboard.writeText(linkUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  async function nativeShare() {
    try {
      if (navigator.share && linkUrl) {
        await navigator.share({ title: 'Community-Einladung', url: linkUrl });
      }
    } catch {}
  }

  async function regenerateLink() {
    try {
      setLinkLoading(true);
      setError(null);
      const r = await fetch(`/api/communities/${slug}/invites/link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}), // erneuter Link (neuer Code)
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) throw new Error(j?.error || `HTTP ${r.status}`);
      setLinkUrl(j.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create link');
    } finally {
      setLinkLoading(false);
    }
  }

  async function sendDMs() {
    if (selected.size === 0) return;
    // Stelle sicher, dass wir einen Link haben
    if (!linkUrl) {
      await regenerateLink();
      if (!linkUrl) return;
    }
    try {
      setSending(true);
      setError(null);
      const ids = Array.from(selected);
      const text = [linkUrl, note.trim()].filter(Boolean).join('\n\n');

      // identisch zur Logik im ProfileHeader-DMShareOverlay: roher Chat-Post
      await Promise.all(
        ids.map((conversationId) =>
          fetch(`/api/chat/${encodeURIComponent(conversationId)}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text }),
          }).then(async (r) => {
            if (!r.ok) {
              const j = await r.json().catch(() => null);
              throw new Error(j?.error || `HTTP ${r.status}`);
            }
          })
        )
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483602]"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="absolute left-1/2 top-1/2 w-[min(720px,94vw)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#0b0b0d] p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Kopfzeile + Linkzeile */}
        <div className="px-2 py-2 border-b border-white/10 space-y-3">
          <div className="text-[18px] font-semibold">Community einladen</div>

          {/* Link-Zeile */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              readOnly
              value={linkUrl}
              placeholder={linkLoading ? 'Erzeuge Link…' : 'Einladungslink'}
              className="flex-1 rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={regenerateLink}
                disabled={linkLoading}
                className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 disabled:opacity-50"
                title="Neuen Link erzeugen"
              >
                {linkLoading ? '…' : 'Neu'}
              </button>
              <button
                type="button"
                onClick={copyLink}
                disabled={!linkUrl}
                className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 disabled:opacity-50"
                title="Link kopieren"
              >
                {copied ? 'Kopiert!' : 'Kopieren'}
              </button>
              <button
                type="button"
                onClick={nativeShare}
                disabled={!linkUrl}
                className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10 disabled:opacity-50"
                title="System-Share"
              >
                Teilen…
              </button>
            </div>
          </div>

          {/* Suche */}
          <div>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Chats durchsuchen, um per DM zu senden"
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
            />
          </div>
        </div>

        {/* Fehleranzeige */}
        {error && (
          <div className="px-3 py-2 text-sm text-red-400 border-b border-white/10">{error}</div>
        )}

        {/* Chatliste */}
        <div className="mt-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          {loadingChats && (
            <div className="px-3 py-6 text-sm text-white/70">Lade Chats…</div>
          )}
          {!loadingChats && !error && filtered.length === 0 && (
            <div className="px-3 py-6 text-sm text-white/70">
              Keine Konversationen gefunden.
            </div>
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
                      <div className="text-sm text-white/70 truncate">
                        @{c.other.username}
                      </div>
                    </div>
                    <span
                      className={`grid place-items-center rounded-full border ${
                        checked
                          ? 'bg-[var(--purple)] border-[var(--purple)]'
                          : 'border-white/25'
                      }`}
                      style={{ width: 22, height: 22 }}
                      aria-hidden
                    >
                      {checked ? (
                        <svg
                          viewBox="0 0 24 24"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                        >
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

        {/* Notiz + Aktionen */}
        <div className="px-3 pt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder="Nachricht (optional)…"
            className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
          />
        </div>

        <div className="px-3 pb-2 pt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
            disabled={sending}
          >
            Schließen
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void sendDMs();
            }}
            disabled={sending || selected.size === 0 || !linkUrl}
            className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50"
          >
            {sending ? 'Senden…' : 'Per DM senden'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
