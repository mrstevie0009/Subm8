// src/components/ComposePostModal.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { createPost } from '@/app/actions/posts';
import MentionSuggest from '@/components/MentionSuggest';

type Props = { open: boolean; onClose: () => void };
type MediaKind = 'image' | 'video' | null;

/* ---------------- GIF Picker (Tenor) ---------------- */
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
      setErr('Konnte GIFs nicht laden.');
    } finally {
      setLoading(false);
    }
  }, []);

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
            onKeyDown={(e) => {
              if (e.key === 'Enter') run(q);
            }}
            placeholder="Nach GIFs suchen…"
            className="flex-1 h-10 rounded-xl bg-white/[.06] border border-white/10 px-3 outline-none"
          />
          <button
            type="button"
            onClick={() => run(q)}
            className="h-10 px-4 rounded-xl bg-[var(--purple)] text-white hover:opacity-95"
          >
            Suchen
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 rounded-xl border border-white/15 hover:bg-white/10"
          >
            Schließen
          </button>
        </div>

        <div className="mt-3">
          {err && <div className="text-red-300 text-sm mb-2">{err}</div>}
          {loading ? (
            <div className="text-sm text-white/80 py-8 text-center">Lade GIFs…</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto max-h-[65vh] pr-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-white/25"
                  onClick={() => onPick(it.url)}
                  title="Auswählen"
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
    document.body,
  );
}

/* ---------------------- Compose Modal ---------------------- */
export default function ComposePostModal({ open, onClose }: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [text, setText] = React.useState('');

  // Refs müssen vor return existieren
  const textareaRef = React.useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);

  // File + Preview
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);
  const [mediaKind, setMediaKind] = React.useState<MediaKind>(null);

  React.useEffect(() => {
    return () => {
      if (mediaPreview?.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const onPickMedia = (file?: File | null) => {
    if (!file) return;
    if (mediaPreview?.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);
    const url = URL.createObjectURL(file);
    const kind: MediaKind = file.type?.startsWith('video') ? 'video' : 'image';
    setMediaFile(file);
    setMediaPreview(url);
    setMediaKind(kind);
  };

  const clearMedia = () => {
    if (mediaPreview?.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
    setMediaKind(null);
  };

  // GIF handling
  const [gifOpen, setGifOpen] = React.useState(false);
  const [gifErr, setGifErr] = React.useState<string | null>(null);

  async function pickGifByUrl(url: string) {
    try {
      setGifErr(null);
      if (mediaPreview?.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);

      const r = await fetch(url, { mode: 'cors' });
      const blob = await r.blob();
      const type = blob.type || 'image/gif';
      const file = new File([blob], `gif_${Date.now()}.gif`, { type });

      const local = URL.createObjectURL(blob);
      setMediaFile(file);
      setMediaPreview(local);
      setMediaKind('image'); // GIF behandeln wie Bild
      setGifOpen(false);
    } catch {
      setGifErr('GIF konnte nicht geladen werden.');
    }
  }

  // Modal scroll lock
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!mounted || !open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483600,
    background: 'rgba(0,0,0,.60)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
  };

  const panelStyle: React.CSSProperties = {
    width: 'min(92vw, 680px)',
    background: '#0b0b0b',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 20,
    overflow: 'hidden',
  };

  const modal = (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Compose post"
    >
      <div style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-[18px] font-semibold">New post</div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg hover:bg-white/5">
            Close
          </button>
        </div>

        <form
          // ts-expect-error — Client Action, React übergibt FormData
          action={async (fd: FormData) => {
            if (mediaFile) fd.set('media', mediaFile);
            await createPost(fd);
            onClose();
          }}
        >
          <div className="px-4 pt-4 pb-3 grid gap-3">
            {/* Anchor für MentionSuggest */}
            <div ref={anchorRef as React.RefObject<HTMLDivElement>} className="relative">
              <textarea
                ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
                name="text"
                rows={3}
                placeholder="What's happening?"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
                maxLength={4000}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <MentionSuggest
                anchorRef={anchorRef as React.RefObject<HTMLElement>}
                value={text}
                onChange={setText}
                limit={8}
              />
            </div>

            {/* IMAGE PREVIEW (inkl. GIF) */}
            {mediaPreview && mediaKind === 'image' && (
              <figure className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <Image
                  src={mediaPreview}
                  alt=""
                  width={1200}
                  height={800}
                  unoptimized
                  sizes="100vw"
                  className="block mx-auto max-w-full h-auto object-contain
                            max-h-[48vh] sm:max-h-[60vh]"
                />
                <button
                  type="button"
                  onClick={clearMedia}
                  className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 border border-white/20 hover:bg-black/80 text-[13px]"
                  title="Remove image"
                >
                  Remove
                </button>
              </figure>
            )}

            {/* VIDEO PREVIEW */}
            {mediaPreview && mediaKind === 'video' && (
              <figure className="relative overflow-hidden rounded-xl border border-white/10 bg-black">
                <video
                  src={mediaPreview}
                  className="block w-full h-auto object-contain max-h-[48vh] sm:max-h-[60vh]"
                  controls
                  playsInline
                  muted
                />
                <button
                  type="button"
                  onClick={clearMedia}
                  className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 border border-white/20 hover:bg-black/80 text-[13px]"
                  title="Remove video"
                >
                  Remove
                </button>
              </figure>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {/* Media-Picker (Bild ODER Video) — Optik vereinheitlicht */}
                <label className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/12 hover:bg-white/[.06] cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={(e) => onPickMedia(e.currentTarget.files?.[0] ?? null)}
                  />
                  <span
                    className="inline-grid place-items-center"
                    style={{ width: 28, height: 28, color: 'var(--purple)' }}
                    aria-hidden
                  >
                    {/* Bild/Video-Icon etwas größer */}
                    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
                      <path d="M7.5 14.5 10.5 11l3 3 2.5-2.5 3 3" />
                      <circle cx="9" cy="9" r="1.5" />
                    </svg>
                  </span>
                  <span className="text-sm text-white/80">Media</span>
                </label>

                {/* GIF Button – gleiche Größe/Look, lila Icon */}
                <button
                  type="button"
                  onClick={() => setGifOpen(true)}
                  className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/12 hover:bg-white/[.06]"
                  title="GIF suchen"
                  aria-label="GIF suchen"
                >
                  <span
                    className="inline-grid place-items-center"
                    style={{ width: 28, height: 28, color: 'var(--purple)' }}
                    aria-hidden
                  >
                    <GifIcon size={22} />
                  </span>
                  {/* optionaler Label-Text (klein), wirkt konsistent mit „Media“ */}
                  <span className="text-sm text-white/80">GIF</span>
                </button>
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-[var(--purple)] hover:opacity-95 text-white disabled:opacity-50"
                disabled={text.trim().length === 0 && !mediaFile}
              >
                Post
              </button>
            </div>

            {gifErr && <div className="text-xs text-red-300">{gifErr}</div>}
          </div>
        </form>
      </div>

      {/* GIF Picker Modal */}
      <GifPickerModal open={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => void pickGifByUrl(url)} />
    </div>
  );

  return createPortal(modal, document.body);
}

/* --------- Icon --------- */
function GifIcon({ size = 28 }: { size?: number }) {
  // quadratischer Badge mit „GIF“ – skaliert sauber, Farbe via currentColor (== var(--purple) im Wrapper)
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
