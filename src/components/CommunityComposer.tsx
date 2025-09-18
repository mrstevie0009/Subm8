// src/components/CommunityComposer.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

type Props = { slug: string };

export default function CommunityComposer({ slug }: Props) {
  const router = useRouter();

  const [text, setText] = React.useState('');

  // Media state
  const [file, setFile] = React.useState<File | null>(null);
  const [filePreview, setFilePreview] = React.useState<string | null>(null);
  const [gifUrl, setGifUrl] = React.useState<string>('');
  const [showGifBox, setShowGifBox] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const canPostText = text.trim().length > 0 && text.trim().length <= 4000;
  const hasAttachment = !!file || !!gifUrl.trim();
  const canPost = (canPostText || hasAttachment) && !loading;

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;

    // nur Bild ODER Video
    const ok = f.type.startsWith('image/') || f.type.startsWith('video/');
    if (!ok) {
      setErr('Nur Bild- oder Videodateien sind erlaubt.');
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

  function isValidGifLink(u: string) {
    const s = u.trim();
    if (!/^https?:\/\//i.test(s)) return false;
    return /\.(gif)(\?.*)?$/i.test(s);
  }

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
          return;
        }
      }

      // Reset & Refresh
      setText('');
      clearAttachment();
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to post');
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
        placeholder="Was gibt’s Neues in der Community?"
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
                Entfernen
              </button>
            </div>
          </div>
        </div>
      )}

      {err && <div className="text-sm text-red-400">{err}</div>}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2.5">
          {/* Media (Bild ODER Video) – gleicher Look wie im ComposePostModal) */}
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
            <span className="text-sm text-white/80">Media</span>
          </label>

          {/* GIF – gleicher Look wie im ComposePostModal */}
          <button
            type="button"
            onClick={() => setShowGifBox((v) => !v)}
            className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/12 hover:bg-white/[.06]"
            title="GIF per Link einfügen"
            aria-expanded={showGifBox || undefined}
          >
            <span
              className="inline-grid place-items-center"
              style={{ width: 28, height: 28, color: 'var(--purple)' }}
              aria-hidden
            >
              <GifIcon size={22} />
            </span>
            <span className="text-sm text-white/80">GIF</span>
          </button>

          {showGifBox && (
            <div className="relative">
              <div className="absolute z-20 mt-2 w-80 rounded-xl border border-white/10 bg-black/85 backdrop-blur p-3 shadow-lg">
                <label className="block text-xs opacity-80 mb-1">
                  GIF-Link (direkte <code>.gif</code>-URL)
                </label>
                <input
                  type="url"
                  value={gifUrl}
                  onChange={(e) => {
                    setGifUrl(e.target.value);
                    if (e.target.value) {
                      if (filePreview) URL.revokeObjectURL(filePreview);
                      setFile(null);
                      setFilePreview(null);
                    }
                  }}
                  placeholder="https://media.giphy.com/media/.../giphy.gif"
                  className="w-full rounded-lg bg-white/[.06] border border-white/10 px-2 py-1 outline-none text-sm"
                />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs opacity-70">
                    {gifUrl && !isValidGifLink(gifUrl) ? 'Kein direkter GIF-Link' : '\u00A0'}
                  </span>
                  <button
                    type="button"
                    className="px-3 py-1.5 rounded-lg bg-[var(--purple)] text-white text-sm disabled:opacity-50"
                    onClick={() => setShowGifBox(false)}
                    disabled={!!gifUrl && !isValidGifLink(gifUrl)}
                  >
                    Übernehmen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs opacity-70">{text.trim().length}/4000</div>
          <button
            type="submit"
            disabled={!canPost}
            className="px-4 h-9 rounded-full bg-[var(--purple)] text-white disabled:opacity-50"
          >
            {loading ? 'Poste…' : 'Posten'}
          </button>
        </div>
      </div>
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
