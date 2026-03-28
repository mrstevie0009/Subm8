//src/components/ComposePostModal.tsx
/* eslint-disable @next/next/no-img-element -- native <img> ist für lokale Blob-Previews in BlobImg nötig */
'use client';

import * as React from 'react';
import { saveDraft, loadDraft, clearDraft } from '@/lib/drafts';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { createPost } from '@/app/actions/posts';
import MentionSuggest from '@/components/MentionSuggest';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';

type Props = { open: boolean; onClose: () => void };
type MediaKind = 'image' | 'video';

/* ---------------- GIF Picker (Tenor) ---------------- */
const TENOR_BASE = '/api/gif/search';

// Allowlist für erlaubte GIF-Hosts
const ALLOWED_GIF_HOSTS = [
  'media.tenor.com', 'c.tenor.com', 'media1.tenor.com',
  'media2.tenor.com', 'media3.tenor.com', 'g.tenor.com',
  'i.giphy.com', 'media.giphy.com',
];
const MEDIA_MAX = 4;
const atLimit = (n: number) => n >= MEDIA_MAX;

// robustere Erkennung (für iPhone / Safari etc.)
function isVideoFile(f: File): boolean {
  const type = (f.type || '').toLowerCase();
  const name = (f.name || '').toLowerCase();

  if (type.startsWith('video/')) return true;

  // Fallback über Endung – wichtig für iOS
  return /\.(mp4|mov|m4v|webm|ogg|ogv|mkv)$/i.test(name);
}

function isImageFile(f: File): boolean {
  const type = (f.type || '').toLowerCase();
  const name = (f.name || '').toLowerCase();

  if (type.startsWith('image/')) return true;

  // HEIC/HEIF & Co.
  return /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(name);
}


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
  const t = useTranslations('communities.gifPicker');

  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<{ id: string; url: string }[]>([]);

  const pickUrlFromItem = (it: TenorItem): string | null => {
    const m = it.media?.[0];
    return m?.gif?.url || m?.mediumgif?.url || m?.tinygif?.url || m?.nanogif?.url || null;
  };

  const run = React.useCallback(
    async (query?: string) => {
      setErr(null);
      setLoading(true);
      try {
        // ✅ Eigener Proxy statt direktem Tenor-Call mit API-Key
        const endpoint =
          query && query.trim()
            ? `${TENOR_BASE}?q=${encodeURIComponent(query)}&limit=24`
            : `${TENOR_BASE}?limit=24`;

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
        setErr(t('states.loadError'));
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  React.useEffect(() => {
    if (open) void run();
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
              if (e.key === 'Enter') void run(q);
            }}
            placeholder={t('fields.searchPlaceholder')}
            className="flex-1 h-10 rounded-xl bg-white/[.06] border border-white/10 px-3 outline-none"
          />
          <button
            type="button"
            onClick={() => void run(q)}
            className="h-10 px-4 rounded-xl bg-[var(--purple)] text-white hover:opacity-95"
          >
            {t('actions.search')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 rounded-xl border border-white/15 hover:bg-white/10"
          >
            {t('actions.close')}
          </button>
        </div>

        <div className="mt-3">
          {err && <div className="text-red-300 text-sm mb-2">{err}</div>}
          {loading ? (
            <div className="text-sm text-white/80 py-8 text-center">{t('states.loading')}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto max-h-[65vh] pr-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-white/25"
                  onClick={() => {
                    onClose();         // Picker sofort schließen
                    onPick(it.url);    // GIF laden/anhängen passiert im Hintergrund
                  }}
                  title={t('actions.pick')}
                >
                  <Image
                    src={it.url}
                    alt=""
                    unoptimized
                    width={480}
                    height={176}
                    className="block w-full h-44 object-cover"
                    sizes="(max-width: 768px) 50vw, 25vw"
                    style={{ imageOrientation: 'from-image' } as React.CSSProperties}
                  />
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
type LocalMedia = {
  id: string;
  file: File;
  preview: string;
  kind: MediaKind;
};

/** Typ-Helfer für `imageOrientation` ohne `any` */
type CSSWithImageOrientation = React.CSSProperties & { imageOrientation?: 'from-image' | 'none' };

/** Robustes `<img>` für lokale Blob-Previews (mit Fallback) */
function BlobImg({
  src,
  alt = '',
  className,
  style,
  onErrorPlaceholder,
}: {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSWithImageOrientation;
  onErrorPlaceholder?: React.ReactNode;
}) {
  const [err, setErr] = React.useState(false);
  if (err) {
    return (
      <div className="grid place-items-center w-full h-full bg-black/40 text-white/70 text-xs">
        {onErrorPlaceholder ?? 'Vorschau nicht verfügbar'}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="eager"
      decoding="async"
      onError={() => setErr(true)}
      className={className}
      style={{ imageOrientation: 'from-image', ...(style ?? {}) }}
      draggable={false}
    />
  );
}

/** kleines Badge, wenn HEIC/HEIF erkannt wird */
function HeicBadge() {
  return (
    <span className="absolute left-2 top-2 text-[10px] px-1.5 py-0.5 rounded bg-black/70 border border-white/20">
      HEIC
    </span>
  );
}

function isHeicLike(file: File | undefined) {
  const name = file?.name?.toLowerCase() ?? '';
  const type = file?.type?.toLowerCase() ?? '';
  return name.endsWith('.heic') || name.endsWith('.heif') || type.includes('heic') || type.includes('heif');
}

export default function ComposePostModal({ open, onClose }: Props) {
  const t = useTranslations('communities.compose');
  const tn = useTranslations('ownership.ownershipRequest');
  const tt = useTranslations('home.toast');

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const [text, setText] = React.useState('');
  const [charCount, setCharCount] = React.useState(0);
  const MAX_CHARS = 400;

  // Refs müssen vor return existieren
  const textareaRef = React.useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const anchorRef = React.useRef<HTMLElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const dropZoneRef = React.useRef<HTMLDivElement | null>(null);

  // NEU: mehrere Medien
  const [media, setMedia] = React.useState<LocalMedia[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [uploadProgress, setUploadProgress] = React.useState<number | null>(null);

  // Draft System: Auto-save
  React.useEffect(() => {
    if (!text && media.length === 0) return;
    const timer = setTimeout(() => {
      saveDraft({
        text,
        mediaFiles: media.map(m => ({ name: m.file.name, size: m.file.size, type: m.file.type })),
        savedAt: Date.now(),
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [text, media]);

  // Draft System: Load on mount
  React.useEffect(() => {
    if (!open) return;
    const draft = loadDraft();
    if (draft && !text && media.length === 0) {
      setText(draft.text);
      // Media können wir nicht wiederherstellen (File objects), nur Text
    }
  }, [open, text, media.length]);

  // Auto-resize Textarea
  React.useEffect(() => {
    const ta = textareaRef.current;
    if (!ta || !(ta instanceof HTMLTextAreaElement)) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [text]);

  // Character count
  React.useEffect(() => {
    setCharCount(text.length);
  }, [text]);

  React.useEffect(() => {
    // Kein revoke hier nötig: wir räumen beim Entfernen einzelner Medien auf.
    // (Optional: beim Unmount alle bekannten Blob-URLs löschen)
    return () => {
      // noop
    };
  }, []);

  const onPickMedia = React.useCallback((files?: FileList | null, input?: HTMLInputElement | null) => {
    if (!files || files.length === 0) return;

    const pickedAll = Array.from(files);
    if (input) input.value = '';

    const current = media;
    const toasts: Array<{ msg: string }> = [];

    const hasPrevVideo = current.some((m) => m.kind === 'video');
    const hasPrevImages = current.some((m) => m.kind === 'image');

    const next = [...current];

    if (hasPrevVideo) {
      toasts.push({ msg: tt('media.alreadyVideo') });
    } else if (hasPrevImages) {
      const imageFiles = pickedAll.filter(isImageFile);
      if (imageFiles.length === 0) {
        toasts.push({ msg: tt('media.noVideoWhenImages') });
      } else {
        const remaining = MEDIA_MAX - next.length;
        if (remaining <= 0) {
          toasts.push({ msg: tt('media.maxReached', { max: MEDIA_MAX }) });
        } else {
          const picked = imageFiles.slice(0, remaining);
          for (const f of picked) {
            const preview = URL.createObjectURL(f);
            next.push({ id: crypto.randomUUID(), file: f, preview, kind: 'image' });
          }
          if (imageFiles.length > remaining) {
            toasts.push({ msg: tt('media.onlyRemaining', { remaining, max: MEDIA_MAX }) });
          }
          if (pickedAll.some(isVideoFile)) {
            toasts.push({ msg: tt('media.videosIgnored') });
          }
        }
      }
    } else {
      const hasVideo = pickedAll.some(isVideoFile);
      const hasImage = pickedAll.some(isImageFile);

      if (hasVideo && hasImage) {
        toasts.push({ msg: tt('media.mixedNotAllowed') });
      } else if (hasVideo) {
        const firstVideo = pickedAll.find(isVideoFile);
        if (firstVideo) {
          const preview = URL.createObjectURL(firstVideo);
          next.push({ id: crypto.randomUUID(), file: firstVideo, preview, kind: 'video' });
        }
        if (pickedAll.filter(isVideoFile).length > 1) {
          toasts.push({ msg: tt('media.onlyOneVideo') });
        }
      } else {
        const imageFiles = pickedAll.filter(isImageFile);
        if (imageFiles.length === 0) {
          // nichts erkannt
        } else {
          const remaining = MEDIA_MAX - next.length;
          if (remaining <= 0) {
            toasts.push({ msg: tt('media.maxReached', { max: MEDIA_MAX }) });
          } else {
            const picked = imageFiles.slice(0, remaining);
            for (const f of picked) {
              const preview = URL.createObjectURL(f);
              next.push({ id: crypto.randomUUID(), file: f, preview, kind: 'image' });
            }
            if (imageFiles.length > remaining) {
              toasts.push({ msg: tt('media.onlyRemaining', { remaining, max: MEDIA_MAX }) });
            }
          }
        }
      }
    }

    if (next !== current) setMedia(next);
    for (const tmsg of toasts) toast.error(tmsg.msg);
  }, [media, tt]);

  // Drag & Drop Support
  const handleDragEnter = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    if (!target.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      onPickMedia(dt.files);
    }
  }, [onPickMedia]);

  // Paste Support
  React.useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (!open) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        const dt = new DataTransfer();
        files.forEach(f => dt.items.add(f));
        onPickMedia(dt.files);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open, onPickMedia]);

  const removeMedia = (id: string) => {
    setMedia((prev) => {
      const m = prev.find((x) => x.id === id);
      if (m?.preview?.startsWith('blob:')) URL.revokeObjectURL(m.preview);
      return prev.filter((x) => x.id !== id);
    });
  };

  // GIF handling
  const [gifOpen, setGifOpen] = React.useState(false);
  const [gifErr, setGifErr] = React.useState<string | null>(null);
  const justSubmittedRef = React.useRef(false);

  const [isPending, startTransition] = React.useTransition();

  async function pickGifByUrl(url: string) {
    // GIFs gelten als Bilder -> nur zulassen, wenn KEIN Video vorhanden ist
    if (media.some((m) => m.kind === 'video')) {
      toast.error(tt('gif.noGifWhenVideo'));
      setGifOpen(false);
      return;
    }
    if (atLimit(media.length)) {
      toast.error(tt('media.maxReached', { max: MEDIA_MAX }));
      setGifOpen(false);
      return;
    }

    // ✅ Host-Validierung vor dem Fetch
    try {
      const u = new URL(url);
      if (!ALLOWED_GIF_HOSTS.includes(u.hostname)) {
        setGifErr(t('states.gifLoadError'));
        return;
      }
    } catch {
      setGifErr(t('states.gifLoadError'));
      return;
    }

    try {
      setGifErr(null);
      const r = await fetch(url, { mode: 'cors' });
      const blob = await r.blob();

      // ✅ Nur image/* akzeptieren
      if (!blob.type.startsWith('image/')) {
        setGifErr(t('states.gifLoadError'));
        return;
      }

      const type = blob.type || 'image/gif';
      const file = new File([blob], `gif_${Date.now()}.gif`, { type });
      const local = URL.createObjectURL(blob);

      setMedia((prev) => {
        if (atLimit(prev.length)) return prev;
        return [...prev, { id: crypto.randomUUID(), file, preview: local, kind: 'image' }];
      });
      setGifOpen(false);
    } catch {
      setGifErr(t('states.gifLoadError'));
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
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
  };

  // ⬇️ Früher Return jetzt NACH allen Hooks
  if (!mounted || !open || justSubmittedRef.current) return null;

  const hasAnyMedia = media.length > 0;

  const RemoveBtn = ({ id, small = false }: { id: string; small?: boolean }) => (
    <button
      type="button"
      onClick={() => removeMedia(id)}
      className={`absolute top-2 right-2 rounded-md bg-black/70 border border-white/20 hover:bg-black/80 ${
        small ? 'px-1.5 py-0.5 text-[12px]' : 'px-2 py-1 text-[13px]'
      }`}
      title={t('actions.removeImage')}
    >
      {t('actions.removeImage')}
    </button>
  );

  const Mosaic = () => {
    const imgs = media.filter((m) => m.kind === 'image');
    const onlyImages = imgs.length === media.length;
    if (!onlyImages || media.length === 0) return null;
    if (media.length > 4) return null;

    if (media.length === 1) {
      const m = media[0];
      return (
        <figure className="relative overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <BlobImg
            src={m.preview}
            alt=""
            className="block mx-auto max-w-full h-auto object-contain max-h-[48vh] sm:max-h-[60vh]"
          />
          {isHeicLike(m.file) && <HeicBadge />}
          <RemoveBtn id={m.id} />
        </figure>
      );
    }

    if (media.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
          {media.map((m) => (
            <div key={m.id} className="relative bg-black/20 h-72">
              <BlobImg src={m.preview} alt="" className="w-full h-full object-cover" />
              {isHeicLike(m.file) && <HeicBadge />}
              <RemoveBtn id={m.id} small />
            </div>
          ))}
        </div>
      );
    }

    if (media.length === 3) {
      const [a, b, c] = media;
      return (
        <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
          <div className="relative col-span-1 row-span-2 bg-black/20 min-h-[40vh]">
            <BlobImg src={a.preview} alt="" className="w-full h-full object-cover" />
            {isHeicLike(a.file) && <HeicBadge />}
            <RemoveBtn id={a.id} small />
          </div>
          <div className="relative bg-black/20 h-36">
            <BlobImg src={b.preview} alt="" className="w-full h-full object-cover" />
            {isHeicLike(b.file) && <HeicBadge />}
            <RemoveBtn id={b.id} small />
          </div>
          <div className="relative bg-black/20 h-36">
            <BlobImg src={c.preview} alt="" className="w-full h-full object-cover" />
            {isHeicLike(c.file) && <HeicBadge />}
            <RemoveBtn id={c.id} small />
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
        {media.map((m) => (
          <div key={m.id} className="relative bg-black/20 h-48">
            <BlobImg src={m.preview} alt="" className="w-full h-full object-cover" />
            {isHeicLike(m.file) && <HeicBadge />}
            <RemoveBtn id={m.id} small />
          </div>
        ))}
      </div>
    );
  };

  const Carousel = () => {
    const useCarousel = media.some((m) => m.kind === 'video') || media.length > 4;
    if (!useCarousel) return null;

    return (
      <figure className="mt-1 overflow-hidden rounded-xl border border-white/10 bg-black/20" data-no-nav>
        <div className="relative">
          <div className="flex overflow-x-auto snap-x snap-mandatory scroll-px-4 gap-1 p-1" style={{ scrollBehavior: 'smooth' }}>
            {media.map((m, idx) => (
              <div key={m.id} className="relative shrink-0 basis-full snap-center w-full">
                {m.kind === 'video' ? (
                  <video
                    src={m.preview}
                    className="block w-full h-auto object-contain max-h-[48vh] sm:max-h-[60vh] bg-black"
                    controls
                    preload="metadata"
                    playsInline
                    muted
                  />
                ) : (
                  <BlobImg src={m.preview} alt="" className="block w-full h-auto object-contain max-h-[48vh] sm:max-h-[60vh]" />
                )}
                {isHeicLike(m.file) && <HeicBadge />}
                <RemoveBtn id={m.id} />
                <div className="absolute left-2 bottom-2 rounded-full bg-black/60 text-xs px-2 py-1">
                  {idx + 1}/{media.length}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-1 px-1 pb-1 overflow-x-auto">
            {media.map((m) => (
              <div key={m.id} className="relative size-12 rounded-md overflow-hidden border border-white/15 bg-white/5">
                {m.kind === 'video' ? (
                  <div className="grid place-items-center w-full h-full text-white/80 text-[10px]">VID</div>
                ) : (
                  <BlobImg src={m.preview} alt="" className="w-full h-full object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      </figure>
    );
  };

  const TooManyOverlayMosaic = () => {
    const onlyImages = media.every((m) => m.kind === 'image');
    if (!onlyImages || media.length <= 4) return null;

    const firstFour = media.slice(0, 4);
    const rest = media.length - 4;

    return (
      <div className="grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
        {firstFour.map((m, i) => (
          <div key={m.id} className="relative bg-black/20 h-48">
            <BlobImg src={m.preview} alt="" className="w-full h-full object-cover" />
            {i === 3 && rest > 0 && (
              <div className="absolute inset-0 bg-black/60 grid place-items-center text-white text-xl font-semibold">
                +{rest}
              </div>
            )}
            {isHeicLike(m.file) && <HeicBadge />}
            <RemoveBtn id={m.id} small />
          </div>
        ))}
      </div>
    );
  };

  const showGridMosaic = media.length > 0 && media.length <= 4 && media.every((m) => m.kind === 'image');
  const hasVideo = media.some((m) => m.kind === 'video');
  const limitReached = hasVideo ? true : media.length >= MEDIA_MAX;
  const modal = (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('aria.modalLabel')}
    >
      <div style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header bleibt oben */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="text-[18px] font-semibold">{t('header.newPost')}</div>
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg hover:bg-white/5">
            {t('actions.close')}
          </button>
        </div>

        {/* Form als Column-Layout, Body scrollt */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget as HTMLFormElement;
            const fd = new FormData(form);
            clearDraft();

            // --- (A) Return-Ziel setzen, damit das Modal nicht erneut öffnet ---
            if (!fd.get('returnTo')) {
              const url = new URL(window.location.href);
              ['compose', 'post', 'modal', 'newPost'].forEach((k) => url.searchParams.delete(k));
              const clean = url.pathname + (url.search ? url.search : '');
              fd.set('returnTo', clean || url.pathname);
              try { window.history.replaceState(null, '', clean || url.pathname); } catch {}
            }

            // --- PRE-UPLOAD Block bleibt unverändert ---
            const toDirect = media.filter(m => m.kind === 'video' || m.file.size > 2_000_000);

            let uploadedUrls: string[] = [];
            if (toDirect.length) {
              setUploadProgress(0);
              
              const r = await fetch('/api/upload-urls', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: toDirect.map(m => ({ name: m.file.name, type: m.file.type })) }),
              });

              if (!r.ok) {
                toast.error(tt('upload.presignFailed'));
                setUploadProgress(null);
                return;
              }
              
              const { items } = (await r.json()) as { items: { uploadUrl: string; publicUrl: string }[] };

              // Upload files with progress tracking
              const uploadPromises = items.map(async (it, i) => {
                const progress = Math.round(((i) / items.length) * 100);
                setUploadProgress(progress);
                
                const result = await fetch(it.uploadUrl, {
                  method: 'PUT',
                  body: toDirect[i]!.file,
                  headers: { 'Content-Type': toDirect[i]!.file.type || 'application/octet-stream' },
                });
                
                const newProgress = Math.round(((i + 1) / items.length) * 100);
                setUploadProgress(newProgress);
                
                return result;
              });

              const results = await Promise.allSettled(uploadPromises);

              const okIdx = results
                .map((r, i) => (r.status === 'fulfilled' && r.value.ok ? i : -1))
                .filter(i => i >= 0);

              uploadedUrls = okIdx.map(i => items[i]!.publicUrl);

              if (okIdx.length !== items.length) {
                toast.error(tt('upload.someFailed'));
              }
              
              setUploadProgress(null);
            }
            fd.delete('media');
            for (const m of media) {
              if (toDirect.includes(m)) continue;
              fd.append('media', m.file);
            }
            for (const url of uploadedUrls) fd.append('uploadedUrl', url);
            startTransition(() => {
              // ts-expect-error — Client Action, React übergibt FormData
              void createPost(fd);
            });
            justSubmittedRef.current = true;
            setMedia([]);
            setText('');
            setUploadProgress(null);
            toast.posted(tt('post.published'));
            onClose();
            try {
              for (const m of media) if (m.preview?.startsWith('blob:')) URL.revokeObjectURL(m.preview);
            } catch (err) {
              console.error('[ComposePostModal] submit err:', err);
              toast.error(tt('post.failedTitle'));
              setUploadProgress(null);
            }
          }}
          className="flex min-h-0 flex-col"
        >

          {/* BODY (scrollbar) */}
          <div 
            ref={dropZoneRef}
            className={`px-4 pt-4 pb-3 grid gap-3 flex-1 min-h-0 overflow-y-auto ${isDragging ? 'bg-[var(--purple)]/10 border-2 border-dashed border-[var(--purple)]' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {/* Drag & Drop Overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm pointer-events-none">
                <div className="text-center">
                  <div className="text-4xl mb-2">📎</div>
                  <div className="text-lg font-semibold text-[var(--purple)]">Drop files here</div>
                </div>
              </div>
            )}

            {/* Anchor für MentionSuggest */}
            <div ref={anchorRef as React.RefObject<HTMLDivElement>} className="relative">
              <textarea
                ref={textareaRef as React.RefObject<HTMLTextAreaElement>}
                name="text"
                rows={3}
                placeholder={t('fields.textPlaceholder')}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/40 resize-none overflow-hidden"
                maxLength={MAX_CHARS}
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ minHeight: '80px', maxHeight: '400px' }}
              />
              
              {/* Character Counter */}
              <div className="absolute bottom-2 right-2 text-xs tabular-nums pointer-events-none">
                <span className={charCount > MAX_CHARS * 0.9 ? 'text-red-400' : 'text-white/60'}>
                  {charCount}/{MAX_CHARS}
                </span>
              </div>

              <MentionSuggest anchorRef={anchorRef as React.RefObject<HTMLElement>} value={text} onChange={setText} limit={8} />
            </div>

            {/* PREVIEWS */}
            {hasAnyMedia && (
              <>
                {showGridMosaic ? <Mosaic /> : null}
                {!showGridMosaic && media.every((m) => m.kind === 'image') && media.length > 4 ? <TooManyOverlayMosaic /> : null}
                {!showGridMosaic && (media.some((m) => m.kind === 'video') || media.length > 4) ? <Carousel /> : null}
              </>
            )}
          </div>

          {/* FOOTER bleibt sichtbar (Body scrollt) */}
          <div className="px-4 py-3 border-t border-white/10 bg-[#0b0b0b]">
            {/* Upload Progress Bar */}
            {uploadProgress !== null && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                  <span>Uploading...</span>
                  <span>{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[var(--purple)] transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {/* Medienauswahl */}
                <label
                  className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/12 ${
                    limitReached ? 'opacity-50 pointer-events-none' : 'hover:bg-white/[.06] cursor-pointer'
                  }`}
                  aria-disabled={limitReached}
                >
                  <input
                    ref={fileInputRef}
                    key={media.length}
                    type="file"
                    accept="image/*,video/*"
                    multiple={!hasVideo}
                    className="sr-only"
                    onChange={(e) => onPickMedia(e.currentTarget.files, e.currentTarget)}
                    disabled={limitReached}
                  />
                  <span className="inline-grid place-items-center" style={{ width: 28, height: 28, color: 'var(--purple)' }} aria-hidden>
                    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
                      <path d="M7.5 14.5 10.5 11l3 3 2.5-2.5 3 3" />
                      <circle cx="9" cy="9" r="1.5" />
                    </svg>
                  </span>
                  <span className="text-sm text-white/80">{t('fields.mediaLabel')}</span>
                </label>

                {/* GIF Button */}
                <button
                  type="button"
                  onClick={() => !limitReached && setGifOpen(true)}
                  disabled={limitReached}
                  className={`inline-flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/12 ${limitReached ? 'opacity-50 pointer-events-none' : 'hover:bg-white/[.06]'}`}
                  title={t('titles.gifSearch')}
                  aria-label={t('titles.gifSearch')}
                >
                  <span className="inline-grid place-items-center" style={{ width: 28, height: 28, color: 'var(--purple)' }} aria-hidden>
                    <GifIcon size={22} />
                  </span>
                  <span className="text-sm text-white/80">{t('fields.gifLabel')}</span>
                </button>
                <div className="text-xs text-white/60 ml-3">{media.length}/{MEDIA_MAX}</div>
              </div>
              
              <button
                type="submit"
                className="px-4 py-1.5 rounded-full bg-[var(--purple)] hover:opacity-95 text-white disabled:opacity-50"
                disabled={(text.trim().length === 0 && media.length === 0) || isPending}
              >
                {isPending ? tn('uploading') : t('actions.post')}
              </button>
            </div>

            {gifErr && <div className="text-xs text-red-300 mt-2">{gifErr}</div>}
          </div>
        </form>
      </div>

      <GifPickerModal open={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => void pickGifByUrl(url)} />
    </div>
  );
  return createPortal(modal, document.body);
}

/* --------- Icon --------- */
function GifIcon({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="1.75" y="1.75" width="20.5" height="20.5" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="15.6" textAnchor="middle" fontFamily="ui-sans-serif,system-ui" fontWeight="700" fontSize="11.5" fill="currentColor">
        GIF
      </text>
    </svg>
  );
}
