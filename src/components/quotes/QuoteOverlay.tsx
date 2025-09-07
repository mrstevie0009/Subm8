'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { createPostAction } from '@/app/actions/posts';

const AVATAR_PH = '/images/avatar-placeholder.png';

export type MiniPost = {
  id: string;
  text: string;
  createdAt: string; // ISO
  author: { displayName: string; handle: string; avatarUrl?: string | null };
  mediaUrl?: string | null;
  mediaAlt?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  target: MiniPost; // der zu quotende Post
};

export default function QuoteOverlay({ open, onClose, target }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [text, setText] = React.useState('');
  const [fileName, setFileName] = React.useState('');
  const [alt, setAlt] = React.useState('');
  const [submitting, startTransition] = React.useTransition();
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const firstFieldRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => setMounted(true), []);

  // Body scroll sperren + ESC schließen
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Fokus ins Textfeld setzen, wenn offen
  React.useEffect(() => {
    if (open) {
      setTimeout(() => firstFieldRef.current?.focus(), 0);
    }
  }, [open]);

  if (!mounted || !open) return null;

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quote post"
      data-no-nav // <- falls doch etwas durchblubbert
      // Backdrop: blockt ALLE Pointer-Events hinter dem Overlay
      onClick={(e) => {
        // Click auf den Backdrop (nicht im Dialog) schließt
        if (e.target === e.currentTarget) onClose();
      }}
      onMouseDownCapture={(e) => {
        // jede Maus-Aktion am Backdrop abfangen, damit nichts "durchklickt"
        if (e.target === e.currentTarget) e.stopPropagation();
      }}
      onPointerDownCapture={(e) => {
        if (e.target === e.currentTarget) e.stopPropagation();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483600,
        background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 12,
        pointerEvents: 'auto',
      }}
    >
      <div
        ref={dialogRef}
        data-no-nav
        className="rounded-2xl border border-white/10 bg-black/85 backdrop-blur"
        style={{ width: 'min(680px, 96vw)' }}
        // Alle Events im Dialog stoppen, damit nichts nach unten „fällt“
        onClick={(e) => e.stopPropagation()}
        onMouseDownCapture={(e) => e.stopPropagation()}
        onPointerDownCapture={(e) => e.stopPropagation()}
        onKeyDownCapture={(e) => e.stopPropagation()}
      >
        {/* Kopf */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="font-semibold">Quote post</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 hover:bg-white/10"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Formular */}
        <form
          // server action
          action={(fd: FormData) => {
            fd.set('quoteOfId', target.id);
            startTransition(async () => {
              await createPostAction(fd);
              onClose();
            });
          }}
          className="p-4 grid gap-3"
        >
          <textarea
            ref={firstFieldRef}
            name="text"
            rows={5}
            placeholder="Add a comment…"
            className="w-full rounded-xl bg-transparent border border-white/15 px-3 py-2 outline-none focus:ring-[3px] focus:ring-[var(--purple)]/40"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div className="grid gap-2">
            <input
              type="file"
              name="media"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? '')}
              className="block w-full text-sm file:mr-4 file:rounded-lg file:border file:border-white/15 file:bg-transparent file:px-3 file:py-2 file:text-white/90 hover:file:bg-white/5"
            />
            <input
              type="text"
              name="mediaAlt"
              placeholder="Alt text (optional)"
              className="w-full rounded-xl bg-transparent border border-white/15 px-3 py-2 outline-none focus:ring-[3px] focus:ring-[var(--purple)]/40"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
            />
            {fileName && <div className="text-xs text-white/60">Selected: {fileName}</div>}
          </div>

          {/* Mini-Karte des zitierten Posts */}
          <div className="mt-1 rounded-xl border border-white/10 bg-white/[.03] p-3">
            <div className="flex items-start gap-3">
              <div className="relative size-9 overflow-hidden rounded-full bg-white/10">
                <Image src={target.author.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" />
              </div>
              <div className="min-w-0">
                <div className="text-sm flex items-center gap-2">
                  <span className="font-semibold truncate">{target.author.displayName}</span>
                  <span className="opacity-70 truncate">@{target.author.handle}</span>
                </div>
                <div className="mt-1 text-sm whitespace-pre-wrap break-words">{target.text}</div>
                {target.mediaUrl && (
                  <figure className="mt-2 overflow-hidden rounded-lg border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={target.mediaUrl}
                      alt={target.mediaAlt ?? ''}
                      className="block max-h-56 w-auto mx-auto"
                    />
                  </figure>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="px-4 h-9 rounded-xl border border-white/15">
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (!text && !fileName)}
              className="px-4 h-9 rounded-xl bg-[var(--purple)] text-white font-semibold disabled:opacity-60"
            >
              {submitting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
