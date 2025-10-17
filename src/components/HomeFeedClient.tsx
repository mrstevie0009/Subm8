'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import PostCard from '@/components/PostCard';
import type { FeedPost } from '@/components/PostCard';

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

  // Nur relevante Query-Keys übernehmen
  const feedQuery = React.useMemo(() => {
    const sp = new URLSearchParams();
    const feed = searchParams.get('feed');
    const role = searchParams.get('role');
    if (feed) sp.set('feed', feed);
    if (role) sp.set('role', role);
    return sp.toString();
  }, [searchParams]);

  // State
  const [items, setItems] = React.useState<FeedPost[]>(() => dedupeById(initialItems));
  const [firstLoading, setFirstLoading] = React.useState(items.length === 0);
  const [newCount, setNewCount] = React.useState(0);
  const [loadingNew, setLoadingNew] = React.useState(false);
  const [atTop, setAtTop] = React.useState(true);

  // Bottom-Infinite-Scroll
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [endReached, setEndReached] = React.useState(false);
  const bottomSentinelRef = React.useRef<HTMLDivElement | null>(null);

  const topSentinelRef = React.useRef<HTMLDivElement | null>(null);
  const [headerHeight, setHeaderHeight] = React.useState(64);
  const [buttonTop, setButtonTop] = React.useState(12);

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

  // Initial laden bei Filterwechsel
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const sp = new URLSearchParams(feedQuery);
      sp.set('limit', String(PAGE_SIZE));
      const qs = sp.toString() ? `?${sp.toString()}` : '';
      const res = await fetch(`/api/feed${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { posts: ApiPost[] };
      if (!cancelled) {
        const mapped = data.posts.map(mapApiPost);
        setItems(dedupeById(mapped));
        setNewCount(0);
        setEndReached(false);
        setFirstLoading(false);
        window.scrollTo({ top: 0 });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [feedQuery]);

  // Polling: nur zählen
  React.useEffect(() => {
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
  }, [latestISO, feedQuery]);

  // Neue Posts laden
  const loadNewPosts = React.useCallback(async () => {
    setLoadingNew(true);
    try {
      const sp = new URLSearchParams(feedQuery);
      sp.set('since', latestISO);
      const res = await fetch(`/api/feed?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = (await res.json()) as { posts: ApiPost[] };
      const mapped = data.posts.map(mapApiPost);

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

  // Bottom-Sentinel: automatisch mehr laden
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
            const mapped = data.posts.map(mapApiPost);

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

  function handleClickNew() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      void loadNewPosts();
    }, 150);
  }

  return (
    <>
      {/* Top-Sentinel fürs „am Anfang“-Erkennen */}
      <div ref={topSentinelRef} style={{ height: 1 }} />

      {/* New-Posts Button */}
      <div
        className={`
          fixed left-1/2 -translate-x-1/2 z-[70]
          ${newCount > 0 && !atTop ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          transition-opacity duration-300
        `}
        style={{ top: buttonTop }}
      >
        <button
          onClick={handleClickNew}
          disabled={loadingNew}
          className="px-4 h-9 rounded-full bg-[var(--purple)] text-white text-[13px] font-semibold shadow-[0_8px_30px_-12px_rgba(139,92,246,.9)] hover:opacity-95"
          aria-live="polite"
        >
          {loadingNew ? 'Loading…' : `${newCount} New ${newCount === 1 ? 'post' : 'posts'}`}
        </button>
      </div>

      {/* Feed */}
      <section className="grid gap-3">
        {firstLoading ? (
          <FeedSkeleton />
        ) : (
          items.map((post) => <PostCard key={post.id} post={post} />)
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
