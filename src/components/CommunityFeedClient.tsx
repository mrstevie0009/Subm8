// src/components/CommunityFeedClient.tsx
'use client';

import * as React from 'react';
import PostCard from '@/components/PostCard';
import type { FeedPost as PostCardFeedPost } from '@/components/PostCard';

// Lottie (dynamisch laden wie im HomeFeedClient)
import dynamic from 'next/dynamic';
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import heartPress from '@/lotties/Heart-press-lottie.json';

type Props = {
  initialItems: PostCardFeedPost[];
  slug: string;
};

const PAGE_SIZE_OLDER = 20;

type ApiAuthor = {
  id: string;
  handle: string;
  displayName: string;
  role: 'DOMME' | 'SUBMISSIVE' | null;
  avatarUrl: string | null;
};

type ApiCounts = { Like: number; Comment: number; reposts: number };

type ApiRepost = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  author: ApiAuthor;
  _count: ApiCounts;
};

type ApiQuote = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  author: ApiAuthor;
};

type ApiViewer = {
  liked: boolean;
  bookmarked: boolean;
  hasBlockedAuthor: boolean;
  blockedByAuthor: boolean;
};

type ApiFeedItem = {
  id: string;
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  createdAt: string;
  _count: ApiCounts;
  author: ApiAuthor;
  repostOf: ApiRepost | null;
  quoteOf: ApiQuote | null;
  viewer: ApiViewer;
};

type FeedApiResp =
  | { count: number }
  | { posts: ApiFeedItem[]; nextCursor: string | null };

export default function CommunityFeedClient({ initialItems, slug }: Props) {
  const [items, setItems] = React.useState<PostCardFeedPost[]>(initialItems);

  // Top-refresh
  const [newCount, setNewCount] = React.useState(0);
  const [loadingNew, setLoadingNew] = React.useState(false);
  const [atTop, setAtTop] = React.useState(true);
  const topSentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Bottom-infinite
  const [olderCursor, setOlderCursor] = React.useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [hasMoreOlder, setHasMoreOlder] = React.useState(true);
  const bottomSentinelRef = React.useRef<HTMLDivElement | null>(null);

  // UI
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const [buttonTop, setButtonTop] = React.useState(12);

  React.useEffect(() => {
    const $global = document.getElementById('app-global-header');
    const $compact = document.getElementById('community-compact-header');

    const measure = () => {
      const bottoms = [
        ($global?.getBoundingClientRect().bottom ?? 0),
        ($compact?.getBoundingClientRect().bottom ?? 0),
        0,
      ];
      const top = Math.max(...bottoms) + 8;
      setButtonTop(Math.max(8, Math.round(top)));
    };

    measure();
    const ro = new ResizeObserver(measure);
    if ($global) ro.observe($global);
    if ($compact) ro.observe($compact);

    const onScroll = () => measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', measure);

    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Cursor aus letztem Item ableiten
  React.useEffect(() => {
    const last = items[items.length - 1];
    if (last) {
      const ts = new Date(last.createdAtISO).getTime();
      if (Number.isFinite(ts)) setOlderCursor(`${ts}_${last.id}`);
      else setOlderCursor(null);
    } else {
      setOlderCursor(null);
    }
  }, [items]);

  const latestISO = React.useMemo(
    () => items[0]?.createdAtISO ?? new Date(0).toISOString(),
    [items]
  );

  // Ob wir "oben" sind
  React.useEffect(() => {
    const el = topSentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setAtTop(entry.isIntersecting),
      { rootMargin: `${-buttonTop}px 0px 0px 0px`, threshold: 1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [buttonTop]);


  // Poll für neue Posts (nur zählen)
  React.useEffect(() => {
    let active = true;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/communities/${encodeURIComponent(slug)}/feed?since=${encodeURIComponent(latestISO)}&onlyCount=1`,
          { cache: 'no-store' }
        );
        if (!res.ok) return;
        const data = (await res.json()) as FeedApiResp;
        if ('count' in data && active) setNewCount(data.count ?? 0);
      } catch { /* ignore */ }
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [latestISO, slug]);

  // Auto-laden, wenn oben + es gibt neue
  React.useEffect(() => {
    if (atTop && newCount > 0 && !loadingNew) void loadNewPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atTop, newCount]);

  function mapApiToPostCard(p: ApiFeedItem): PostCardFeedPost {
    const isRepost = !!p.repostOf;

    const content: PostCardFeedPost['content'] = isRepost
      ? {
          id: p.repostOf!.id,
          text: p.repostOf!.text ?? '',
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
          quote: p.quoteOf
            ? {
                id: p.quoteOf.id,
                text: p.quoteOf.text ?? '',
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

    const statSource = isRepost && p.repostOf ? p.repostOf : p;

    return {
      id: p.id,
      createdAtISO: p.createdAt,
      content,
      reposter: isRepost
        ? { id: p.author.id, handle: p.author.handle, displayName: p.author.displayName }
        : null,
      stats: {
        comments: statSource._count.Comment ?? 0,
        reposts: statSource._count.reposts ?? 0,
        likes: statSource._count.Like ?? 0,
      },
      viewer: p.viewer ?? {
        liked: false,
        bookmarked: false,
        hasBlockedAuthor: false,
        blockedByAuthor: false,
      },
      initiallyBookmarked: p.viewer?.bookmarked ?? false,
    };
  }

  function appendDedupe(prev: PostCardFeedPost[], next: PostCardFeedPost[]) {
    const seen = new Set(prev.map((p) => p.id));
    const out = [...prev];
    for (const n of next) if (!seen.has(n.id)) out.push(n);
    return out;
  }

  // 1) universeller Dedupe-Helper
  function dedupeById<T extends { id: string }>(arr: T[]): T[] {
    const seen = new Set<string>();
    const out: T[] = [];
    for (const it of arr) {
      if (!seen.has(it.id)) {
        seen.add(it.id);
        out.push(it);
      }
    }
    return out;
  }


  const loadNewPosts = React.useCallback(async () => {
    setLoadingNew(true);
    try {
      const res = await fetch(
        `/api/communities/${encodeURIComponent(slug)}/feed?since=${encodeURIComponent(latestISO)}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;

      const data = (await res.json()) as Extract<FeedApiResp, { posts: ApiFeedItem[]; nextCursor: string | null }>;
      const mapped = data.posts.map(mapApiToPostCard);

      setItems(prev => dedupeById([...mapped, ...prev]));
      setNewCount(0);
    } finally {
      setLoadingNew(false);
    }
  }, [latestISO, slug]);

  React.useEffect(() => {
    if (atTop && newCount > 0 && !loadingNew) {
      void loadNewPosts();
    }
  }, [atTop, newCount, loadingNew, loadNewPosts]);

  const handleClickNew = React.useCallback(async () => {
    await smoothScrollToTop(380);
    await loadNewPosts();
    requestAnimationFrame(() => { void smoothScrollToTop(160); });
  }, [loadNewPosts]);

  React.useEffect(() => {
    const handler = () => { void handleClickNew(); };
    window.addEventListener('community:refresh', handler as EventListener);
    return () => window.removeEventListener('community:refresh', handler as EventListener);
  }, [handleClickNew]);

  async function loadOlder() {
    if (!hasMoreOlder || loadingOlder || olderCursor === null) return;
    setLoadingOlder(true);
    try {
      const res = await fetch(
        `/api/communities/${encodeURIComponent(slug)}/feed?before=${encodeURIComponent(olderCursor)}&take=${PAGE_SIZE_OLDER}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return;

      const data = (await res.json()) as Extract<FeedApiResp, { posts: ApiFeedItem[]; nextCursor: string | null }>;
      const mapped = data.posts.map(mapApiToPostCard);

      setItems((prev) => appendDedupe(prev, mapped));
      setOlderCursor(data.nextCursor);
      setHasMoreOlder(data.nextCursor !== null);
    } finally {
      setLoadingOlder(false);
    }
  }

  // sanfter Scroll nach oben – identisch zu HomeFeedClient
  function smoothScrollToTop(duration = 350) {
    return new Promise<void>((resolve) => {
      const startY = window.scrollY || window.pageYOffset || 0;
      if (startY <= 0) return resolve();
      const start = performance.now();
      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
      function step(now: number) {
        const t = Math.min(1, (now - start) / duration);
        const y = Math.round(startY * (1 - easeOutCubic(t)));
        window.scrollTo(0, y);
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      }
      requestAnimationFrame(step);
    });
  }

  

  // Bottom-Sentinel
  React.useEffect(() => {
    const el = bottomSentinelRef.current;
    if (!el || !hasMoreOlder) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) void loadOlder();
    }, { rootMargin: '800px 0px 800px 0px' });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [olderCursor, loadingOlder, slug, hasMoreOlder]);

  return (
    <>
      {/* Sentinel direkt unter dem großen Community-Header */}
      <div id="community-top-sentinel" ref={topSentinelRef} style={{ height: 1 }} />

      {/* New-Posts Button – Style & Verhalten wie im HomeFeedClient */}
      <div
        className={`
          fixed left-1/2 -translate-x-1/2 z-[70]
          ${(loadingNew || (newCount > 0 && !atTop)) ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
          ${mounted ? '' : 'opacity-0 pointer-events-none'}
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
              ? 'w-20 h-20 bg-transparent'
              : 'px-4 h-9 bg-[var(--purple)] text-white'
          ].join(' ')}
          aria-live="polite"
        >
          {loadingNew ? (
            <div className="absolute inset-0 grid place-items-center" aria-label="Loading" role="status">
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

      {loadingNew && (
        <div className="rounded-app border border-sub shadow-app p-4">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-full bg-white/10 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
              <div className="mt-2 h-3 w-[90%] bg-white/10 rounded animate-pulse" />
              <div className="mt-2 h-3 w-[70%] bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* FEED */}
      <div className="grid gap-3">
        {items.map((p) => <PostCard key={p.id} post={p} />)}
        {items.length === 0 && (
          <div className="rounded-app border border-sub shadow-app p-8 text-center opacity-70">
            Noch keine Posts in dieser Community.
          </div>
        )}
      </div>

      {/* Bottom-Sentinel + Loader */}
      <div ref={bottomSentinelRef} style={{ height: 1 }} />
      {loadingOlder && hasMoreOlder && (
        <div className="rounded-app border border-sub shadow-app p-4 mt-3">
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-full bg-white/10 animate-pulse" />
            <div className="min-w-0 flex-1">
              <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
              <div className="mt-2 h-3 w-[90%] bg-white/10 rounded animate-pulse" />
              <div className="mt-2 h-3 w-[70%] bg-white/10 rounded animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
