'use client';

import * as React from 'react';
import PostCard from '@/components/PostCard';
import type { FeedPost } from '@/components/PostCard';

type Props = {
  initialItems: FeedPost[];
};

// Shape, das /api/feed liefert
type ApiPost = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  _count: { Like: number; Comment: number; reposts: number };
  author: {
    id: string; handle: string; displayName: string;
    role: 'DOMME' | 'SUBMISSIVE' | null;
    avatarUrl: string | null;
  };
  repostOf: null | {
    id: string; text: string;
    mediaUrl: string | null; mediaAlt: string | null; createdAt: string;
    author: {
      id: string; handle: string; displayName: string;
      role: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl: string | null;
    };
  };
  quoteOf: null | {
    id: string; text: string;
    mediaUrl: string | null; mediaAlt: string | null; createdAt: string;
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
  // ← NEU
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
        createdAt: p.repostOf!.createdAt,
        author: {
          id: p.repostOf!.author.id,
          handle: p.repostOf!.author.handle,
          displayName: p.repostOf!.author.displayName,
          role: p.repostOf!.author.role,
          avatarUrl: p.repostOf!.author.avatarUrl,
        },
        // bei Repost gibt es kein content.quote
        quote: null,
      }
    : {
        id: p.id,
        text: p.text ?? '',
        mediaUrl: p.mediaUrl,
        mediaAlt: p.mediaAlt,
        createdAt: p.createdAt,
        author: {
          id: p.author.id,
          handle: p.author.handle,
          displayName: p.author.displayName,
          role: p.author.role,
          avatarUrl: p.author.avatarUrl,
        },
        // Quote-Box (optional)
        quote: p.quoteOf
          ? {
              id: p.quoteOf.id,
              text: p.quoteOf.text,
              mediaUrl: p.quoteOf.mediaUrl,
              mediaAlt: p.quoteOf.mediaAlt,
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
    reposter: isRepost ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName } : null,
    stats: {
      comments: p._count.Comment ?? 0,
      reposts: p._count.reposts ?? 0,
      likes: p._count.Like ?? 0,
    },
    viewer: p.viewer,
    initiallyBookmarked: p.viewer.bookmarked,
    // ← NEU
    community: p.community ?? null,
  };
}

export default function HomeFeedClient({ initialItems }: Props) {
  const [items, setItems] = React.useState<FeedPost[]>(initialItems);
  const [newCount, setNewCount] = React.useState(0);
  const [loadingNew, setLoadingNew] = React.useState(false);
  const [atTop, setAtTop] = React.useState(true);

  const topSentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Headerhöhe + Button-Position
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

  // Polling: nur zählen
  React.useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(`/api/feed?since=${encodeURIComponent(latestISO)}&onlyCount=1`, { cache: 'no-store' });
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
  }, [latestISO]);

  // Wenn oben & neue vorhanden → automatisch laden
  React.useEffect(() => {
    if (atTop && newCount > 0 && !loadingNew) void loadNewPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atTop, newCount]);

  async function loadNewPosts() {
    setLoadingNew(true);
    try {
      const res = await fetch(`/api/feed?since=${encodeURIComponent(latestISO)}`, { cache: 'no-store' });
      if (!res.ok) return;

      const data = (await res.json()) as { posts: ApiPost[] };
      const mapped = data.posts.map(mapApiPost);

      setItems((prev) => [...mapped, ...prev]);
      setNewCount(0);
    } finally {
      setLoadingNew(false);
    }
  }

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
