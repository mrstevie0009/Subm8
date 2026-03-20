// src/components/HomeFeedClient.tsx
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import PostCard from '@/components/PostCard';
import type { FeedPost } from '@/components/PostCard';
import { AnimatePresence } from 'framer-motion';

// Lottie (dynamisch, um SSR-Probleme zu vermeiden)
import dynamic from 'next/dynamic';
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Deine Lottie-Datei
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

export default function HomeFeedClient({ initialItems }: Props) {
  const searchParams = useSearchParams();

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

  React.useEffect(() => {
    const handler = () => { void handleClickNew(); };
    window.addEventListener('home:refresh', handler as EventListener);
    return () => window.removeEventListener('home:refresh', handler as EventListener);
  }, [handleClickNew]);

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
            `${newCount} New ${newCount === 1 ? 'post' : 'posts'}`
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
    </>
  );
}
