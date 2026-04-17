// src/components/HomeFeedClient.tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import PostCard from '@/components/PostCard';
import type { FeedPost } from '@/components/PostCard';
import { AnimatePresence } from 'framer-motion';


import dynamic from 'next/dynamic';
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });


import heartPress from '@/lotties/Heart-press-lottie.json';



type Props = {
  initialItems: FeedPost[];
};

// Shape, das /api/feed liefert
type ApiMedia = {
  url: string;
  alt?: string | null;
  kind: 'image' | 'video' | 'gif';
  mime?: string | null;
};
type ApiPost = {
  id: string;
  text: string | null;
  mediaUrl: string | null; // legacy
  mediaAlt: string | null; // legacy
  uploaded?: ApiMedia[]; // neu
  createdAt: string;
  _count: { Like: number; Comment: number; reposts: number };
  author: {
    id: string;
    handle: string;
    displayName: string;
    role: 'DOMME' | 'SUBMISSIVE' | null;
    avatarUrl: string | null;
    premiumUntil?: string | null;
    isFirstAdopter?: boolean;
  };
  repostOf: null | {
    id: string;
    text: string;
    mediaUrl: string | null;
    mediaAlt: string | null;
    uploaded?: ApiMedia[];
    createdAt: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
      role: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl: string | null;
      premiumUntil?: string | null;
      isFirstAdopter?: boolean;
    };
  };
  quoteOf: null | {
    id: string;
    text: string;
    mediaUrl: string | null;
    mediaAlt: string | null;
    uploaded?: ApiMedia[];
    createdAt: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
      role: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl: string | null;
      premiumUntil?: string | null;
      isFirstAdopter?: boolean;
    };
  };
  viewer: {
    liked: boolean;
    bookmarked: boolean;
    hasBlockedAuthor: boolean;
    blockedByAuthor: boolean;
  };
  community?: { name: string; slug: string } | null;
};

type PostSnapshot = {
  likes?: number;
  liked?: boolean;
  comments?: number;
  reposts?: number;
  hasReposted?: boolean;
  bookmarked?: boolean;
};

function applyLocalSnapshot(p: FeedPost): FeedPost {
  if (typeof window === 'undefined') return p;
  try {
    const key = `ps:snap:${p.id}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return p;

    const snap = JSON.parse(raw) as PostSnapshot;

    const stats = {
      likes: snap.likes ?? p.stats?.likes ?? 0,
      comments: snap.comments ?? p.stats?.comments ?? 0,
      reposts: snap.reposts ?? p.stats?.reposts ?? 0,
    };

    const viewer = {
    ...p.viewer,
    liked: snap.liked ?? p.viewer?.liked,
    bookmarked: snap.bookmarked ?? p.viewer?.bookmarked,
    hasReposted: snap.hasReposted ?? p.viewer?.hasReposted,
    commented: snap.comments != null
      ? snap.comments > (p.stats?.comments ?? 0) || p.viewer?.commented
      : p.viewer?.commented,
  };

    return { ...p, stats, viewer };
  } catch {
    return p;
  }
}


const SCROLL_KEY_PREFIX = 'homefeed:scroll:';
const DATA_KEY_PREFIX = 'homefeed:data:';

function mapApiPost(p: ApiPost): FeedPost {
  const isRepost = !!p.repostOf;

  const content = isRepost
    ? {
        id: p.repostOf!.id,
        text: p.repostOf!.text,
        mediaUrl: p.repostOf!.mediaUrl,
        mediaAlt: p.repostOf!.mediaAlt,
        uploaded: p.repostOf!.uploaded ?? [],
        createdAt: p.repostOf!.createdAt,
        author: {
          id: p.repostOf!.author.id,
          handle: p.repostOf!.author.handle,
          displayName: p.repostOf!.author.displayName,
          role: p.repostOf!.author.role,
          avatarUrl: p.repostOf!.author.avatarUrl,
          premiumUntil: p.repostOf!.author.premiumUntil ?? null,
          isFirstAdopter: !!p.repostOf!.author.isFirstAdopter,
        },
        quote: null,
      }
    : {
        id: p.id,
        text: p.text ?? '',
        mediaUrl: p.mediaUrl,
        mediaAlt: p.mediaAlt,
        uploaded: p.uploaded ?? [],
        createdAt: p.createdAt,
        author: {
          id: p.author.id,
          handle: p.author.handle,
          displayName: p.author.displayName,
          role: p.author.role,
          avatarUrl: p.author.avatarUrl,
          premiumUntil: p.author.premiumUntil ?? null,
          isFirstAdopter: !!p.author.isFirstAdopter,
        },
        quote: p.quoteOf
          ? {
              id: p.quoteOf.id,
              text: p.quoteOf.text,
              mediaUrl: p.quoteOf.mediaUrl,
              mediaAlt: p.quoteOf.mediaAlt,
              uploaded: p.quoteOf.uploaded ?? [],
              createdAt: p.quoteOf.createdAt,
              author: {
                id: p.quoteOf.author.id,
                handle: p.quoteOf.author.handle,
                displayName: p.quoteOf.author.displayName,
                role: p.quoteOf.author.role,
                avatarUrl: p.quoteOf.author.avatarUrl,
                premiumUntil: p.quoteOf.author.premiumUntil ?? null,
                isFirstAdopter: !!p.quoteOf.author.isFirstAdopter,
              },
            }
          : null,
      };

  return {
    id: p.id,
    createdAtISO: p.createdAt,
    content,
    reposter: isRepost
      ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName }
      : null,
    stats: {
      comments: p._count.Comment ?? 0,
      reposts: p._count.reposts ?? 0,
      likes: p._count.Like ?? 0,
    },
    viewer: p.viewer,
    initiallyBookmarked: p.viewer.bookmarked,
    community: p.community ?? null,
  };
}

// Dedupe-Helper (stabil nach ID)
function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of arr) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

// Schöne Lade-Skeletons
function FeedSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-app border border-sub shadow-app p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-full bg-white/10 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
              <div className="mt-2 h-3 w-[90%] bg-white/10 rounded animate-pulse" />
              <div className="mt-2 h-3 w-[70%] bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function PencilSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16.862 3.487a2.1 2.1 0 1 1 2.97 2.97L9.75 16.54 6 17.5l.96-3.75 9.902-10.263Z" />
      <path d="M14.5 5.85l3.65 3.65" />
      <path d="M4.75 20.25h14.5" />
    </svg>
  );
}

function MessageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.26 0-2.45-.27-3.53-.75L3 21l1.75-5.97A8.46 8.46 0 0 1 4 11.5 8.5 8.5 0 1 1 21 11.5Z" />
    </svg>
  );
}

export default function HomeFeedClient({ initialItems }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('home.feedbackFab');

  const PAGE_SIZE = 12; // kleinere erste Ladung für schnellere Wahrnehmung
  const hasServerItems = initialItems.length > 0;

  // Nur relevante Query-Keys übernehmen
  const feedQuery = React.useMemo(() => {
    const sp = new URLSearchParams();
    const feed = searchParams.get('feed');
    const role = searchParams.get('role');
    const kinks = searchParams.get('kinks');
    if (feed) sp.set('feed', feed);
    if (role) sp.set('role', role);
    if (kinks) sp.set('kinks', kinks);
    return sp.toString();
  }, [searchParams]);

  const scrollKey = React.useMemo(
    () => `${SCROLL_KEY_PREFIX}${feedQuery || 'default'}`,
    [feedQuery]
  );
  const dataKey = React.useMemo(
    () => `${DATA_KEY_PREFIX}${feedQuery || 'default'}`,
    [feedQuery]
  );

  const prevFeedQueryRef = React.useRef<string | null>(null);
  const isBackForwardNav = React.useCallback(() => {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    return nav?.type === 'back_forward';
  }, []);

  // --- RESTORE SCROLL: bei Back/Forward ODER wenn es überhaupt eine gespeicherte Position gibt
  React.useEffect(() => {
    const saved = sessionStorage.getItem(scrollKey);
    const y = saved ? parseInt(saved, 10) : 0;

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const isBF = nav?.type === 'back_forward';

    if ((isBF || y > 0) && Number.isFinite(y)) {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    }
  }, [scrollKey]);

  // --- PERSIST SCROLL
  React.useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        sessionStorage.setItem(scrollKey, String(window.scrollY || 0));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      onScroll(); // letzte Position persistieren
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrollKey]);

  // --- STATE
  const [newCount, setNewCount] = React.useState(0);
  const [loadingNew, setLoadingNew] = React.useState(false);
  const [atTop, setAtTop] = React.useState(true);
  const [items, setItems] = React.useState<FeedPost[]>(() => dedupeById(initialItems));
  const [optimisticPosts, setOptimisticPosts] = React.useState<FeedPost[]>([]);
  const [firstLoading, setFirstLoading] = React.useState(items.length === 0);
  const [feedReady, setFeedReady] = React.useState(items.length > 0);
  const [fabOpen, setFabOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [feedbackText, setFeedbackText] = React.useState('');
  const [feedbackImage, setFeedbackImage] = React.useState<File | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = React.useState(false);
  const [feedbackError, setFeedbackError] = React.useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = React.useState(false);
  const [fabHiddenByScroll, setFabHiddenByScroll] = React.useState(false);
  

  // Bottom-Infinite-Scroll
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [endReached, setEndReached] = React.useState(false);
  const bottomSentinelRef = React.useRef<HTMLDivElement | null>(null);

  const topSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = React.useState(64);
  const [buttonTop, setButtonTop] = React.useState(12);
  React.useEffect(() => {
    // beim ersten Client-Mount alles mit lokalen Snapshots überschreiben
    setItems(prev => prev.map(applyLocalSnapshot));
  }, []);

  React.useEffect(() => {
    const header = document.getElementById('app-global-header');
    if (!header) return;

    const measure = () => {
      const rect = header.getBoundingClientRect();
      setHeaderHeight(rect.height || 64);
      setButtonTop(Math.max(8, Math.round(rect.bottom) + 8));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);

    const onScroll = () => measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, []);

  const latestISO = React.useMemo(
    () => items[0]?.createdAtISO ?? new Date(0).toISOString(),
    [items]
  );

  const oldestISO = React.useMemo(
    () => items[items.length - 1]?.createdAtISO ?? null,
    [items]
  );

  // Top-Erkennung
  React.useEffect(() => {
    const el = topSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setAtTop(entry.isIntersecting),
      { rootMargin: `${-headerHeight}px 0px 0px 0px`, threshold: 1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [headerHeight]);

  // --- REHYDRATE ITEMS SOFORT aus SessionStorage (verhindert "Sprung nach oben")
  React.useEffect(() => {
    if (hasServerItems) return;

    const raw = sessionStorage.getItem(dataKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { items: FeedPost[] };
        if (Array.isArray(parsed.items) && parsed.items.length) {
          setItems(parsed.items.map(applyLocalSnapshot));
          setFirstLoading(false);
          setFeedReady(true);
        }
      } catch {}
    }
  }, [dataKey, hasServerItems]);

  // --- PERSIST ITEMS in SessionStorage
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      try {
        sessionStorage.setItem(dataKey, JSON.stringify({ items }));
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, [items, dataKey]);

  // --- INITIAL LADEN / bei Filterwechsel
  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const prev = prevFeedQueryRef.current;
      const firstMount = prev === null;

      if (firstMount && hasServerItems) {
        // wir sind bereits "ready"
        setFirstLoading(false);
        setFeedReady(true);
        prevFeedQueryRef.current = feedQuery;
        return;
      }
      const sp = new URLSearchParams(feedQuery);
      sp.set('limit', String(PAGE_SIZE));
      const qs = sp.toString() ? `?${sp.toString()}` : '';
      const res = await fetch(`/api/feed${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { posts: ApiPost[] };

      if (!cancelled) {
        const mapped = data.posts.map(mapApiPost).map(applyLocalSnapshot);
        setItems(dedupeById(mapped));
        setNewCount(0);
        setEndReached(false);
        setFirstLoading(false);

        setFeedReady(true);

        const prev = prevFeedQueryRef.current;
        const changed = prev !== null && prev !== feedQuery;
        if (changed && !isBackForwardNav()) {
          window.scrollTo({ top: 0 });
        }
        prevFeedQueryRef.current = feedQuery;
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [feedQuery, PAGE_SIZE, isBackForwardNav, hasServerItems]);

  // --- Polling: nur zählen
  React.useEffect(() => {
    if (!feedReady) return;
    if (!items.length) return;

    let active = true;
    const tick = async () => {
      try {
        const sp = new URLSearchParams(feedQuery);
        sp.set('since', latestISO);
        sp.set('onlyCount', '1');
        const res = await fetch(`/api/feed?${sp.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { count: number };
        if (active) setNewCount(data.count ?? 0);
      } catch {}
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [feedReady, items.length, latestISO, feedQuery]);

  // --- Neue Posts laden
  const loadNewPosts = React.useCallback(async () => {
    setLoadingNew(true);
    try {
      const sp = new URLSearchParams(feedQuery);
      sp.set('since', latestISO);
      const res = await fetch(`/api/feed?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = (await res.json()) as { posts: ApiPost[] };
      const mapped = data.posts.map(mapApiPost).map(applyLocalSnapshot);

      setItems((prev) => dedupeById([...mapped, ...prev]));
      setNewCount(0);
    } finally {
      setLoadingNew(false);
    }
  }, [latestISO, feedQuery]);

  // Wenn oben & neue vorhanden → automatisch laden
  React.useEffect(() => {
    if (atTop && newCount > 0 && !loadingNew) void loadNewPosts();
  }, [atTop, newCount, loadingNew, loadNewPosts]);

  // --- Bottom-Sentinel: automatisch mehr laden
  React.useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      async ([entry]) => {
        if (entry.isIntersecting && !loadingMore && !endReached && oldestISO) {
          setLoadingMore(true);
          try {
            const sp = new URLSearchParams(feedQuery);
            sp.set('before', oldestISO);
            sp.set('limit', String(20)); // Nachläufe ruhig größer
            const res = await fetch(`/api/feed?${sp.toString()}`, { cache: 'no-store' });
            if (!res.ok) return;
            const data = (await res.json()) as { posts: ApiPost[] };
            const mapped = data.posts.map(mapApiPost).map(applyLocalSnapshot);

            if (mapped.length === 0) {
              setEndReached(true);
            } else {
              setItems((prev) => dedupeById([...prev, ...mapped]));
            }
          } finally {
            setLoadingMore(false);
          }
        }
      },
      { rootMargin: '128px 0px 256px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feedQuery, loadingMore, endReached, oldestISO]);

  function smoothScrollToTop(duration = 350) {
    return new Promise<void>((resolve) => {
      const startY = window.scrollY || window.pageYOffset || 0;
      if (startY <= 0) return resolve();

      const start = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      function step(now: number) {
        const t = Math.min(1, (now - start) / duration);
        const eased = easeOutCubic(t);
        const y = Math.round(startY * (1 - eased));
        window.scrollTo(0, y);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }

      requestAnimationFrame(step);
    });
  }

  const handleClickNew = React.useCallback(async () => {
    // 1) Sanft nach oben (schneller, aber nicht „teleport“)
    await smoothScrollToTop(380);

    // 2) Neue Posts laden (zeigt dein lila Button als Spinner)
    await loadNewPosts();

    // 3) Nach Commit minimal „nachziehen“, wieder smooth aber sehr kurz
    requestAnimationFrame(() => {
      void smoothScrollToTop(160);
    });
  }, [loadNewPosts]);

  const openCompose = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams.toString());
    sp.set('compose', '1');
    router.push(`${pathname}?${sp.toString()}`, { scroll: false });
    setFabOpen(false);
  }, [pathname, router, searchParams]);

  const openFeedback = React.useCallback(() => {
    setFabOpen(false);
    setFeedbackError(null);
    setFeedbackSuccess(false);
    setFeedbackOpen(true);
  }, []);

  const submitFeedback = React.useCallback(async () => {
    const text = feedbackText.trim();
    if (!text && !feedbackImage) {
      setFeedbackError(t('errorEmpty'));
      return;
    }

    setFeedbackSubmitting(true);
    setFeedbackError(null);

    try {
      const fd = new FormData();
      fd.append('text', text);
      if (feedbackImage) fd.append('image', feedbackImage);

      const res = await fetch('/api/feedback', {
        method: 'POST',
        body: fd,
      });

      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || t('errorSubmit'));
      }

      setFeedbackText('');
      setFeedbackImage(null);
      setFeedbackSuccess(true);

      window.setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackSuccess(false);
      }, 1600);
    } catch (err) {
      setFeedbackError(err instanceof Error ? err.message : t('errorSubmit'));
    } finally {
      setFeedbackSubmitting(false);
    }
  }, [feedbackText, feedbackImage, t]);

  React.useEffect(() => {
    const handler = () => { void handleClickNew(); };
    window.addEventListener('home:refresh', handler as EventListener);
    return () => window.removeEventListener('home:refresh', handler as EventListener);
  }, [handleClickNew]);

  React.useEffect(() => {
    if (!fabOpen && !feedbackOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (feedbackOpen) setFeedbackOpen(false);
      else setFabOpen(false);
    };

    const prev = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [fabOpen, feedbackOpen]);

  React.useEffect(() => {
    if (fabOpen || feedbackOpen) {
      setFabHiddenByScroll(false);
      return;
    }

    let raf = 0;
    let lastY = window.scrollY || 0;

    const onScroll = () => {
      if (raf) return;

      raf = requestAnimationFrame(() => {
        raf = 0;

        const y = window.scrollY || 0;
        const delta = y - lastY;

        // ganz oben -> immer zeigen
        if (y < 24) {
          setFabHiddenByScroll(false);
          lastY = y;
          return;
        }

        // kleine Mikrobewegungen ignorieren
        if (Math.abs(delta) < 8) return;

        if (delta > 0) {
          // runter
          setFabHiddenByScroll(true);
        } else {
          // rauf
          setFabHiddenByScroll(false);
        }

        lastY = y;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [fabOpen, feedbackOpen]);

  // Optimistic Post Creation
  React.useEffect(() => {
    const handleOptimistic = (ev: Event) => {
      const ce = ev as CustomEvent<{ post: FeedPost; tempId: string }>;
      if (!ce.detail) return;
      
      setOptimisticPosts(prev => [ce.detail.post, ...prev]);
      
      // Remove after successful creation
      setTimeout(() => {
        setOptimisticPosts(prev => prev.filter(p => p.id !== ce.detail.tempId));
      }, 500);
    };

    window.addEventListener('post:optimistic', handleOptimistic);
    return () => window.removeEventListener('post:optimistic', handleOptimistic);
  }, []);

  const fabVisible = fabOpen || feedbackOpen || !fabHiddenByScroll;

  return (
    <>
      {/* Top-Sentinel fürs „am Anfang“-Erkennen */}
      <div ref={topSentinelRef} style={{ height: 1 }} />

      {/* New-Posts Button */}
      <div
        className={`
          fixed left-1/2 -translate-x-1/2 z-[70]
          ${(feedReady && (loadingNew || (newCount > 0 && !atTop)))
            ? 'opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'}
          transition-opacity duration-300
        `}
        style={{ top: buttonTop }}
      >
        <button
          onClick={handleClickNew}
          disabled={loadingNew}
          className={[
            'relative rounded-full overflow-visible hover:scale-105 transition-transform',
            loadingNew
              ? 'w-20 h-20 bg-transparent'           // ⬅ feste 80×80 px Fläche wenn Loading
              : 'px-4 h-9 bg-[var(--purple)] text-white'
          ].join(' ')}
          aria-live="polite"
        >
          {loadingNew ? (
            <div
              className="absolute inset-0 grid place-items-center"
              aria-label="Loading"
              role="status"
            >
              {/* Host-Box, damit die Animation sicher Platz hat (80×80 vom Button) */}
              <div className="w-full h-full">
                <Lottie
                  animationData={heartPress}
                  loop
                  autoplay
                  style={{
                    width: '75%',
                    height: '75%',
                    filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.18))',
                  }}
                />
              </div>
            </div>
          ) : (
            newCount === 1
              ? t('newPosts_one', { count: newCount })
              : t('newPosts_other', { count: newCount })
          )}
        </button>
      </div>

      {/* Feed */}
      <section className="grid gap-3">
        {firstLoading ? (
          <FeedSkeleton />
        ) : (
          <AnimatePresence mode="popLayout">
            {optimisticPosts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </AnimatePresence>
        )}

        {/* Bottom-Sentinel + hübscher Mini-Skeleton statt nur Spinner */}
        {!endReached && (
          <div ref={bottomSentinelRef} className="flex justify-center py-6 w-full">
            {loadingMore ? (
              <div className="w-full grid gap-3">
                <div className="rounded-app border border-sub shadow-app p-4">
                  <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
                  <div className="mt-2 h-3 w-[85%] bg-white/10 rounded animate-pulse" />
                </div>
                <div className="rounded-app border border-sub shadow-app p-4">
                  <div className="h-3 w-56 bg-white/10 rounded animate-pulse" />
                  <div className="mt-2 h-3 w-[70%] bg-white/10 rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <div className="h-5" />
            )}
          </div>
        )}

        {/* Ende-Hinweis */}
        {endReached && (
          <div className="text-center text-sm opacity-60 py-6">Keine weiteren Posts.</div>
        )}
      </section>

      {feedbackOpen && (
        <>
          <button
            type="button"
            aria-label={t('closeFeedbackModalAria')}
            onClick={() => setFeedbackOpen(false)}
            className="fixed inset-0 z-[94] bg-black/60"
          />

          <div className="fixed inset-0 z-[95] overflow-y-auto overscroll-contain no-scrollbar">
            <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
              <div className="w-full max-w-md max-h-[calc(100dvh-2rem)] rounded-[24px] border border-white/10 bg-black shadow-2xl overflow-hidden">
              <div className="px-4 py-4 border-b border-white/10">
                <div className="text-white text-lg font-semibold">{t('modalTitle')}</div>
                <div className="text-white/60 text-sm mt-1">
                  {t('modalDescription')}
                </div>
              </div>

              <div className="p-4 grid gap-4 overflow-y-auto max-h-[calc(100dvh-9rem)] no-scrollbar">
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder={t('textareaPlaceholder')}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-white/35 outline-none resize-none focus:border-[var(--purple)]"
                />

                <label className="block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setFeedbackImage(file);
                    }}
                  />
                  <span className="inline-flex h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 text-sm text-white cursor-pointer hover:bg-white/8">
                    {feedbackImage
                      ? t('attachedImage', { name: feedbackImage.name })
                      : t('attachImage')}
                  </span>
                </label>

                {feedbackError && (
                  <div className="text-sm text-red-400">{feedbackError}</div>
                )}

                {feedbackSuccess && (
                  <div className="rounded-2xl border border-green-400/20 bg-green-500/10 px-4 py-3">
                    <div className="text-sm font-medium text-green-200">
                      {t('successTitle')}
                    </div>
                    <div className="mt-1 text-xs text-green-200/80">
                      {t('successText')}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setFeedbackOpen(false)}
                    disabled={feedbackSubmitting}
                    className="h-11 px-4 rounded-full border border-white/10 text-white hover:bg-white/5 disabled:opacity-60"
                  >
                    {t('cancel')}
                  </button>

                  <button
                    type="button"
                    onClick={submitFeedback}
                    disabled={feedbackSubmitting || feedbackSuccess}
                    className="h-11 px-5 rounded-full bg-[var(--purple)] text-white disabled:opacity-60"
                  >
                    {feedbackSubmitting ? t('sending') : t('send')}
                  </button>
                </div>
              </div>
            </div>
            </div>
          </div>
        </>
      )}

      {/* FAB Backdrop */}
      {fabOpen && !feedbackOpen && (
        <button
          type="button"
          aria-label="Close actions"
          onClick={() => setFabOpen(false)}
          className="fixed inset-0 z-[88] bg-black/35"
        />
      )}

      {/* FAB Actions */}
      <div
        className={[
          'fixed right-4 z-[90] flex flex-col items-end gap-3',
          'transition-all duration-300 ease-out will-change-transform',
          fabVisible
            ? 'translate-y-0 opacity-100 scale-100'
            : 'translate-y-8 opacity-0 scale-90 pointer-events-none',
        ].join(' ')}
        style={{ bottom: 'calc(76px + env(safe-area-inset-bottom))' }}
      >
        <div
          className={[
            'flex flex-col items-end gap-3 transition-all duration-200',
            fabOpen
              ? 'opacity-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 translate-y-2 pointer-events-none',
          ].join(' ')}
        >
          <button
            type="button"
            onClick={openFeedback}
            className="flex items-center gap-3 rounded-full bg-black text-white shadow-xl border border-white/10 px-4 h-12"
          >
            <span className="text-sm font-medium">{t('feedback')}</span>
            <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--purple)] text-white">
              <MessageIcon className="w-5 h-5" />
            </span>
          </button>

          <button
            type="button"
            onClick={openCompose}
            className="flex items-center gap-3 rounded-full bg-black text-white shadow-xl border border-white/10 px-4 h-12"
          >
            <span className="text-sm font-medium">{t('post')}</span>
            <span className="grid place-items-center w-10 h-10 rounded-full bg-[var(--purple)] text-white">
              <PencilSquareIcon className="w-5 h-5" />
            </span>
          </button>
        </div>

        <button
          type="button"
          aria-label={fabOpen ? t('closeActionsAria') : t('openActionsAria')}
          onClick={() => setFabOpen((v) => !v)}
          className={[
            'grid place-items-center w-16 h-16 rounded-full shadow-2xl',
            'bg-[var(--purple)] text-white transition-all duration-300 ease-out',
            fabOpen ? 'rotate-45 scale-95' : 'rotate-0 scale-100',
          ].join(' ')}
        >
          <PlusIcon className="w-7 h-7" />
        </button>
      </div>
    </>
  );
}
