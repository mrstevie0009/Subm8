'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import VideoPlayer from '@/components/VideoPlayer';
import { toast } from '@/lib/toast';
import MediaDetailHeader from '@/components/MediaDetailHeader';
import Image from 'next/image';
import PostActionsBar from '@/components/PostActionsBar';

// ——— Helpers ———
type ContentMedia = { url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif' };

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

type MediaContainer = {
  media?: ContentMedia[] | null;
  uploaded?: ContentMedia[] | null;
  mediaUrls?: string[] | null;
  attachments?: Array<{ url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif' }> | null;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
};

function normalizeMediaFields(src: MediaContainer): ContentMedia[] {
  const out: ContentMedia[] = [];
  const pushArr = (arr?: ContentMedia[] | null) => {
    if (!Array.isArray(arr)) return;
    for (const m of arr) {
      if (m?.url) out.push({ url: m.url, alt: m.alt ?? null, kind: m.kind ?? kindFromUrl(m.url) });
    }
  };
  pushArr(src.media);
  pushArr(src.uploaded);
  if (Array.isArray(src.attachments)) {
    for (const m of src.attachments) if (m?.url) out.push({ url: m.url, alt: m.alt ?? null, kind: m.kind ?? kindFromUrl(m.url) });
  }
  if (Array.isArray(src.mediaUrls)) {
    for (const url of src.mediaUrls) if (url) out.push({ url, alt: null, kind: kindFromUrl(url) });
  }
  if (src.mediaUrl) {
    out.push({ url: src.mediaUrl, alt: src.mediaAlt ?? null, kind: kindFromUrl(src.mediaUrl) });
  }
  const seen = new Set<string>();
  return out.filter(m => (seen.has(m.url) ? false : (seen.add(m.url), true)));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function getProp<T = unknown>(obj: unknown, key: string): T | undefined {
  if (!isObj(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return val as T | undefined;
}
function pickPreviewPayload(input: unknown): MediaContainer {
  const tryPaths = [
    ['content'],
    ['item', 'content'],
    ['post', 'content'],
    ['data', 'content'],
    ['item'],
    ['post'],
    ['data'],
  ];

  for (const path of tryPaths) {
    let cur: unknown = input;
    let ok = true;
    for (const k of path) {
      cur = getProp(cur, k);
      if (cur === undefined) { ok = false; break; }
    }
    if (ok && isObj(cur)) {
      return cur as MediaContainer;
    }
  }
  return isObj(input) ? (input as MediaContainer) : {};
}

// ——— Gate ———
function BlurredGate({ onStartVeriff }: { onStartVeriff: () => void | Promise<void> }) {
  const tVerify = useTranslations('verify');
  return (
    <div className="min-h-[100svh] grid place-items-center p-6 bg-black text-white">
      <div className="text-center max-w-[520px] rounded-2xl border border-white/15 bg-black/70 backdrop-blur p-6">
        <div className="text-base font-semibold">{tVerify('overlay.heading')}</div>
        <div className="mt-2 text-sm text-white/80">{tVerify('overlay.body')}</div>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--purple)] px-4 py-2 text-white hover:opacity-95"
          onClick={() => void onStartVeriff()}
        >
          {tVerify('overlay.cta')}
        </button>
        <div className="mt-2 text-[11px] text-white/60">{tVerify('overlay.note')}</div>
      </div>
    </div>
  );
}

export default function PostMediaPage() {
  const router = useRouter();
  const params = useParams() as { locale: string; id: string };
  const { locale, id } = params;
  const search = useSearchParams();
  const startIdx = Math.max(0, parseInt(search.get('i') || '0', 10) || 0);
  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;

  const [snapStats, setSnapStats] = React.useState<{ likes?: number; comments?: number; reposts?: number }>();
  const [snapViewer, setSnapViewer] = React.useState<{ liked?: boolean; bookmarked?: boolean; reposted?: boolean }>();
  const [uiVisible, setUiVisible] = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(startIdx);

  const [items, setItems] = React.useState<ContentMedia[] | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const touchStartY = React.useRef<number>(0);
  const isScrolling = React.useRef(false);

  // Snapshot laden
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`ps:snap:${id}`);
      if (raw) {
        const s = JSON.parse(raw) as {
          likes?: number; comments?: number; reposts?: number;
          liked?: boolean; bookmarked?: boolean; hasReposted?: boolean;
        };
        setSnapStats({ likes: s.likes, comments: s.comments, reposts: s.reposts });
        setSnapViewer({ liked: s.liked, bookmarked: s.bookmarked, reposted: s.hasReposted });
      }
    } catch {}
  }, [id]);

  // Medien aus sessionStorage laden
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`pm:${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { v?: number; at?: number; items?: ContentMedia[] };
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(parsed.items);
      }
    } catch {}
  }, [id]);

  // Fallback: API fetch
  React.useEffect(() => {
    if (Array.isArray(items) && items.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/preview/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const j: unknown = await res.json().catch(() => null);
        if (!res.ok || !j) throw new Error('Bad response');

        const media = normalizeMediaFields(pickPreviewPayload(j));
        if (!cancelled) {
          if (!Array.isArray(media) || media.length === 0) {
            setItems([]);
            toast.error('Keine Medien im Post gefunden.', 'Keine Medien');
            return;
          }
          setItems(media);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          toast.error('Konnte Medien nicht laden.', 'Fehler');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [id, items]);

  // Intersection Observer für aktuellen Index
  React.useEffect(() => {
    if (!items || items.length === 0 || !containerRef.current) return;

    const options = {
      root: containerRef.current,
      threshold: 0.5,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.getAttribute('data-index') || '0', 10);
          setCurrentIndex(idx);
        }
      });
    }, options);

    const figures = containerRef.current.querySelectorAll('[data-index]');
    figures.forEach((fig) => observerRef.current?.observe(fig));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [items]);

  // Touch-Gesten für Swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isScrolling.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartY.current) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    if (Math.abs(deltaY) > 10) {
      isScrolling.current = true;
    }
  };

  const handleTouchEnd = () => {
    touchStartY.current = 0;
    isScrolling.current = false;
  };

  // Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!items || items.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIdx = Math.min(currentIndex + 1, items.length - 1);
        scrollToIndex(nextIdx);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIdx = Math.max(currentIndex - 1, 0);
        scrollToIndex(prevIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, currentIndex]);

  const scrollToIndex = (idx: number) => {
    if (!containerRef.current) return;
    const figures = containerRef.current.querySelectorAll('[data-index]');
    const target = figures[idx] as HTMLElement | undefined;
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const startAgeVerification = React.useCallback(async () => {
    try {
      const back = `/${locale}/p/${id}/media?i=${currentIndex}`;
      if (!session) {
        router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }
      const res = await fetch(`/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`, { method: 'POST' });
      const j: unknown = await res.json().catch(() => null);
      const url = isObj(j) ? (j['url'] as string | undefined) : undefined;
      if (!res.ok || !url) throw new Error('veriff start failed');
      router.push(url);
    } catch {
      toast.error('Die Verifikation konnte nicht gestartet werden.', 'Fehler');
    }
  }, [id, locale, router, session, currentIndex]);

  // Content
  let content: React.ReactNode;

  if (!ageOk) {
    content = <BlurredGate onStartVeriff={startAgeVerification} />;
  } else if (!items) {
    content = (
      <div className="flex-1 grid place-items-center text-white/70 bg-black">
        Lade Medien…
      </div>
    );
  } else if (items.length === 0) {
    content = (
      <div className="flex-1 grid place-items-center text-white/70 bg-black">
        Keine Medien gefunden.
      </div>
    );
  } else {
    content = (
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto snap-y snap-mandatory bg-black"
        style={{ 
          WebkitOverflowScrolling: 'touch', 
          overscrollBehaviorY: 'contain',
          scrollBehavior: 'smooth'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {items.map((m, i) => {
          const isGif = m.kind === 'gif';
          const isVideoLike = m.kind === 'video' || isGif;

          return (
            <figure
              key={`${m.url}-${i}`}
              data-index={i}
              className="relative snap-center snap-always grid place-items-center"
              style={{ 
                minHeight: '100svh',
                scrollSnapStop: 'always'
              }}
              onClick={() => setUiVisible(v => !v)}
            >
              {isVideoLike ? (
                <VideoPlayer
                  src={m.url}
                  className="max-h-[100svh] max-w-[100vw] w-auto h-auto"
                  autoPlay={i === currentIndex}
                  muted
                  loop
                  showScrubber={uiVisible}
                  rightTag={isGif ? 'GIF' : undefined}
                  clickToToggle
                />
              ) : (
                <Image
                  src={m.url}
                  alt={m.alt ?? ''}
                  width={1920}
                  height={1080}
                  className="max-h-[100svh] max-w-[100vw] w-auto h-auto object-contain select-none"
                  unoptimized
                  priority={i === startIdx}
                />
              )}

              {/* Index Pill */}
              {items.length > 1 && (
                <div className={`absolute right-4 top-20 z-20 transition-opacity duration-300 ${uiVisible ? 'opacity-95' : 'opacity-0 pointer-events-none'}`}>
                  <span className="rounded-full bg-black/70 border border-white/20 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
                    {i + 1}/{items.length}
                  </span>
                </div>
              )}

              {/* Gradients */}
              <div className={`pointer-events-none absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`} />
              <div className={`pointer-events-none absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`} />
            </figure>
          );
        })}
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-black text-white flex flex-col overflow-hidden">
      <MediaDetailHeader fixed transparentOnHide={!uiVisible} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {content}
        
        {ageOk && items && items.length > 0 && (
          <PostActionsBar
            postId={id}
            stats={snapStats}
            viewer={snapViewer}
            onCommentClick={() => router.push(`/${locale}/p/${id}`)}
            transparentOnHide={!uiVisible}
          />
        )}
      </div>
    </div>
  );
}