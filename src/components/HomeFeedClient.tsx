'use client';

import * as React from 'react';
import PostCard from '@/components/PostCard';
import type { FeedPost } from '@/app/[locale]/page';
import { relativeTime } from '@/lib/relativeTime';

type Props = {
  initialItems: FeedPost[];
  locale: string;
};

export default function HomeFeedClient({ initialItems, locale }: Props) {
  const [items, setItems] = React.useState<FeedPost[]>(initialItems);
  const [newCount, setNewCount] = React.useState(0);
  const [loadingNew, setLoadingNew] = React.useState(false);
  const [atTop, setAtTop] = React.useState(true);

  const topSentinelRef = React.useRef<HTMLDivElement | null>(null);

  // ——— Headerhöhe + aktuelle Position messen
  const [headerHeight, setHeaderHeight] = React.useState(64); // Fallback
  const [buttonTop, setButtonTop] = React.useState(12);

  React.useEffect(() => {
    const header = document.getElementById('app-global-header');
    if (!header) return;

    const measureHeight = () => {
      const h = header.getBoundingClientRect().height;
      setHeaderHeight(h || 64);
    };
    const measureTop = () => {
      const rect = header.getBoundingClientRect();
      // Button sitzt direkt unter dem Header; wenn Header weg-geschoben ist, mind. 8px vom Viewport-Top
      const top = Math.max(8, Math.round(rect.bottom) + 8);
      setButtonTop(top);
    };

    measureHeight();
    measureTop();

    const ro = new ResizeObserver(() => {
      measureHeight();
      measureTop();
    });
    ro.observe(header);

    const onScroll = () => {
      // Header bewegt sich (translateY), also Position aktualisieren
      measureTop();
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measureTop);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measureTop);
    };
  }, []);

  const latestISO = React.useMemo(
    () => items[0]?.createdAtISO ?? new Date(0).toISOString(),
    [items]
  );

  // Top-Erkennung: Sentinel muss den oberen Bereich + Headerhöhe passieren
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

      const data = (await res.json()) as {
        posts: Array<{
          id: string;
          text: string | null;
          mediaUrl: string | null;
          mediaAlt: string | null;
          createdAt: string;
          _count: { Like: number; Comment: number };
          author: {
            displayName: string;
            handle: string;
            role: 'DOMME' | 'SUBMISSIVE';
            avatarUrl: string | null;
          };
          viewer: {
            liked: boolean;
            bookmarked: boolean;
            hasBlockedAuthor: boolean;
            blockedByAuthor: boolean;
          };
        }>;
      };

      const mapped: FeedPost[] = data.posts.map((p) => ({
        id: p.id,
        author: {
          name: p.author.displayName,
          role: p.author.role === 'DOMME' ? 'domme' : 'submissive',
          handle: p.author.handle,
          avatarUrl: p.author.avatarUrl ?? undefined,
        },
        createdAt: relativeTime(new Date(p.createdAt), locale),
        createdAtISO: p.createdAt,
        text: p.text ?? '', // Schema: required
        mediaUrl: p.mediaUrl ?? undefined,
        mediaAlt: p.mediaAlt ?? undefined,
        stats: { comments: p._count.Comment ?? 0, reposts: 0, likes: p._count.Like ?? 0 },
        viewer: p.viewer,
        initiallyBookmarked: p.viewer.bookmarked,
      }));

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
      {/* Sentinel direkt unter dem (globalen) Header */}
      <div ref={topSentinelRef} style={{ height: 1 }} />

      {/* New-Posts Button – klebt immer direkt unter dem Header */}
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
