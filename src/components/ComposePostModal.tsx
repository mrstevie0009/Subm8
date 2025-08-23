'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { createPost } from '@/app/actions/posts';

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function ComposePostModal({ open, onClose }: Props) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [text, setText] = React.useState('');

  // File + Preview
  const [mediaFile, setMediaFile] = React.useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (mediaPreview?.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);
    };
  }, [mediaPreview]);

  const onPickImage = (file?: File | null) => {
    if (!file) return;
    if (mediaPreview?.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);
    const url = URL.createObjectURL(file);
    setMediaFile(file);
    setMediaPreview(url);
  };

  const clearImage = () => {
    if (mediaPreview?.startsWith('blob:')) URL.revokeObjectURL(mediaPreview);
    setMediaFile(null);
    setMediaPreview(null);
  };

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
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
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-label="Compose post"
    >
      <div style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-[18px] font-semibold">New post</div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
            Close
          </button>
        </div>

        <form
          // WICHTIG: Keine method/encType hier angeben, weil action eine Funktion ist!
          // ts-expect-error — Client Action, erhält FormData von React
          action={async (fd: FormData) => {
            // Datei sicherstellen (FormData enthält i.d.R. schon "media")
            if (mediaFile) fd.set('media', mediaFile);
            await createPost(fd);
            onClose();
          }}
        >
          <div className="px-4 pt-4 pb-3 grid gap-3">
            <textarea
              name="text"
              rows={3}
              placeholder="Was gibt's Neues?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />

            {/* Preview mit <img>, damit blob: URLs funktionieren */}
            {mediaPreview && (
              <figure className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaPreview}
                  alt=""
                  className="block mx-auto max-w-full h-auto max-h-[65vh] sm:max-h-[70vh]"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 border border-white/20 hover:bg-black/80 text-[13px]"
                  title="Bild entfernen"
                >
                  Remove
                </button>
              </figure>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                  <input
                    type="file"
                    name="media"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => onPickImage(e.currentTarget.files?.[0] ?? null)}
                  />
                  <span
                    className="inline-grid place-items-center"
                    style={{ width: 24, height: 24, color: 'var(--purple)' }}
                    aria-hidden
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
                      <path d="M7.5 14.5 10.5 11l3 3 2.5-2.5 3 3" />
                      <circle cx="9" cy="9" r="1.5" />
                    </svg>
                  </span>
                  <span className="text-sm text-white/80">Bild</span>
                </label>
              </div>

              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-[var(--purple)] hover:opacity-95 text-white disabled:opacity-50"
                disabled={text.trim().length === 0 && !mediaFile}
              >
                Post
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
