'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createPortal } from 'react-dom';
import type { Post } from './PostCard';

const MAX_CHARS = 280;

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('File read error'));
    fr.readAsDataURL(file);
  });
}

async function resizeDataURL(dataUrl: string, maxW = 1600, maxH = 1600): Promise<string> {
  const img = document.createElement('img');

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = dataUrl;
  });

  let { width, height } = img;
  const ratio = Math.min(1, maxW / width, maxH / height);
  if (ratio >= 1) return dataUrl;

  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.9);
}

export default function ComposeModal() {
  const router = useRouter();
  const params = useSearchParams();
  const open = params.get('compose') === '1';

  const [mounted, setMounted] = React.useState(false);
  const portalRef = React.useRef<HTMLDivElement | null>(null);

  const [text, setText] = React.useState('');
  const [imgDataUrl, setImgDataUrl] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);

  const taRef = React.useRef<HTMLTextAreaElement | null>(null);

  // Portal mount
  React.useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    portalRef.current = el;
    setMounted(true);
    return () => {
      if (portalRef.current && portalRef.current.parentNode) {
        portalRef.current.parentNode.removeChild(portalRef.current);
      }
    };
  }, []);

  // Stable callbacks (fix for react-hooks/exhaustive-deps)
  const close = React.useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('compose');
    const qs = url.searchParams.toString();
    router.replace(url.pathname + (qs ? `?${qs}` : ''), { scroll: false });
  }, [router]);

  const onTextChange = React.useCallback((v: string) => {
    setText(v.length > MAX_CHARS ? v.slice(0, MAX_CHARS) : v);
  }, []);

  const handleSubmit = React.useCallback(async () => {
    if (!text.trim() && !imgDataUrl) return;
    setIsSubmitting(true);

    const newPost: Post = {
      author: { name: 'You', handle: 'you' },
      createdAt: 'now',
      text: text.trim(),
      mediaUrl: imgDataUrl || undefined,
      stats: { comments: 0, reposts: 0, likes: 0 },
    };

    const KEY = 'subm8_posts';
    const current: Post[] = JSON.parse(localStorage.getItem(KEY) || '[]');
    current.unshift(newPost);
    localStorage.setItem(KEY, JSON.stringify(current));

    window.dispatchEvent(new CustomEvent('subm8:new-post'));

    setText('');
    setImgDataUrl(null);
    setIsSubmitting(false);
    close();
  }, [text, imgDataUrl, close]);

  const onFileChange = React.useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await readFileAsDataURL(file);
    const sized = await resizeDataURL(raw, 1600, 1600);
    setImgDataUrl(sized);
  }, []);

  const onDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  const onDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  const onDrop = React.useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const raw = await readFileAsDataURL(file);
    const sized = await resizeDataURL(raw, 1600, 1600);
    setImgDataUrl(sized);
  }, []);

  // ESC schließen, Cmd/Ctrl+Enter posten (deps enthalten close & handleSubmit)
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        close();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'enter' && open) {
        e.preventDefault();
        void handleSubmit();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, handleSubmit]);

  // Textarea auto-resize
  React.useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = '0px';
    ta.style.height = `${Math.min(ta.scrollHeight, 320)}px`;
  }, [text]);

  if (!open || !mounted || !portalRef.current) return null;

  const used = text.length;
  const left = MAX_CHARS - used;
  const counterColor =
    left < 0 ? '#ff6b6b' : left <= 20 ? 'var(--purple)' : 'var(--muted, rgba(255,255,255,.6))';

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compose"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.6)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        zIndex: 2147483648,
        animation: 'fadeIn 140ms ease-out',
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
        className="border border-white/10 rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          width: 'min(92vw, 720px)',
          maxWidth: 560,
          background: 'linear-gradient(180deg, rgba(255,255,255,.08), rgba(255,255,255,.04))',
          boxShadow: '0 10px 30px rgba(0,0,0,.45), 0 1px 0 rgba(255,255,255,.06) inset',
          transform: 'translateY(4px) scale(0.98)',
          animation: 'popIn 160ms cubic-bezier(.2,.8,.2,1) forwards',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/10"
          style={{ backdropFilter: 'blur(2px)' }}
        >
          <div className="font-medium">Post erstellen</div>
          <button
            type="button"
            onClick={close}
            className="p-2 rounded hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/60"
            aria-label="Schließen"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 opacity-90">
              <path d="M6.7 6.7a1 1 0 0 1 1.4 0L12 10.6l3.9-3.9a1 1 0 1 1 1.4 1.4L13.4 12l3.9 3.9a1 1 0 1 1-1.4 1.4L12 13.4l-3.9 3.9a1 1 0 1 1-1.4-1.4L10.6 12 6.7 8.1a1 1 0 0 1 0-1.4Z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Was gibt’s Neues?"
            rows={3}
            className="w-full bg-transparent outline-none resize-none placeholder:text-muted text-[15px] leading-relaxed focus:outline-none"
            style={{
              borderRadius: 12,
              padding: '10px 12px',
              border: '1px solid rgba(255,255,255,.08)',
              transition: 'border-color .15s ease',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'rgba(139,92,246,.45)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,.08)')}
          />

          {/* Dropzone-Hinweis */}
          {!imgDataUrl && (
            <div
              className="text-xs text-muted rounded-lg border border-dashed"
              style={{
                borderColor: isDragging ? 'var(--purple)' : 'rgba(255,255,255,.15)',
                padding: '10px 12px',
                background: isDragging ? 'rgba(139,92,246,.08)' : 'transparent',
                transition: 'all .15s ease',
              }}
            >
              Bild hierher ziehen & ablegen – oder unten „Bild hinzufügen“ klicken.
            </div>
          )}

          {/* Bild-Vorschau */}
          {imgDataUrl && (
            <figure className="overflow-hidden rounded-xl border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imgDataUrl}
                alt="Preview"
                className="block mx-auto max-w-full h-auto max-h-[65vh] sm:max-h-[70vh]"
              />
            </figure>
          )}

          {/* Toolbar + Actions */}
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-muted hover:text-fg">
                <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
                <span className="inline-grid place-items-center w-7 h-7 relative rounded hover:bg-white/5">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="absolute inset-0 m-auto w-5 h-5 opacity-90">
                    <path d="M4 6.5C4 4.3 5.8 2.5 8 2.5h8c2.2 0 4 1.8 4 4v9c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4v-9Z" />
                    <path d="M9.2 10.8c.9 0 1.6-.7 1.6-1.6S10.1 7.6 9.2 7.6 7.6 8.3 7.6 9.2s.7 1.6 1.6 1.6Z" fill="#fff" opacity=".75"/>
                    <path d="M6.2 17.2 10 13.7c.4-.4 1-.4 1.4 0l1.6 1.7 1.4-1.4c.4-.4 1-.4 1.4 0l2 2v1.5H6.2v-.3Z" fill="#fff" opacity=".85"/>
                  </svg>
                </span>
                Bild
              </label>

              {imgDataUrl && (
                <button
                  type="button"
                  onClick={() => setImgDataUrl(null)}
                  className="text-sm text-muted hover:text-fg px-2 py-1 rounded hover:bg-white/5"
                >
                  Bild entfernen
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span
                className="text-xs tabular-nums"
                style={{ color: counterColor }}
                title={`${used}/${MAX_CHARS}`}
              >
                {left}
              </span>

              <span className="hidden sm:inline text-xs text-muted">⌘/Ctrl + Enter</span>

              <button
                type="submit"
                disabled={isSubmitting || (!text.trim() && !imgDataUrl)}
                className="px-4 py-1.5 rounded-lg bg-[var(--purple)] text-white/95 disabled:opacity-50 hover:opacity-95"
              >
                Posten
              </button>
            </div>
          </div>
        </div>
      </form>

      <style jsx global>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes popIn  { from { transform: translateY(6px) scale(.96); opacity: 0 }
                            to   { transform: translateY(0)   scale(1);   opacity: 1 } }
      `}</style>
    </div>
  );

  return createPortal(overlay, portalRef.current);
}
