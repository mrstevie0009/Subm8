// src/components/CommunityComposer.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';

type Props = { slug: string };

/** Kleiner Helper: Übersetzung ODER Fallback-String (ohne any) */
function tOr(t: (key: string) => string, key: string, fallback: string) {
  try {
    const val = t?.(key);
    return typeof val === 'string' && val.trim() ? val : fallback;
  } catch {
    return fallback;
  }
}

/* ---------------- GIF Picker (Tenor) – wie im ComposePostModal ---------------- */
const TENOR_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? 'LIVDSRZULELA'; // Demo-Key; produktiv via ENV ersetzen
const TENOR_BASE = 'https://g.tenor.com/v1';

type TenorMedia = {
  gif?: { url?: string };
  mediumgif?: { url?: string };
  tinygif?: { url?: string };
  nanogif?: { url?: string };
};
type TenorItem = { id?: string; media?: TenorMedia[] };
type TenorResp = { results?: TenorItem[] };

function GifPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (gifUrl: string) => void;
}) {
  // Übersetzungen (robust mit Fallbacks)
  const tg = useTranslations('community.gifPicker');

  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<{ id: string; url: string }[]>([]);

  const pickUrlFromItem = (it: TenorItem): string | null => {
    const m = it.media?.[0];
    return m?.gif?.url || m?.mediumgif?.url || m?.tinygif?.url || m?.nanogif?.url || null;
  };

  const run = React.useCallback(async (query?: string) => {
    setErr(null);
    setLoading(true);
    try {
      const endpoint =
        query && query.trim()
          ? `${TENOR_BASE}/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=24&media_filter=minimal`
          : `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=24&media_filter=minimal`;

      const r = await fetch(endpoint);
      const j = (await r.json()) as TenorResp;
      const list =
        (j.results ?? [])
          .map((it) => {
            const url = pickUrlFromItem(it);
            return url ? { id: it.id ?? crypto.randomUUID(), url } : null;
          })
          .filter(Boolean) as { id: string; url: string }[];

      setItems(list);
    } catch {
      setErr(tOr(tg, 'errors.loadGifs', 'Konnte GIFs nicht laden.'));
    } finally {
      setLoading(false);
    }
  }, [tg]);

  React.useEffect(() => {
    if (open) run();
  }, [open, run]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483602]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(960px,95vw)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#111] p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(q); }}
            placeholder={tOr(tg, 'searchPlaceholder', 'Nach GIFs suchen…')}
            className="flex-1 h-10 rounded-xl bg-white/[.06] border border-white/10 px-3 outline-none"
          />
          <button
            type="button"
            onClick={() => run(q)}
            className="h-10 px-4 rounded-xl bg-[var(--purple)] text-white hover:opacity-95"
          >
            {tOr(tg, 'searchButton', 'Suchen')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 rounded-xl border border-white/15 hover:bg-white/10"
          >
            {tOr(tg, 'closeButton', 'Schließen')}
          </button>
        </div>

        <div className="mt-3">
          {err && <div className="text-red-300 text-sm mb-2">{err}</div>}
          {loading ? (
            <div className="text-sm text-white/80 py-8 text-center">
              {tOr(tg, 'loadingGifs', 'Lade GIFs…')}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto max-h-[65vh] pr-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-white/25"
                  onClick={() => onPick(it.url)}
                  title={tOr(tg, 'select', 'Auswählen')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt="" loading="lazy" decoding="async" className="block w-full h-44 object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------------------- Community Composer ---------------------- */
export default function CommunityComposer({ slug }: Props) {
  const router = useRouter();

  const [text, setText] = React.useState('');

  // Media state
  const [file, setFile] = React.useState<File | null>(null);
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  const [gifUrl, setGifUrl] = React.useState<string>('');
  const [gifOpen, setGifOpen] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const canPostText = text.trim().length > 0 && text.trim().length <= 4000;
  const hasAttachment = !!file || !!gifUrl.trim();
  const canPost = (canPostText || hasAttachment) && !loading;

  // toasts (bestehender Namespace)
  const tt = useTranslations('common.toast');

  // neuer Namespace für diesen Composer (mit Fallbacks)
  const t = useTranslations('common.community.composer');

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    // nur Bild ODER Video
    const ok = f.type.startsWith('image/') || f.type.startsWith('video/');
    if (!ok) {
      setErr(tOr(t, 'errors.onlyImageOrVideo', 'Nur Bild- oder Videodateien sind erlaubt.'));
      e.target.value = '';
      return;
    }

    setErr(null);
    setGifUrl(''); // GIF-URL zurücksetzen wenn Datei gewählt wurde
    setFile(f);

    const url = URL.createObjectURL(f);
    setFilePreview((prev) => {
      if (prev && prev !== url) URL.revokeObjectURL(prev);
      return url;
    });
  }

  function clearAttachment() {
    setFile(null);
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFilePreview(null);
    setGifUrl('');
  }

  React.useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost) return;

    setLoading(true);
    setErr(null);
    try {
      // Datei oder GIF-URL -> multipart/form-data
      if (file || gifUrl.trim()) {
        const fd = new FormData();
        fd.append('text', text.trim());
        if (file) fd.append('media', file);
        if (!file && gifUrl.trim()) fd.append('gifUrl', gifUrl.trim());

        const res = await fetch(
          `/api/communities/${encodeURIComponent(slug)}/posts`,
          { method: 'POST', body: fd }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          setErr(json?.error || `HTTP ${res.status}`);
          return;
        }
      } else {
        // Nur Text
        const res = await fetch(
          `/api/communities/${encodeURIComponent(slug)}/posts`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: text.trim() }),
          }
        );
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json?.ok) {
          setErr(json?.error || `HTTP ${res.status}`);
          toast.error(tt('post.failedTitle'), tt('generic.tryAgain'));
          return;
        }
      }
      toast.show({
        title: tt('post.published'),
        variant: 'success',
        durationMs: 2000, // 2s – bei Bedarf anpassen
      });
      // Reset & Refresh
      setText('');
      clearAttachment();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : tOr(t, 'errors.generic', 'Failed to post'));
    } finally {
      setLoading(false);
    }
  }

  const isVideo = !!file && file.type.startsWith('video/');

  return (
    <form onSubmit={submit} className="space-y-3" data-no-nav>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder={tOr(t, 'placeholder', 'Whats new?')}
        className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
        maxLength={4000}
      />

      {/* Vorschau (Bild/GIF oder Video) */}
      {(filePreview || gifUrl) && (
        <div className="rounded-xl border border-white/10 p-2 bg-white/[.03]">
          <div className="flex items-start gap-3">
            <div className="shrink-0 relative w-56 h-40 overflow-hidden rounded-lg bg-black/20">
              {isVideo ? (
                <video
                  src={filePreview ?? undefined}
                  className="block w-full h-full object-contain"
                  controls
                  playsInline
                  muted
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={filePreview || gifUrl}
                  alt=""
                  className="object-contain w-full h-full"
                />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={clearAttachment}
                className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10 text-sm"
              >
                {tOr(t, 'remove', 'Entfernen')}
              </button>
            </div>
          </div>
        </div>
      )}

      {err && <div className="text-sm text-red-400">{err}</div>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2.5">
          {/* Media (Bild ODER Video) */}
          <label className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/12 hover:bg-white/[.06] cursor-pointer">
            <input
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={onFileChange}
            />
            <span
              className="inline-grid place-items-center"
              style={{ width: 28, height: 28, color: 'var(--purple)' }}
              aria-hidden
            >
              <MediaIcon size={22} />
            </span>
            <span className="text-sm text-white/80">{tOr(t, 'media', 'Media')}</span>
          </label>

          {/* GIF – öffnet Tenor Picker wie im ComposePostModal */}
          <button
            type="button"
            onClick={() => setGifOpen(true)}
            className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/12 hover:bg-white/[.06]"
            title={tOr(t, 'gifSearchTitle', 'GIF suchen')}
            aria-expanded={gifOpen || undefined}
          >
            <span
              className="inline-grid place-items-center"
              style={{ width: 28, height: 28, color: 'var(--purple)' }}
              aria-hidden
            >
              <GifIcon size={22} />
            </span>
            <span className="text-sm text-white/80">{tOr(t, 'gif', 'GIF')}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs opacity-70">{text.trim().length}/4000</div>
          <button
            type="submit"
            disabled={!canPost}
            className="px-4 h-9 rounded-full bg-[var(--purple)] text-white disabled:opacity-50"
          >
            {loading ? tOr(t, 'post.buttonPosting', 'Poste…') : tOr(t, 'post.buttonPost', 'Posten')}
          </button>
        </div>
      </div>

      {/* GIF Picker Modal (Portal) */}
      <GifPickerModal
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onPick={(url) => {
          // GIF auswählen: Datei-Vorschau zurücksetzen, URL setzen
          if (filePreview) URL.revokeObjectURL(filePreview);
          setFile(null);
          setFilePreview(null);
          setGifUrl(url);
          setGifOpen(false);
        }}
      />
    </form>
  );
}

/* --------- Icons wie im ComposePostModal --------- */
function GifIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="1.75" y="1.75" width="20.5" height="20.5" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <text
        x="12"
        y="15.6"
        textAnchor="middle"
        fontFamily="ui-sans-serif,system-ui"
        fontWeight="700"
        fontSize="11.5"
        fill="currentColor"
      >
        GIF
      </text>
    </svg>
  );
}

function MediaIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
      <path d="M7.5 14.5 10.5 11l3 3 2.5-2.5 3 3" />
      <circle cx="9" cy="9" r="1.5" />
    </svg>
  );
}
