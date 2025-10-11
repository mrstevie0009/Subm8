// src/components/HomeFeedClient.tsx
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import PostCard from '@/components/PostCard';
import type { FeedPost } from '@/components/PostCard';

type Props = {
  initialItems: FeedPost[];
};

// Shape, das /api/feed liefert
type ApiMedia = { url: string; alt?: string | null; kind: 'image' | 'video' | 'gif'; mime?: string | null };
type ApiPost = {
  id: string;
  text: string | null;
  mediaUrl: string | null;      // legacy
  mediaAlt: string | null;      // legacy
  uploaded?: ApiMedia[];        // neu
  createdAt: string;
  _count: { Like: number; Comment: number; reposts: number };
  author: {
    id: string; handle: string; displayName: string;
    role: 'DOMME' | 'SUBMISSIVE' | null;
    avatarUrl: string | null;
  };
  repostOf: null | {
    id: string; text: string;
    mediaUrl: string | null; mediaAlt: string | null;
    uploaded?: ApiMedia[];      // neu
    createdAt: string;
    author: {
      id: string; handle: string; displayName: string;
      role: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl: string | null;
    };
  };
  quoteOf: null | {
    id: string; text: string;
    mediaUrl: string | null; mediaAlt: string | null;
    uploaded?: ApiMedia[];      // neu
    createdAt: string;
    author: {
      id: string; handle: string; displayName: string;
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

// ---- Neu: Dedupe-Helper (stabil nach ID) ----
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

export default function HomeFeedClient({ initialItems }: Props) {
  const searchParams = useSearchParams();

  // Nur die relevanten Query-Keys für den Feed übernehmen
  const feedQuery = React.useMemo(() => {
    const sp = new URLSearchParams();
    const feed = searchParams.get('feed');
    const role = searchParams.get('role');
    if (feed) sp.set('feed', feed);
    if (role) sp.set('role', role);
    return sp.toString(); // z.B. "feed=following,top&role=dommes"
  }, [searchParams]);

  // Initial sofort deduplizieren (falls SSR schon Duplikate enthalten sollte)
  const [items, setItems] = React.useState<FeedPost[]>(() => dedupeById(initialItems));
  const [newCount, setNewCount] = React.useState(0);
  const [loadingNew, setLoadingNew] = React.useState(false);
  const [atTop, setAtTop] = React.useState(true);

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

  // Wenn Filter (URL-Query) wechselt → initiale Liste neu laden
  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const qs = feedQuery ? `?${feedQuery}` : '';
      const res = await fetch(`/api/feed${qs}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { posts: ApiPost[] };
      if (!cancelled) {
        const mapped = data.posts.map(mapApiPost);
        setItems(dedupeById(mapped));       // ← dedupe
        setNewCount(0);
        window.scrollTo({ top: 0 });
      }
    };
    load();
    return () => { cancelled = true; };
  }, [feedQuery]);

  // Polling: nur zählen – Filter mitgeben
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

  // Neue Posts laden – Filter mitgeben
  const loadNewPosts = React.useCallback(async () => {
    setLoadingNew(true);
    try {
      const sp = new URLSearchParams(feedQuery);
      sp.set('since', latestISO);
      const res = await fetch(`/api/feed?${sp.toString()}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = (await res.json()) as { posts: ApiPost[] };
      const mapped = data.posts.map(mapApiPost);

      setItems((prev) => dedupeById([...mapped, ...prev])); // ← dedupe beim Merge
      setNewCount(0);
    } finally {
      setLoadingNew(false);
    }
  }, [latestISO, feedQuery]);

  // Wenn oben & neue vorhanden → automatisch laden
  React.useEffect(() => {
    if (atTop && newCount > 0 && !loadingNew) void loadNewPosts();
  }, [atTop, newCount, loadingNew, loadNewPosts]);

  function handleClickNew() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { void loadNewPosts(); }, 150);
  }

  return (
    <>
      {/* Sentinel */}
      <div ref={topSentinelRef} style={{ height: 1 }} />

      {/* New-Posts Button */}
      <div
        className={`
          fixed left-1/2 -translate-x-1/2 z-[70]
          ${newCount > 0 && !atTop ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          transition-opacity duration-200
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
        {items.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </section>
    </>
  );
}
