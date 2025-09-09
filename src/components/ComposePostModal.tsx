// src/components/ComposePostModal.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { createPost } from '@/app/actions/posts';
import MentionSuggest from '@/components/MentionSuggest';

type Props = { open: boolean; onClose: () => void };
type MediaKind = 'image' | 'video' | null;

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
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg hover:bg-white/5"
          >
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

            {/* IMAGE PREVIEW */}
            {mediaPreview && mediaKind === 'image' && (
              <figure className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
                <Image
                  src={mediaPreview}
                  alt=""
                  width={1200}
                  height={800}
                  unoptimized
                  sizes="100vw"
                  className="block mx-auto max-w-full h-auto max-h-[65vh] sm:max-h-[70vh]"
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
                  className="block w-full h-auto max-h-[65vh] sm:max-h-[70vh]"
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
              <div className="flex items-center gap-2">
                {/* EINZIGER Media-Picker (Bild ODER Video) */}
                <label className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="sr-only"
                    onChange={(e) => onPickMedia(e.currentTarget.files?.[0] ?? null)}
                  />
                  <span
                    className="inline-grid place-items-center"
                    style={{ width: 24, height: 24, color: 'var(--purple)' }}
                    aria-hidden
                  >
                    {/* Bild-Icon wiederverwendet */}
                    <svg
                      viewBox="0 0 24 24"
                      width="20"
                      height="20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
                      <path d="M7.5 14.5 10.5 11l3 3 2.5-2.5 3 3" />
                      <circle cx="9" cy="9" r="1.5" />
                    </svg>
                  </span>
                  <span className="text-sm text-white/80">Media</span>
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
