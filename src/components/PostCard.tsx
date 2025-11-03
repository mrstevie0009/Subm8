// src/components/PostCard.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ProfileLink from '@/components/ProfileLink';
import BookmarkButton from '@/components/BookmarkButton';
import { likePostAction, unlikePostAction } from '@/app/actions/likes';
import CommentComposer from '@/components/comments/CommentComposer';
import { reportPostAction } from '@/app/actions/reports';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import RichText from '@/components/RichText';
import QuoteOverlay from '@/components/quotes/QuoteOverlay';
import VideoPlayer from '@/components/VideoPlayer';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/toast';
import { UserBadges } from '@/components/UserBadges';

const isPremiumActive = (iso?: string | null) =>
  !!iso && new Date(iso).getTime() > Date.now();

const AVATAR_PH = '/images/avatar-placeholder.png';


/** —— Feed-Shape (mit optionaler Quote) + NEU: Multi-Media-Unterstützung —— */
type ContentMedia = {
  url: string;
  alt?: string | null;
  kind?: 'image' | 'video' | 'gif';
  mime?: string | null;
};

export type FeedPost = {
  id: string;
  createdAtISO: string;
  content: {
    id: string;
    text: string;
    /** Alt: Einzelnes Medium */
    mediaUrl?: string | null;
    mediaAlt?: string | null;
    /** Neu: Mehrere Medien */
    media?: ContentMedia[] | null;
    uploaded?: ContentMedia[] | null;     // <— HINZU
    /** Alternative API-Shapes */
    mediaUrls?: string[] | null;
    attachments?: Array<{ url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif' }> | null;
    createdAt: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
      role?: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl?: string | null;
      premiumUntil?: string | null;
      isFirstAdopter?: boolean;
    };
    quote?: {
      id: string;
      text: string;
      mediaUrl?: string | null;
      mediaAlt?: string | null;
      media?: ContentMedia[] | null;
      uploaded?: ContentMedia[] | null;     // <— HINZU
      mediaUrls?: string[] | null;
      attachments?: Array<{ url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif' }> | null;
      createdAt: string;
      author: {
        id: string;
        handle: string;
        displayName: string;
        role?: 'DOMME' | 'SUBMISSIVE' | null;
        avatarUrl?: string | null;
      };
    } | null;
  };
  reposter: { id: string; handle: string; displayName: string } | null;
  stats?: { comments?: number; reposts?: number; likes?: number };
  viewer?: {
    liked?: boolean;
    bookmarked?: boolean;
    hasBlockedAuthor?: boolean;
    blockedByAuthor?: boolean;
    isAuthor?: boolean;
    commented?: boolean; // ⬅️ optional vom Server hydrieren
  };
  initiallyBookmarked?: boolean;
  community?: { name: string; slug: string } | null;
};





function Counter({ value = 0, active }: { value?: number; active?: boolean }) {
  return (
    <span className="text-sm" style={{ color: active ? 'var(--purple)' : 'var(--muted)' }}>
      {value ?? 0}
    </span>
  );
}

/** Lokalisierte Kurzzeit-Angabe: now / 5m / 2h / 3d */
function timeAgoShort(iso: string, tTime: ReturnType<typeof useTranslations>) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return tTime('time.now');
  if (m < 60) return tTime('time.m', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tTime('time.h', { count: h });
  const d = Math.floor(h / 24);
  return tTime('time.d', { count: d });
}

function RepostIconFilled(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden {...props}>
      <path d="m 492.51,213.14 a 29,29 0 0 0 -41,0 l -24.38,24.38 V 89.06 a 29,29 0 0 0 -29,-29 H 161.89 a 29,29 0 0 0 0,58 h 207.23 v 119.46 l -24.38,-24.38 a 29,29 0 1 0 -41,41 L 377.61,328 a 29,29 0 0 0 41,0 l 73.88,-73.88 a 29,29 0 0 0 0.02,-40.98 z m -142.4,180.8 H 142.88 V 274.48 l 24.38,24.38 a 29,29 0 0 0 41,-41 L 134.39,184 a 29,29 0 0 0 -41,0 l -73.9,73.85 a 29,29 0 0 0 41,41 l 24.38,-24.38 v 148.47 a 29,29 0 0 0 29,29 h 236.24 a 29,29 0 0 0 0,-58 z" />
    </svg>
  );
}

function RepostIconOutline(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden {...props}>
      <path d="m 492.51,213.14 a 29,29 0 0 0 -41,0 l -24.38,24.38 V 89.06 a 29,29 0 0 0 -29,-29 H 161.89 a 29,29 0 0 0 0,58 h 207.23 v 119.46 l -24.38,-24.38 a 29,29 0 1 0 -41,41 L 377.61,328 a 29,29 0 0 0 41,0 l 73.88,-73.88 a 29,29 0 0 0 0.02,-40.98 z m -142.4,180.8 H 142.88 V 274.48 l 24.38,24.38 a 29,29 0 0 0 41,-41 L 134.39,184 a 29,29 0 0 0 -41,0 l -73.9,73.85 a 29,29 0 0 0 41,41 l 24.38,-24.38 v 148.47 a 29,29 0 0 0 29,29 h 236.24 a 29,29 0 0 0 0,-58 z" />
    </svg>
  );
}


/* ----------------------------- Icons ----------------------------- */
function BanIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm5.657 3.343L6.343 17.657M5.3 9.9a7 7 0 0 1 8.8-4.6m4.6 8.8a7 7 0 0 1-8.8 4.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ShieldOffIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M19.5 12.5v-6l-7.5-3-7.5 3v6c0 4.2 3.2 7.7 7.5 8 1.6-.11 3.2-.71 4.5-1.66M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ShareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v10" strokeLinecap="round" />
      <path d="M8.5 6.5 12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="11" width="16" height="9" rx="2.5" />
    </svg>
  );
}

/* ------------------------ Blockstatus-Badges ------------------------ */
function BlockBadges({ hasBlockedAuthor, blockedByAuthor, tPost }: { hasBlockedAuthor: boolean; blockedByAuthor: boolean; tPost: ReturnType<typeof useTranslations> }) {
  if (!hasBlockedAuthor && !blockedByAuthor) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1" data-no-nav>
      {hasBlockedAuthor && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
          <BanIcon /> {tPost('block.blocksYou')}
        </span>
      )}
      {blockedByAuthor && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
          <ShieldOffIcon /> {tPost('blockStatus.blocksYou')}
        </span>
      )}
    </span>
  );
}

/* ------------------------ Media Helper ------------------------ */
function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i.test(clean);
}
function isGifUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.gif$/i.test(clean);
}
const kindFromUrl = (url: string): 'image' | 'video' | 'gif' =>
  isVideoUrl(url) ? 'video' : isGifUrl(url) ? 'gif' : 'image';

// ⬇️ NEU: MIME → kind
function kindFromMime(mime?: string | null): 'image' | 'video' | 'gif' {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('video/')) return 'video';
  if (m === 'image/gif') return 'gif';
  return 'image';
}
// ⬇️ NEU: bevorzugt kind, dann mime, dann URL
function inferKind(input: { kind?: 'image'|'video'|'gif'; mime?: string | null; url: string }) {
  if (input.kind) return input.kind;
  if (input.mime) return kindFromMime(input.mime);
  return kindFromUrl(input.url);
}

/** Vereinheitlicht alle möglichen Felder zu ContentMedia[] */
type MediaContainer = {
  media?: ContentMedia[] | null;
  uploaded?: ContentMedia[] | null;
  mediaUrls?: string[] | null;
  attachments?: Array<{ url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif'; mime?: string | null; type?: string | null; }> | null;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
};
function normalizeMediaFields(src: MediaContainer): ContentMedia[] {
  const out: ContentMedia[] = [];

  const pushArr = (arr?: ContentMedia[] | null) => {
    if (!Array.isArray(arr)) return;
    for (const m of arr) {
      if (m?.url) out.push({
        url: m.url,
        alt: m.alt ?? null,
        kind: inferKind({ kind: m.kind, mime: (m).mime, url: m.url }),
        mime: (m).mime ?? null,
      });
    }
  };
  pushArr(src.media);
  pushArr(src.uploaded); // behält mime falls vorhanden

  if (Array.isArray(src.attachments)) {
    for (const m of src.attachments) if (m?.url) out.push({
      url: m.url,
      alt: m.alt ?? null,
      kind: inferKind({ kind: m.kind, mime: (m).mime ?? (m).type, url: m.url }),
      mime: (m).mime ?? (m).type ?? null,
    });
  }
  if (Array.isArray(src.mediaUrls)) {
    for (const url of src.mediaUrls) if (url) out.push({
      url, alt: null, kind: kindFromUrl(url), mime: null
    });
  }
  if (src.mediaUrl) {
    out.push({ url: src.mediaUrl, alt: src.mediaAlt ?? null, kind: kindFromUrl(src.mediaUrl), mime: null });
  }

  const seen = new Set<string>();
  return out.filter(m => (seen.has(m.url) ? false : (seen.add(m.url), true)));
}



/** Einzelnes Medium (Bild/GIF/Video) */
function SingleMedia({
  m,
  priority = false,
  onOpen,
  index = 0,
}: {
  m: ContentMedia;
  priority?: boolean;
  onOpen?: (startIndex: number) => void;
  index?: number;
}) {
  const alt = m.alt ?? '';
  const open = () => onOpen?.(index);
  
  if (m.kind === 'video') {
    const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
    return (
      <figure
        className="mt-2 sm:mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20"
        data-no-nav
        onClick={stop}
        onDoubleClick={stop}
        onPointerDownCapture={stop}
        onKeyDownCapture={(e) => {
          if ((e as React.KeyboardEvent).key === ' ' || (e as React.KeyboardEvent).key === 'Enter') {
            e.stopPropagation();
          }
        }}
      >
        <VideoPlayer src={m.url} className="w-full h-auto max-h-[58vh] sm:max-h-[70vh]" />
      </figure>
    );
  }

  const ImgTag = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={m.url}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className="block mx-auto h-auto w-full max-w-full max-h-[58vh] sm:max-h-[70vh] object-contain"
    />
  );

  return (
    <figure
      className="mt-2 sm:mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20"
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : -1}
      data-no-nav
      onClick={open}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onOpen) { e.preventDefault(); open(); }
      }}
    >
      {ImgTag}
    </figure>
  );
}

function useBodyLock(lock: boolean) {
  React.useEffect(() => {
    if (!lock) return;
    const y = window.scrollY;
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.position = 'fixed';
    document.body.style.top = `-${y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
    return () => {
      const top = document.body.style.top;
      document.body.removeAttribute('style');
      window.scrollTo(0, top ? -parseInt(top, 10) : 0);
    };
  }, [lock]);
}

/** Mosaik-Layout für reine Bilder (≤4) */
function MediaMosaic({ items, onOpen }: { items: ContentMedia[]; onOpen?: (i:number)=>void }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const images = items.filter((m) => m.kind !== 'video');
  if (images.length !== items.length || items.length > 4) return null;

  if (items.length === 1) return <SingleMedia m={items[0]} priority onOpen={onOpen} index={0} />;

  const cell = (m: ContentMedia, i: number) => (
    <button
      key={m.url}
      type="button"
      className="relative bg-black/20 w-full h-full"
      onClick={(e) => { e.stopPropagation(); onOpen?.(i); }}
      data-no-nav
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.url} alt={m.alt ?? ''} className="w-full h-full object-cover" />
    </button>
  );

  if (items.length === 2) {
    return (
      <div className="mt-2 sm:mt-3 w-full grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10 h-[48vh] sm:h-80">
        {items.map((m, i) => cell(m, i))}
      </div>
    );
  }

  if (items.length === 3) {
    const [a, b, c] = items;
    return (
      <div className="mt-2 sm:mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
        <div className="relative col-span-1 row-span-2 bg-black/20 max-h-[56vh] sm:max-h-[70vh]">
          {cell(a, 0)}
        </div>
        <div className="relative h-36 sm:h-40">{cell(b, 1)}</div>
        <div className="relative h-36 sm:h-40">{cell(c, 2)}</div>
      </div>
    );
  }

  // 4 Items
  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
      {items.map((m, i) => (
        <div key={m.url} className="relative bg-black/20 h-44 sm:h-56">
          {cell(m, i)}
        </div>
      ))}
    </div>
  );
}

/** Overlay-Grid 2x2 mit +N für >4 reine Bilder */
function MediaMosaicOverflow({ items, onOpen }: { items: ContentMedia[]; onOpen?: (i:number)=>void }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const imageIndices = items.reduce<number[]>(
    (acc, m, idx) => (m.kind !== 'video' ? (acc.push(idx), acc) : acc),
    []
  );
  if (imageIndices.length !== items.length || imageIndices.length <= 4) return null;

  const first4 = imageIndices.slice(0, 4);
  const more = imageIndices.length - 4;

  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl overflow-hidden border border-white/10">
      {first4.map((origIdx, i) => {
        const m = items[origIdx];
        return (
          <button
            key={m.url}
            type="button"
            className="relative bg-black/20 w-full h-44 sm:h-56"
            onClick={(e) => { e.stopPropagation(); onOpen?.(origIdx); }}
            data-no-nav
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.alt ?? ''} className="w-full h-full object-cover" />
            {i === 3 && more > 0 && (
              <div className="absolute inset-0 bg-black/60 grid place-items-center text-white text-xl font-semibold">
                +{more}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MediaCarousel({ items, onOpen }: { items: ContentMedia[]; onOpen?: (i:number)=>void }) {
  // Hooks must always run:
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const [idx, setIdx] = React.useState(0);

  const draggingRef = React.useRef(false);
  const startXRef = React.useRef(0);
  const startScrollRef = React.useRef(0);
  const deltaRef = React.useRef(0);
  const clickGuardRef = React.useRef(false);

  // Derived booleans AFTER hooks:
  const hasVideo = React.useMemo(() => items?.some((m) => m.kind === 'video'), [items]);
  const shouldRender = Array.isArray(items) && items.length > 0 && (hasVideo || items.length > 1);
  

  const snapTo = React.useCallback((targetIndex: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const x = Math.max(0, Math.min(items.length - 1, targetIndex)) * w;
    el.scrollTo({ left: x, behavior: 'smooth' });
  }, [items.length]);

  const onScroll = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    if (i !== idx) setIdx(Math.max(0, Math.min(items.length - 1, i)));
  }, [idx, items.length]);

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current;
    if (!el) return;
    if (e.button !== 0 && e.pointerType !== 'touch') return;
    draggingRef.current = true;
    clickGuardRef.current = false;
    el.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    startScrollRef.current = el.scrollLeft;
    deltaRef.current = 0;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const el = scrollerRef.current;
    if (!el) return;
    e.preventDefault();
    const dx = e.clientX - startXRef.current;
    deltaRef.current = dx;
    if (Math.abs(dx) > 6) clickGuardRef.current = true;
    el.scrollLeft = startScrollRef.current - dx;
  };

  const onPointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const curr = el.scrollLeft / w;
    const vel = -deltaRef.current;
    const threshold = 0.18;
    let target = Math.round(curr);
    if (Math.abs(vel) > 20) {
      target = vel > 0 ? Math.ceil(curr) : Math.floor(curr);
    } else {
      const frac = curr - Math.floor(curr);
      if (frac > (1 - threshold)) target = Math.ceil(curr);
      else if (frac < threshold)  target = Math.floor(curr);
      else target = Math.round(curr);
    }
    snapTo(target);
  };

  const go = (i: number) => snapTo(i);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); snapTo(idx - 1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); snapTo(idx + 1); }
  };

  if (!shouldRender) return null;

  return (
    <figure className="mt-2 sm:mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20" data-no-nav>
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex no-scrollbar snap-x snap-mandatory gap-0 p-0 overflow-x-auto"
          style={{ scrollBehavior: 'smooth', touchAction: 'pan-y' }}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKey}
          tabIndex={0}
          aria-label="Media carousel"
        >
          {items.map((m, i) => {
            const handleClickImage = (e: React.MouseEvent) => {
              if (clickGuardRef.current) { e.stopPropagation(); return; }
              onOpen?.(i);
            };
            return (
              <div key={m.url} className="relative shrink-0 basis-full snap-center px-2">
                {m.kind === 'video' ? (
                  // ✅ wrap VideoPlayer to stop propagation (no onClick prop on VideoPlayer)
                  <div onClick={(e) => e.stopPropagation()}>
                    <VideoPlayer src={m.url} className="w-full h-auto max-h-[58vh] sm:max-h-[70vh]" />
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.url}
                    alt={m.alt ?? ''}
                    className="block w-full h-auto object-contain max-h-[58vh] sm:max-h-[70vh] cursor-zoom-in"
                    onClick={handleClickImage}
                    draggable={false}
                  />
                )}
                <div className="absolute left-3 bottom-2 rounded-full bg-black/60 text-xs px-2 py-1">
                  {i + 1}/{items.length}
                </div>
              </div>
            );
          })}
        </div>

        {items.length > 1 && (
          <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1.5 pointer-events-none">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                className="pointer-events-auto rounded-full"
                style={{
                  width: i === idx ? 10 : 6,
                  height: i === idx ? 10 : 6,
                  background: i === idx ? 'white' : 'rgba(255,255,255,.55)',
                  opacity: i === idx ? 0.95 : 0.75,
                  transition: 'all 160ms ease',
                  outline: 'none',
                  border: 'none',
                }}
                onClick={(e) => { e.stopPropagation(); go(i); }}
              />
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}


type AnyHTMLElementRef =
  | React.RefObject<HTMLElement | null>
  | React.MutableRefObject<HTMLElement | null>;

function Popover({
  anchorRef, open, onClose, children, offset = 8
}: { anchorRef: AnyHTMLElementRef; open: boolean; onClose: () => void; children: React.ReactNode; offset?: number }) {
  const [pos, setPos] = React.useState<{top:number; left:number} | null>(null);

  React.useLayoutEffect(() => {
    const el = anchorRef.current;
    if (!open || !el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const width = 160;   // ≈ w-40
    const height = 88;   // grob, wird unten nochmal korrigiert

    // Standard: unterhalb linksbündig
    let top = rect.bottom + offset;
    const left = Math.min(vw - width - 8, Math.max(8, rect.left));

    // Flip nach oben, wenn unten kein Platz
    if (top + height > vh) top = Math.max(8, rect.top - height - offset);

    setPos({ top, left });
  }, [open, anchorRef, offset]);

  React.useEffect(() => {
    if (!open) return;
    const onKeys = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onScroll = () => onClose();
    window.addEventListener('keydown', onKeys);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('keydown', onKeys);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, onClose]);

  if (!open || !anchorRef.current || !pos) return null;
  return createPortal(
    <>
      {/* Click-away */}
      <div
        className="fixed inset-0 z-[2147483601]"
        onPointerDown={onClose}
      />
      <div
        className="fixed z-[2147483602] w-40 rounded-lg border border-white/10 bg-black/80 backdrop-blur p-1 shadow-lg"
        style={{ top: pos.top, left: pos.left }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
}
  

/* ------------------- DM Share Overlay (vollständig) ------------------- */
function DMShareOverlay({
  open,
  onClose,
  postId,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  locale: string;
}) {
  const tPost = useTranslations('post');

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<
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

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/chat', { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        if (!cancelled) setItems(j.items || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load chats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = !qq
      ? items
      : items.filter(
          (i) =>
            i.other.displayName.toLowerCase().includes(qq) ||
            i.other.username.toLowerCase().includes(qq)
        );
    return base.sort(
      (a, b) =>
        new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  }, [items, q]);

  const postUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/p/${postId}`
      : `/${locale}/p/${postId}`;

  async function send() {
    if (selected.size === 0) return;
    try {
      setSending(true);
      setError(null);
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((conversationId) =>
          fetch('/api/chat/share-link', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              conversationId,
              postId,
              url: postUrl,
              note: note.trim() || undefined,
            }),
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
      data-no-nav
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {/* Panel */}
      <div
        className="absolute left-1/2 top-1/2 w-[min(720px,94vw)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#0b0b0d] p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-2 border-b border-white/10">
          <div className="text-[18px] font-semibold">{tPost('share.dmTitle')}</div>
          <div className="mt-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tPost('share.searchPlaceholder')}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
            />
          </div>
        </div>

        <div className="mt-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          {loading && (
            <div className="px-3 py-6 text-sm text-white/70">
              {tPost('share.loadingChats')}
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-3 text-sm text-red-400">{error}</div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="px-3 py-6 text-sm text-white/70">{tPost('share.empty')}</div>
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
                      <div className="text-sm text-white/70 truncate">@{c.other.username}</div>
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

        <div className="px-3 pt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder={tPost('share.notePlaceholder')}
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
            {tPost('share.cancel')}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void send();
            }}
            disabled={sending || selected.size === 0}
            className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50"
          >
            {sending ? tPost('share.sending') : tPost('share.send')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function usePulseFlag(ms = 650) {
  const [flag, setFlag] = React.useState(false);
  const fire = React.useCallback(() => {
    setFlag(true);
    window.setTimeout(() => setFlag(false), ms);
  }, [ms]);
  return [flag, fire] as const;
}

// --- Blur-Overlay für nicht verifizierte Nutzer ---
function BlurredMediaGate({
  items,
  onStartVeriff,
}: {
  items: ContentMedia[];
  onStartVeriff: () => void | Promise<void>;
  locale?: string;
}) {
  const tVerify = useTranslations('verify');
  const firstImg = items.find((m) => m.kind !== 'video');

  return (
    <div
      className="relative mt-2 sm:mt-3 rounded-xl border border-white/10 overflow-hidden"
      data-no-nav
      style={{ minHeight: 'clamp(280px, 62svh, 480px)' }}
    >
      {/* Backdrop (NO negative z-index) */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        {firstImg ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstImg.url}
            alt={firstImg.alt ?? ''}
            className="w-full h-full object-cover"
            // scale up to avoid blur clipping at edges
            style={{ filter: 'blur(22px) saturate(.6) brightness(.7)', transform: 'scale(1.06)' }}
            aria-hidden
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ filter: 'blur(12px)', background: 'rgba(0,0,0,.2)' }}
          />
        )}
      </div>

      {/* Foreground content */}
      <div className="absolute inset-0 z-10 overflow-y-auto overflow-x-hidden">
        <div className="min-h-full grid place-items-center p-4">
          <div className="pointer-events-auto text-center px-5 py-4 rounded-2xl border border-white/15 bg-black/70 backdrop-blur-md w-full max-w-[520px] break-words">
            <div className="text-base font-semibold hyphens-auto">
              {tVerify('overlay.heading')}
            </div>

            <div className="mt-2 text-sm text-white/80 mx-auto hyphens-auto" style={{ maxWidth: '38ch' }}>
              {tVerify('overlay.body')}
            </div>

            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void onStartVeriff(); }}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--purple)] px-4 py-2 text-white hover:opacity-95"
            >
              {tVerify('overlay.cta')}
            </button>

            <div className="mt-2 text-[11px] text-white/60">
              {tVerify('overlay.note')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}



// ⬆️ direkt nach den Imports oder irgendwo oberhalb von PostCard:
function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483604] flex items-center justify-center" role="dialog" aria-modal="true" data-no-nav onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-[min(520px,92vw)] rounded-2xl border border-white/12 bg-[#0b0b0d] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 grid size-9 place-items-center rounded-full border ${destructive ? 'border-red-400/40 bg-red-500/10 text-red-300' : 'border-white/15 bg-white/10 text-white/80'}`} aria-hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 9v4M12 17h.01" />
              <path d="M10 2h4l8 8v4l-8 8h-4l-8-8v-4z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-semibold">{title}</h2>
            <p className="mt-2 text-white/80">{message}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded-lg ${destructive ? 'bg-red-600/80 hover:bg-red-600 text-white' : 'bg-[var(--purple)] hover:opacity-95 text-white'} disabled:opacity-50`}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------------------- PostCard ---------------------- */
export default function PostCard({
  post,
  pinnedPostId,
}: { post: FeedPost; pinnedPostId?: string | null }) {
  const router = useRouter();
  const params = useParams() as { locale: string; handle?: string };
  const { locale, handle } = params;
  const pathname = usePathname();
  const searchParams = useSearchParams();
// STATE

  const [likes, setLikes] = React.useState<number>(post.stats?.likes ?? 0);
  const [liked, setLiked] = React.useState<boolean>(!!post.viewer?.liked);
  const [comments, setComments] = React.useState<number>(post.stats?.comments ?? 0);
  const [hasCommented, setHasCommented] = React.useState<boolean>(!!post.viewer?.commented);

  const t = useTranslations('common');       // Root (common.json)
  const tPost = useTranslations('post');
  const tTime = useTranslations('post');   // time.* liegen im Root

  const [hasReposted, setHasReposted] = React.useState(false);
  const [bookmarked, setBookmarked] = React.useState(!!post.initiallyBookmarked);
  // Animation-Trigger
  const [likePulse, fireLikePulse] = usePulseFlag();
  const [commentPulse, fireCommentPulse] = usePulseFlag();
  const [repostPulse, fireRepostPulse] = usePulseFlag();
  const [bookmarkPulse, fireBookmarkPulse] = usePulseFlag();

  const [composerOpen, setComposerOpen] = React.useState<boolean>(false);
  const [reposts, setReposts] = React.useState<number>(post.stats?.reposts ?? 0);
  const [repostMenuOpen, setRepostMenuOpen] = React.useState<boolean>(false);
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const rootRef   = React.useRef<HTMLElement | null>(null);
  const moreRef   = React.useRef<HTMLDivElement | null>(null);
  const shareRef  = React.useRef<HTMLDivElement | null>(null);
  const repostRef = React.useRef<HTMLDivElement | null>(null);
  const composerRef = React.useRef<HTMLDivElement | null>(null);
  const composerPortalRef = React.useRef<HTMLDivElement | null>(null);
  const c = post.content;

  const isRepost = post.id !== c.id;
  const uiRole =
  c.author.role === 'DOMME' ? 'domme' :
  c.author.role === 'SUBMISSIVE' ? 'submissive' :
  undefined as 'domme' | 'submissive' | undefined;

  const saveInteractionSnapshot = React.useCallback(() => {
  try {
    const snap = {
      likes,
      liked,
      comments,
      reposts,
      hasReposted,
      bookmarked,
    };
    sessionStorage.setItem(`ps:snap:${c.id}`, JSON.stringify(snap));
  } catch {}
}, [c.id, likes, liked, comments, reposts, hasReposted, bookmarked]);

  

  

 // beim Mount lokales Flag lesen (persistiert über Navigations)
 React.useEffect(() => {
   try {
     const key = `pc:commented:${c.id}`;
     if (sessionStorage.getItem(key) === '1') setHasCommented(true);
     // cross-tab / cross-card sync
     const onStorage = (e: StorageEvent) => {
       if (e.key === key && e.newValue === '1') setHasCommented(true);
     };
     window.addEventListener('storage', onStorage);
     return () => window.removeEventListener('storage', onStorage);
   } catch {}
 }, [c.id]);

  

  const closeTransientUI = React.useCallback(() => {
    setMoreOpen(false);
    setShareMenuOpen(false);
    setRepostMenuOpen(false);
    setComposerOpen(false);
  }, []);


  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const handleDelete = React.useCallback(async () => {
    setDeleting(true);
    try {
      // WICHTIG: Immer den *sichtbaren Post* ansprechen.
      // - Original-Post: post.id === c.id  → löscht original (+reposts)
      // - Repost:        post.id ≠ c.id    → löscht nur den Repost
      const url = `/api/posts/${post.id}?cascade=reposts`;

      const resp = await fetch(url, { method: 'DELETE' });
      const text = await resp.text();
      let err = '';
      try { err = (JSON.parse(text)?.error) || ''; } catch {}

      if (!resp.ok) {
        throw new Error(err || `HTTP ${resp.status}`);
      }

      setConfirmDeleteOpen(false);
      setDeleted(true);

      try { try { window.dispatchEvent(new CustomEvent('profile:pinnedChange', { detail: { postId: post.id, pinned: false } })); } catch {} } catch {}
      try { window.dispatchEvent(new CustomEvent('post:deleted', { detail: { contentId: c.id } })); } catch {}

      if (typeof window !== 'undefined' && window.location.pathname.includes(`/p/${post.id}`)) {
        
        router.push(`/${locale}`);
      } else {
        router.refresh();
      }
    } catch {
      toast.error(
        (tPost?.('delete.failed') as string) || 'Konnte den Post nicht löschen.',
        tPost?.('delete.title') || 'Löschen fehlgeschlagen'
      );

    } finally {
      setDeleting(false);
    }
  }, [c.id, locale, post.id, router, tPost]);



  const [reposting, setReposting] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState<boolean>(false);

  const [shareMenuOpen, setShareMenuOpen] = React.useState(false);
  const [dmShareOpen, setDmShareOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;

  const startAgeVerification = React.useCallback(async () => {
    try {
      const back =
        `${pathname}${searchParams && searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

      // Falls (aus irgendeinem Grund) keine Session vorhanden ist, leitest du zum Login
      if (!session) {
        router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }

      const res = await fetch(
        `/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`,
        { method: 'POST' }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.url) throw new Error(j?.details || j?.error || `HTTP ${res.status}`);

      router.push(j.url as string);
    } catch {
      toast.error('Die Verifikation konnte nicht gestartet werden.', 'Fehler');
    }
  }, [locale, pathname, searchParams, router, session]);


  const isMine = React.useMemo(() => {
    // Falls dein API-Flag vorhanden ist, nimm das
    if (typeof post.viewer?.isAuthor === 'boolean') return post.viewer.isAuthor;
    // Fallback: Session-User mit Autor des Contents vergleichen
    return !!(session?.user?.id && c.author.id && session.user.id === c.author.id);
  }, [session?.user?.id, c.author.id, post.viewer?.isAuthor]);
  
  const [deleted, setDeleted] = React.useState(false);


  const initialHasBlocked = !!post.viewer?.hasBlockedAuthor;
  const initialBlockedByAuthor = !!post.viewer?.blockedByAuthor;
  const [hasBlockedAuthor, setHasBlockedAuthor] = React.useState<boolean>(initialHasBlocked);
  const blockedByEither = initialBlockedByAuthor || hasBlockedAuthor;

  const [avatarSrc, setAvatarSrc] = React.useState<string>(c.author.avatarUrl || AVATAR_PH);
  const [pendingLike, startLikeTransition] = React.useTransition();

  const buildFeedQuery = React.useCallback(() => {
    const sp = new URLSearchParams();
    const feed = searchParams.get('feed');
    const role = searchParams.get('role');
    if (feed) sp.set('feed', feed);
    if (role) sp.set('role', role);
    return sp.toString() || 'default';
  }, [searchParams]);

  // vor Navigation: aktuelle Feed-Scroll-Position unter DEMSELBEN Key speichern,
  // den HomeFeedClient beim Restore liest
  const saveFeedReturnPoint = React.useCallback(() => {
    try {
      const y = String(window.scrollY || 0);
      const key = `homefeed:scroll:${buildFeedQuery()}`; // 👈 identisch zu HomeFeedClient
      sessionStorage.setItem(key, y);
    } catch {}
  }, [buildFeedQuery]);

  const goDetail = React.useCallback(
  (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.closest('[data-no-nav]')) return;

    saveInteractionSnapshot();   // ⬅️ NEU
    saveFeedReturnPoint();
    router.push(`/${locale}/p/${post.id}`);
  },
  [locale, post.id, saveFeedReturnPoint, saveInteractionSnapshot, router]
);

  const openMediaPage = (start: number) => {
    // 1) Interaktions-Snapshot sichern
    saveInteractionSnapshot();     // ⬅️ NEU

    // 2) komplette Media-Liste vorm Navigieren speichern (deins)
    try {
      const key = `pm:${post.id}`;
      const payload = {
        v: 1,
        at: Date.now(),
        items: mediaItems.map(m => ({ url: m.url, alt: m.alt ?? null, kind: m.kind })),
      };
      sessionStorage.setItem(key, JSON.stringify(payload));
    } catch {}

    // 3) Feed-Returnpoint + Navigation
    saveFeedReturnPoint();
    router.push(`/${locale}/p/${post.id}/media?i=${start}`);
  };

  const onKeyActivate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-no-nav]')) return;
      e.preventDefault();
      saveFeedReturnPoint();
      router.push(`/${locale}/p/${post.id}`);
    }
  };

  React.useEffect(() => {
  function onPointerDown(e: PointerEvent) {
    const target = e.target as Element | null;
  // Klicks auf Interaktionsflächen nie schließen lassen
    if (target?.closest('[data-no-nav]')) return; 

    const anyOpen = moreOpen || shareMenuOpen || repostMenuOpen || composerOpen;
    if (!anyOpen) return;

    const inMore   = moreOpen      && !!moreRef.current?.contains(target as Node);
    const inShare  = shareMenuOpen && !!shareRef.current?.contains(target as Node);
    const inRepost = repostMenuOpen&& !!repostRef.current?.contains(target as Node);
    const inInline = composerOpen  && !!composerRef.current?.contains(target as Node);
    const inPortal = composerOpen  && !!composerPortalRef.current?.contains(target as Node);

    // jetzt typ-sicher, weil target ein Element ist:
    const inComposerAny = !!target?.closest('[data-composer-root]');

    // ⬅️ hier wird inComposerAny **verwendet**
    if (inMore || inShare || inRepost || inInline || inPortal || inComposerAny) return;

    closeTransientUI();
  }

  window.addEventListener('pointerdown', onPointerDown);
  return () => window.removeEventListener('pointerdown', onPointerDown);
}, [moreOpen, shareMenuOpen, repostMenuOpen, composerOpen, closeTransientUI]);


  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeTransientUI();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeTransientUI]);

  React.useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        // Wenn weniger als 10% sichtbar -> zumachen
        if (!entry || entry.intersectionRatio >= 0.1) return;
        closeTransientUI();
      },
      { threshold: [0, 0.1] }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [closeTransientUI]);


  // 🔁 Likes (global)
  React.useEffect(() => {
    const onLike = (ev: Event) => {
      const ce = ev as CustomEvent<{ contentId: string; liked: boolean; delta: number; byViewer?: boolean }>;
      if (ce?.detail?.contentId !== c.id) return;

      if (ce.detail.byViewer) {
        // Nur den lokalen Status setzen (Tint) – KEINE Zähleränderung
        setLiked(!!ce.detail.liked);
        return;
      }
      // Fremde Events dürfen den Zähler verändern
      setLikes((n) => Math.max(0, n + (ce.detail.delta ?? 0)));
    };
    window.addEventListener('post:likeToggle', onLike as EventListener);
    return () => window.removeEventListener('post:likeToggle', onLike as EventListener);
  }, [c.id]);

  // 💬 Comments (global)
  React.useEffect(() => {
    const onComment = (ev: Event) => {
      const ce = ev as CustomEvent<{ contentId: string; delta: number; byViewer?: boolean }>;
      if (ce?.detail?.contentId !== c.id) return;

      if (ce.detail.byViewer) {
        // Nur „ich habe kommentiert“ merken – KEINE Zähleränderung
        setHasCommented(true);
        return;
      }
      setComments((n) => Math.max(0, n + (ce.detail.delta ?? 0)));
    };
    window.addEventListener('post:commentDelta', onComment as EventListener);
    return () => window.removeEventListener('post:commentDelta', onComment as EventListener);
  }, [c.id]);

  // 🔁 Reposts (global)
  React.useEffect(() => {
    const onRepost = (ev: Event) => {
      const ce = ev as CustomEvent<{ contentId: string; delta: number; byViewer?: boolean }>;
      if (ce?.detail?.contentId !== c.id) return;

      if (ce.detail.byViewer) {
        // Nur Aktiv-Status setzen – KEINE Zähleränderung
        setHasReposted(true);
        return;
      }
      setReposts((n) => Math.max(0, n + (ce.detail.delta ?? 0)));
    };
    window.addEventListener('post:repostDelta', onRepost as EventListener);
    return () => window.removeEventListener('post:repostDelta', onRepost as EventListener);
  }, [c.id]);


  // Bookmark-Events aus BookmarkButton (siehe Mini-Patch unten)
  React.useEffect(() => {
    function onBm(ev: Event) {
      const ce = ev as CustomEvent<{ postId: string; value: boolean }>;
      if (ce?.detail?.postId === c.id) {   // 👈 statt post.id
        setBookmarked(ce.detail.value);
        fireBookmarkPulse();
      }
    }
    window.addEventListener('bookmark:toggled', onBm as EventListener);
    return () => window.removeEventListener('bookmark:toggled', onBm as EventListener);
  }, [c.id, fireBookmarkPulse]); // 👈 dependency auch auf c.id

  React.useEffect(() => {
    function onPinnedChange(ev: Event) {
      const ce = ev as CustomEvent<{ postId: string; pinned: boolean }>;
      if (!ce.detail) return;
      const { postId, pinned } = ce.detail;
      if (postId === post.id) {
        setIsPinned(!!pinned);
      } else if (pinned) {
        setIsPinned(false);
      }
    }
    window.addEventListener('profile:pinnedChange', onPinnedChange);
    return () => window.removeEventListener('profile:pinnedChange', onPinnedChange);
  }, [post.id]);

  const isSmall = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
  useBodyLock(composerOpen && isSmall);

  React.useEffect(() => {
    if (typeof pinnedPostId === 'string') {
      setIsPinned(pinnedPostId === post.id);
    }
  }, [pinnedPostId, post.id]);

  const onProfileOfAuthor =
    typeof handle === 'string' &&
    handle.toLowerCase() === c.author.handle.toLowerCase();

  /* ---------- Actions ---------- */
  function LikeForm() {
    const action = liked ? unlikePostAction : likePostAction;
    const disabled = blockedByEither || pendingLike;
    return (
      <form
        data-no-nav
        action={action}
        onClick={(e) => e.stopPropagation()}
        onSubmit={() => {
          if (blockedByEither) return;
          const willLike = !liked; // 👈 definieren
          startLikeTransition(() => {
            setLiked((v) => !v);
            setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
          });
          fireLikePulse(); // ⬅️ NEU
          // 🛰️ global sync
          try {
            window.dispatchEvent(new CustomEvent('post:likeToggle', {
              detail: { contentId: c.id, liked: willLike, delta: willLike ? +1 : -1, byViewer: true }
            }));
          } catch {}

        }}
      >
        <input type="hidden" name="postId" value={c.id} />
        <button
          type="submit"
          disabled={disabled}
          className={`actify like ${liked ? 'is-active' : ''} ${likePulse ? 'do-pop' : ''} group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50`}
          aria-pressed={liked || undefined}
          aria-disabled={disabled || undefined}
          title={blockedByEither ? tPost('interactionBlocked') : undefined}
        >
          <span
            className="inline-grid place-items-center"
            style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }}
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-full h-full"
              style={{ color: liked ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}
            >
              <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
            </svg>
          </span>
          <Counter value={likes} active={liked} />
          <span className="sr-only">{liked ? tPost('unlike') : tPost('like')}</span>
        </button>
      </form>
    );
  }

  function PinIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 50 50"
      width={size}
      height={size}
      aria-hidden
      fill="currentColor"         // uses current text color
      focusable="false"
    >
      <path d="M 36.0625 0 C 35.125 0 34.140625 0.550781 33.40625 1.5 L 25.125 13.125 C 23.933594 
      12.84375 22.726563 12.71875 21.5 12.71875 C 17.289063 12.71875 13.320313 14.367188 10.34375 
      17.34375 C 10.15625 17.53125 10.0625 17.765625 10.0625 18.03125 C 10.0625 18.296875 10.15625 
      18.5625 10.34375 18.75 L 31.25 39.65625 C 31.445313 39.851563 31.679688 39.9375 31.9375 39.9375 
      C 32.195313 39.9375 32.460938 39.820313 32.65625 39.625 C 36.589844 35.695313 38.152344 30.023438 
      36.8125 24.65625 L 48.5 16.6875 C 49.375 16.035156 49.933594 15.140625 50 14.25 C 50.050781 13.597656 
      49.8125 12.972656 49.375 12.53125 L 37.625 0.625 C 37.222656 0.214844 36.660156 0 36.0625 0 Z M 16.53125 
      27.75 L 0.21875 48.375 C -0.0976563 48.773438 -0.078125 49.359375 0.28125 49.71875 C 0.476563 49.914063 
      0.742188 50 1 50 C 1.21875 50 1.441406 49.925781 1.625 49.78125 L 22.21875 33.46875 Z"></path>
    </svg>
  );
}




  function CommentButton() {
    const disabled = blockedByEither;
    const isActive = composerOpen || hasCommented;
    return (
      <button
        type="button"
        data-no-nav
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          // ⬇️ statt toggle:
          setComposerOpen(true);                         // immer öffnen
          fireCommentPulse();
          try { sessionStorage.setItem(`pc:commented:${c.id}`, '1'); } catch {}
          requestAnimationFrame(() => {
            try { window.dispatchEvent(new CustomEvent('composer:focus')); } catch {}
          });
        }}
        className={`actify comment ${isActive ? 'is-active' : ''} ${commentPulse ? 'do-pop' : ''} group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50`}
        aria-expanded={composerOpen || undefined}
        aria-disabled={disabled || undefined}
        title={disabled ? tPost('interactionBlocked') : undefined}
      >
        <span
          className="inline-grid place-items-center"
          style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"
            style={{ color: isActive ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}>
            <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
          </svg>
        </span>
        <Counter value={comments} active={isActive} />
        <span className="sr-only">{tPost('comment')}</span>
      </button>
    );
  }

  function RepostButton() {
    const disabled = blockedByEither || reposting;
    const btnRef = React.useRef<HTMLButtonElement>(null);

    const doRepost = React.useCallback(async (id: string) => {
      if (disabled) return;
      setRepostMenuOpen(false);
      setReposting(true);
      setReposts(n => n + 1);
      setHasReposted(true);
      fireRepostPulse();
      try {
        const resp = await fetch(`/api/posts/${id}/repost`, { method: 'POST' });
        const j = await resp.json().catch(() => null);
        if (!resp.ok || !j?.ok) throw new Error(j?.error || `HTTP ${resp.status}`);
        // Broadcasts
        try {
          window.dispatchEvent(new CustomEvent('post:reposted', { detail: { originalId: id, newId: j.id } }));
        } catch {}
        try {
          window.dispatchEvent(new CustomEvent('post:repostDelta', { detail: { contentId: id, delta: +1, byViewer: true } }));
        } catch {}
      } catch {
        setReposts(n => Math.max(0, n - 1));
        setHasReposted(false);
      } finally {
        setReposting(false);
      }
    }, [disabled]);

    return (
      <div ref={repostRef} data-no-nav onClick={(e) => e.stopPropagation()}>
        <button
          ref={btnRef}
          type="button"
          className={`actify repost ${hasReposted ? 'is-active' : ''} ${repostPulse ? 'do-pop' : ''} group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50`}
          onClick={() => !disabled && setRepostMenuOpen((v) => !v)}
          disabled={disabled}
          aria-expanded={repostMenuOpen || undefined}
          aria-disabled={disabled || undefined}
          title={disabled ? tPost('interactionBlocked') : undefined}
        >
          <span
            className="inline-grid place-items-center"
            style={{
              width: 'clamp(18px,1.8vw,26px)',
              height: 'clamp(18px,1.8vw,26px)',
              color: hasReposted ? 'var(--purple)' : 'rgba(255,255,255,.95)'
            }}
            aria-hidden
          >
            {hasReposted ? (
              <RepostIconFilled className="w-full h-full" />
            ) : (
              <RepostIconOutline className="w-full h-full" />
            )}
          </span>
          <Counter value={reposts} active={hasReposted} />
          <span className="sr-only">{tPost('repost')}</span>
        </button>
        

        <Popover
          anchorRef={btnRef}
          open={repostMenuOpen}
          onClose={() => setRepostMenuOpen(false)}
        >
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
            disabled={reposting}
            onClick={() => doRepost(c.id)}
          >
            {tPost('repost')}
          </button>
          <button
            type="button"
            className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
            onClick={() => { setRepostMenuOpen(false); setQuoteOpen(true); setHasReposted(true); fireRepostPulse(); }}
          >
            {tPost('quotePost')}
          </button>
        </Popover>
      </div>
    );
  }

  async function copyPostText() {
    try {
      await navigator.clipboard.writeText(c.text ?? '');
    } catch {}
  }

  function ShareButton() {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/p/${post.id}`
        : `/${locale}/p/${post.id}`;

    const brand = t('brand.name');

    const systemShare = async () => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: tPost('share.systemTitle', { name: c.author.displayName, brand }),
            text: tPost('share.systemText', { brand }),
            url,
          });
          setShareMenuOpen(false);
          return;
        }
      } catch {}
    };

    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } catch {}
    };

    return (
      <div ref={shareRef} className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
          onClick={() => {
            setShareMenuOpen((v) => !v);
            // wichtig: sicherstellen, dass das More-Menü zu ist
            setMoreOpen(false);
          }}
          aria-expanded={shareMenuOpen || undefined}
          title={tPost('share.title')}
        >
          <span
            className="inline-grid place-items-center"
            style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)', color: 'rgba(255,255,255,.95)' }}
            aria-hidden
          >
            <ShareIcon />
          </span>
          <span className="sr-only">{tPost('share.label')}</span>
        </button>

        {shareMenuOpen && (
          <div
            className="absolute right-0 z-30 mt-2 w-60 max-w-[min(90vw,16rem)] rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1"
            role="menu"
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10 flex items-center justify-between"
              onClick={() => {
                setShareMenuOpen(false);
                setDmShareOpen(true);
              }}
              title={tPost('share.shareInDm')}
            >
              {tPost('share.dm')}
              <span className="opacity-70 text-xs">→</span>
            </button>

            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={copyLink}
              title={tPost('share.copy')}
            >
              {copied ? tPost('share.copied') : tPost('share.copy')}
            </button>

            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={systemShare}
              title={tPost('share.system')}
            >
              {tPost('share.system')}
            </button>
          </div>
        )}
      </div>
    );
  }


  function MoreMenu() {
    const showPinControls = onProfileOfAuthor && !isRepost;
    const showReport = !isMine; // <-- eigenes Posting? Dann kein Report

    const optimisticBroadcast = (pinned: boolean) => {
      try {
        window.dispatchEvent(new CustomEvent('profile:pinnedChange', { detail: { postId: post.id, pinned } }));
      } catch {}
    };


  const [pinBusy, setPinBusy] = React.useState(false);
  async function togglePin(nextPinned: boolean) {
      if (pinBusy) return;
      setPinBusy(true);

      // Optimistisch updaten
      setIsPinned(nextPinned);
      optimisticBroadcast(nextPinned);
      setMoreOpen(false);

      try {
        const resp = await fetch(`/api/posts/${post.id}/pin`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pin: nextPinned }),
        });
        if (!resp.ok) {
          // rollback bei Fehler
          setIsPinned(!nextPinned);
          optimisticBroadcast(!nextPinned);
          const j = await resp.json().catch(() => null);
          throw new Error(j?.error || `HTTP ${resp.status}`);
        }
        router.refresh(); // UI sicher nachziehen
      } catch {
        toast.error('Konnte den Pin-Status nicht ändern.', 'Fehler');
      } finally {
        setPinBusy(false);
      }
    }

    return (
      <div ref={moreRef} className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          aria-label={tPost('more')}
          className="rounded p-1.5 hover:bg-white/5"
          onClick={() => {
            setMoreOpen((v) => !v);
            setShareMenuOpen(false); // Share-Menü schließen
          }}
          aria-expanded={moreOpen || undefined}
        >
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>

        {moreOpen && (
          <div
            className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1"
            role="menu"
          >
            {/* Pin / Unpin nur auf eigenem Profil */}
            {showPinControls && (
            <>
              {!isPinned ? (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
                  disabled={pinBusy}
                  onClick={() => togglePin(true)}
                >
                  {tPost('pinToProfile')}
                </button>
              ) : (
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
                  disabled={pinBusy}
                  onClick={() => togglePin(false)}
                >
                  {tPost('unpinFromProfile')}
                </button>
              )}
              <div className="h-px my-1 bg-white/10" />
            </>
          )}

            {/* Copy Text */}
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 rounded hover:bg-white/10"
              onClick={() => {
                copyPostText();
                setMoreOpen(false);
              }}
            >
              <span>{tPost('copyText')}</span>
            </button>

            {/* Block / Unblock */}
            {!hasBlockedAuthor ? (
              <form
                action={blockUserAction}
                onSubmit={() => {
                  setHasBlockedAuthor(true);
                  setMoreOpen(false);
                }}
              >
                <input type="hidden" name="blockedHandle" value={c.author.handle} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10">
                  {tPost('block')}
                </button>
              </form>
            ) : (
              <form
                action={unblockUserAction}
                onSubmit={() => {
                  setHasBlockedAuthor(false);
                  setMoreOpen(false);
                }}
              >
                <input type="hidden" name="blockedHandle" value={c.author.handle} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10">
                  {tPost('unblock')}
                </button>
              </form>
            )}

            {/* Report nur, wenn NICHT mein eigener Post */}
            {showReport && (
              <>
                <div className="h-px my-1 bg-white/10" />
                <form action={reportPostAction} onSubmit={() => setMoreOpen(false)}>
                  <input type="hidden" name="postId" value={c.id} />
                  <input type="hidden" name="reason" value="OTHER" />
                  <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                    {tPost('report')}
                  </button>
                </form>
              </>
            )}

            {/* Delete GANZ unten (nur eigene Posts) */}
            {isMine && (
              <>
                <div className="h-px my-1 bg-white/10" />
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-red-500/10 text-red-300"
                  title={tPost?.('delete.title') ?? 'Delete post'}
                  onClick={async () => {
                    setMoreOpen(false);
                    setConfirmDeleteOpen(true); // nur Dialog öffnen
                  }}
                >
                  {tPost?.('delete.button') ?? 'Delete post'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  }



  const RoleBadge = ({ role }: { role?: 'domme' | 'submissive' }) => {
    if (!role) return null;
    return (
      <span
        className="mt-1 text-[11px] leading-none px-2 py-1 rounded-full"
        style={{
          color: 'var(--purple)',
          background: 'rgba(139,92,246,.15)',
          border: '1px solid rgba(139,92,246,.25)',
        }}
      >
        {tPost(`role.${role}`)}
      </span>
    );
  };

  const mediaItems = React.useMemo(() => normalizeMediaFields(c) ?? [], [c]);

  if (deleted) return null;
  
  function QuoteBox() {
    // Hook-abhängige Werte zuerst (ohne Early-Return)
    const q = c.quote;
    const qMedia = React.useMemo(() => (q ? normalizeMediaFields(q) : []), [q]);

    // erst jetzt ggf. aussteigen
    if (!q) return null;

    const goQuote = (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if ('key' in e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
      }
      const root = e.currentTarget as HTMLElement;
      const barrier = (e.target as HTMLElement | null)?.closest('[data-no-nav]');
      if (barrier && barrier !== root) return;
      saveFeedReturnPoint();
      router.push(`/${locale}/p/${q.id}`);
    };

    return (
      <div
        data-no-nav
        role="button"
        tabIndex={0}
        onClick={goQuote}
        onKeyDown={goQuote}
        className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3 cursor-pointer hover:bg-white/[.06] focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
      >
        <div className="flex items-start gap-3">
          <div className="relative size-9 overflow-hidden rounded-full bg-white/10">
            <Image src={q.author.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm flex items-center gap-2">
              <span data-no-nav>
                <ProfileLink handle={q.author.handle} className="font-semibold truncate hover:underline">
                  {q.author.displayName}
                </ProfileLink>
              </span>
              <span className="opacity-70 truncate">@{q.author.handle}</span>
              <span className="opacity-50">· {timeAgoShort(q.createdAt, tTime)}</span>
            </div>
            <div className="mt-1 text-[0.95rem] whitespace-pre-wrap break-words">{q.text}</div>

            {qMedia.length === 1 && <SingleMedia m={qMedia[0]} />}
            {qMedia.length > 1 && (
              <>
                <MediaMosaic items={qMedia} />
                <MediaMosaicOverflow items={qMedia} />
                <MediaCarousel items={qMedia} />
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <>
    <article
      ref={rootRef}
      className="relative bg-card border border-sub rounded-app shadow-app p-3 md:p-5 cursor-pointer max-w-full overflow-x-hidden md:overflow-x-visible"
      onClick={goDetail}
      onKeyDown={onKeyActivate}
      role="button"
      tabIndex={0}
      aria-label={tPost('ariaOpen')}
    >
      {post.community && (
        <div className="mb-3 -mt-1 text-[12px] text-white/80">
          <Link
            href={`/${locale}/communities/${post.community.slug}`}
            className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-white/12 bg-white/[.04] hover:bg-white/[.08]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="opacity-90 font-medium">{tPost('communityPost')}</span>
            <span className="opacity-70">·</span>
            <span className="opacity-90">{post.community.name}</span>
          </Link>
        </div>
      )}

      {post.reposter && (
        <div className="mb-1 -mt-1 flex items-center gap-2 text-[12px] text-white/70">
          <span
            className="inline-grid place-items-center w-4 h-4 text-white"
            aria-hidden
          >
            <RepostIconOutline className="w-full h-full" />
          </span>
          <span>{tPost('repostedBy', { name: post.reposter.displayName })}</span>
        </div>
      )}

      <div
        className="absolute top-2 right-2 flex items-center gap-2"
        data-no-nav
        onClick={(e) => e.stopPropagation()}
      >
        {isPinned && !isRepost && (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-[var(--purple)]/30 bg-[var(--purple)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--purple)]"
            role="img"
            aria-label={tPost('pinned')}
            title={tPost('pinned')}
          >
            <PinIcon size={12} />
            <span className="hidden xs:inline sm:inline">{tPost('pinned')}</span>
          </span>
        )}
        <MoreMenu />
      </div>

      <section className="grid grid-cols-[3.2em_1fr] gap-x-3 gap-y-1 sm:gap-y-2">
        {/* Avatar + Rolle (linke Spalte) */}
        <div className="col-start-1 row-start-1 shrink-0 flex flex-col items-center">
          <div data-no-nav onClick={(e) => e.stopPropagation()}>
            <ProfileLink
              handle={c.author.handle}
              className="block focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded-full"
            >
              <div className="size-[3.2em] rounded-full overflow-hidden grid place-items-center bg-white/10 relative hover:opacity-90 transition">
                <Image
                  src={avatarSrc}
                  alt={`${c.author.displayName} avatar`}
                  fill
                  className="object-cover"
                  sizes="3.2em"
                  onError={() => setAvatarSrc(AVATAR_PH)}
                />
              </div>
            </ProfileLink>
          </div>
          <RoleBadge role={uiRole} />
        </div>

        {/* Name/Handle/Meta + Text (rechte Spalte) */}
        <div className="col-start-2 row-start-1 min-w-0">
          <div className="flex items-center flex-wrap">
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-1">
                <ProfileLink
                  handle={c.author.handle}
                  className="font-semibold leading-tight text-[0.95rem] md:text-[1rem] hover:underline"
                >
                  {c.author.displayName}
                </ProfileLink>

                {/* Badge direkt neben dem Namen; shrink-0 verhindert Wegtruncaten */}
                <UserBadges
                  role={uiRole ?? 'submissive'}
                  isPremium={isPremiumActive(c.author.premiumUntil)}
                  isFirstAdopter={!!c.author.isFirstAdopter}
                  size={16}
                  className="shrink-0 -ml-0.5 translate-y-[1px]"
                  premiumLabel={t('badges.verified')}
                  firstAdopterLabel={t('badges.firstAdopter')}
                />
              </div>
            </div>

            <span aria-hidden style={{ display: 'inline-block', width: 8 }} />
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <ProfileLink
                handle={c.author.handle}
                className="text-muted truncate text-xs md:text-[11px] hover:underline"
              >
                @{c.author.handle}
              </ProfileLink>
            </div>

            <BlockBadges
              hasBlockedAuthor={!!hasBlockedAuthor}
              blockedByAuthor={!!initialBlockedByAuthor}
              tPost={tPost}
            />
            <span className="text-muted mx-2 text-xs md:text-[13px]" aria-hidden>
              ·
            </span>
            <time
              className="text-muted whitespace-nowrap text-xs md:text-[13px]"
              dateTime={c.createdAt}
              title={c.createdAt}
            >
              {timeAgoShort(c.createdAt, tTime)}
            </time>
          </div>

          <div className="mt-0.5 leading-snug">
            <RichText text={c.text} locale={locale} validateMentions />
          </div>
        </div>

        {/* Medien – volle Breite NUR wenn vorhanden */}
        {mediaItems.length > 0 && (
          <div className="col-span-2">
            {!ageOk ? (
              <BlurredMediaGate items={mediaItems} onStartVeriff={startAgeVerification} />
            ) : mediaItems.length === 1 ? (
              <SingleMedia m={mediaItems[0]} priority onOpen={openMediaPage} index={0} />
            ) : (
              <>
                <MediaMosaic items={mediaItems} onOpen={openMediaPage} />
                <MediaMosaicOverflow items={mediaItems} onOpen={openMediaPage} />
                <MediaCarousel items={mediaItems} onOpen={openMediaPage} />
              </>
            )}
          </div>
        )}

        {/* Quote – volle Breite NUR wenn vorhanden */}
        {c.quote && (
          <div className="col-span-2">
            <QuoteBox />
          </div>
        )}

        {/* Action-Bar – volle Breite */}
        <div className="col-span-2">
          <div
            className="mt-1.5 sm:mt-2 flex items-center gap-3 sm:gap-4 flex-wrap"
            data-no-nav
            onClick={(e) => e.stopPropagation()}
          >
            {/* linke Gruppe */}
            <CommentButton />
            <RepostButton />
            <LikeForm />

            {/* rechte Gruppe: schiebt sich mit ml-auto ganz nach rechts */}
            <div className="ml-auto flex items-center gap-3 flex-nowrap">
              <div
                data-no-nav
                onClick={(e) => e.stopPropagation()}
                className={`actify bookmark ${bookmarked ? 'is-active' : ''} ${bookmarkPulse ? 'do-pop' : ''}`}
                title={bookmarked ? 'Bookmarked' : undefined}
              >
                <BookmarkButton
                  postId={c.id}
                  initiallyBookmarked={post.initiallyBookmarked === true}
                />
              </div>

              <ShareButton />
            </div>
          </div>

          {composerOpen && !blockedByEither && (
            <>
             {/* Einmal rendern – der Composer floatet auf Mobile selbst */}
              <div ref={composerRef} data-no-nav onClick={(e) => e.stopPropagation()}>
                <CommentComposer
                  postId={c.id}
                  autoFocus
                  onSuccess={() => {
                    setComments((n) => (n ?? 0) + 1); // jetzt passend zur ID
                    setComposerOpen(false);
                    setHasCommented(true);
                    fireCommentPulse();
                    window.dispatchEvent(new CustomEvent('post:commentDelta', { detail: { contentId: c.id, delta: +1, byViewer: true } }));
                    try { window.dispatchEvent(new CustomEvent('comment:created',    { detail: { postId: post.id } })); } catch {}
                  }}
                  onCancel={() => setComposerOpen(false)}
                />
              </div> 
            </>
          )}

          {composerOpen && blockedByEither && (
            <div className="mt-2 text-[12px] text-white/60">{tPost('cantInteract')}</div>
          )}
        </div>
      </section>


      {quoteOpen && (
        <QuoteOverlay
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          target={{
            id: c.id,
            text: c.text,
            createdAt: c.createdAt,
            author: {
              displayName: c.author.displayName,
              handle: c.author.handle,
              avatarUrl: c.author.avatarUrl ?? undefined,
            },
            // fürs Quote-Overlay nehmen wir das erste Medium als Preview (falls vorhanden)
            mediaUrl: mediaItems[0]?.url,
            mediaAlt: mediaItems[0]?.alt,
          }}
        />
      )}

      {dmShareOpen && (
        <DMShareOverlay
          open={dmShareOpen}
          onClose={() => setDmShareOpen(false)}
          postId={post.id}
          locale={locale}
        />
      )}
    </article>

    <ConfirmDialog
    open={confirmDeleteOpen}
    onClose={() => setConfirmDeleteOpen(false)}
    onConfirm={handleDelete}
    busy={deleting}
    destructive
    title={tPost?.('delete.title') ?? 'Delete post'}
    message={tPost?.('delete.confirm') ?? 'Delete this post for everyone? This also removes all its reposts.'}
    confirmLabel={tPost?.('delete.button') ?? 'Delete post'}
    cancelLabel={tPost('share.cancel')}
    />

      
    {/* ⬇️ ⬇️ NEU: globale Styles für aktive Buttons & Animation */}
    <style jsx global>{`
      /* Purple scale */
      :root {
        --purple-100: #c4b5fd;
        --purple-200: #b39dfd;
        --purple-300: #a78bfa;
        --purple-400: #8b5cf6;
        --purple-500: #7c3aed;
        --purple-600: #6d28d9;
      }

      /* Button-Activator: legt nur Optik oben drauf – bestehende Utility-Klassen bleiben! */
      .actify {
        position: relative;
        border-radius: 10px;
        transition: transform 120ms ease, opacity 220ms ease;
      }

      /* Pop/Burst-Animation */
      @keyframes actify-pop {
        0% { transform: scale(1); }
        40% { transform: scale(1.08); }
        100% { transform: scale(1); }
      }
      @keyframes actify-burst {
        0% { opacity: .9; transform: translate(-50%, -50%) scale(.6) rotate(0deg); }
        70% { opacity: .7; }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.25) rotate(25deg); }
      }
      .actify.do-pop {
        animation: actify-pop 380ms ease;
      }
      .actify.do-pop::after {
        content: '';
        position: absolute;
        left: 50%;
        top: 50%;
        width: 140%;
        height: 140%;
        pointer-events: none;
        background:
          radial-gradient(circle at 50% 0%, rgba(255,255,255,.9) 0 3px, transparent 4px) 50% 10% / 8px 8px no-repeat,
          radial-gradient(circle at 0% 50%, rgba(255,255,255,.9) 0 3px, transparent 4px) 10% 50% / 8px 8px no-repeat,
          radial-gradient(circle at 100% 50%, rgba(255,255,255,.9) 0 3px, transparent 4px) 90% 50% / 8px 8px no-repeat,
          radial-gradient(circle at 50% 100%, rgba(255,255,255,.9) 0 3px, transparent 4px) 50% 90% / 8px 8px no-repeat;
        animation: actify-burst 450ms ease forwards;
        z-index: 0;
      }
      /* sorgt dafür, dass Inhalt über dem ::after sitzt */
      .actify > * { position: relative; z-index: 1; }
    `}</style>
  </>
);
}
