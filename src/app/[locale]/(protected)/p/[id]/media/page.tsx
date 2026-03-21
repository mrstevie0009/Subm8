// src/app/[locale]/p/[id]/media/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import VideoPlayer from '@/components/VideoPlayer';
import MediaDetailHeader from '@/components/MediaDetailHeader';
import PostActionsBar from '@/components/PostActionsBar';
import { toast } from '@/lib/toast';

type ContentMedia = {
  url: string;
  alt?: string | null;
  kind?: 'image' | 'video' | 'gif';
  postId: string;
};

type PostWithMedia = {
  id: string;
  text?: string | null;
  author?: {
    handle?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
  media: ContentMedia[];
  stats?: { likes?: number; comments?: number; reposts?: number };
  viewer?: { liked?: boolean; bookmarked?: boolean; reposted?: boolean };
};

type MediaContainer = {
  media?: ContentMedia[] | null;
  uploaded?: Array<{
    url: string;
    alt?: string | null;
    type?: string | null;
    mime?: string | null;
    kind?: 'image' | 'video' | 'gif';
  }> | null;
  mediaUrls?: string[] | null;
  attachments?: Array<{
    url: string;
    alt?: string | null;
    kind?: 'image' | 'video' | 'gif';
    type?: string | null;
    mime?: string | null;
  }> | null;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
};

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

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function getString(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function getStats(v: unknown): PostWithMedia['stats'] | undefined {
  if (!isObj(v)) return undefined;
  return {
    likes: typeof v.likes === 'number' ? v.likes : undefined,
    comments: typeof v.comments === 'number' ? v.comments : undefined,
    reposts: typeof v.reposts === 'number' ? v.reposts : undefined,
  };
}

function getViewer(v: unknown): PostWithMedia['viewer'] | undefined {
  if (!isObj(v)) return undefined;
  return {
    liked: typeof v.liked === 'boolean' ? v.liked : undefined,
    bookmarked: typeof v.bookmarked === 'boolean' ? v.bookmarked : undefined,
    reposted: typeof v.reposted === 'boolean' ? v.reposted : undefined,
  };
}

function getAuthor(v: unknown): PostWithMedia['author'] | undefined {
  if (!isObj(v)) return undefined;
  return {
    handle: getString(v.handle),
    displayName: getString(v.displayName),
    avatarUrl: getString(v.avatarUrl),
  };
}

function extractPostText(payload: Record<string, unknown>): string | null {
  return (
    getString(payload.text) ??
    (isObj(payload.content) ? getString(payload.content.text) : null) ??
    null
  );
}

function normalizeMediaFields(src: MediaContainer, postId: string): ContentMedia[] {
  const out: ContentMedia[] = [];

  const pushArr = (arr?: ContentMedia[] | null) => {
    if (!Array.isArray(arr)) return;
    for (const m of arr) {
      if (m?.url) {
        out.push({
          url: m.url,
          alt: m.alt ?? null,
          kind: m.kind ?? kindFromUrl(m.url),
          postId,
        });
      }
    }
  };

  pushArr(src.media);

  if (Array.isArray(src.uploaded)) {
    for (const m of src.uploaded) {
      if (!m?.url) continue;

      const mime = m.type ?? m.mime ?? null;
      const kind: 'image' | 'video' | 'gif' =
        m.kind ??
        (mime === 'image/gif'
          ? 'gif'
          : mime?.startsWith('video/')
            ? 'video'
            : kindFromUrl(m.url));

      out.push({ url: m.url, alt: m.alt ?? null, kind, postId });
    }
  }

  if (Array.isArray(src.attachments)) {
    for (const m of src.attachments) {
      if (!m?.url) continue;
      const kind =
        m.kind ??
        (m.type === 'image/gif'
          ? 'gif'
          : m.type?.startsWith('video/')
            ? 'video'
            : kindFromUrl(m.url));
      out.push({ url: m.url, alt: m.alt ?? null, kind, postId });
    }
  }

  if (Array.isArray(src.mediaUrls)) {
    for (const url of src.mediaUrls) {
      if (url) out.push({ url, alt: null, kind: kindFromUrl(url), postId });
    }
  }

  if (src.mediaUrl) {
    out.push({
      url: src.mediaUrl,
      alt: src.mediaAlt ?? null,
      kind: kindFromUrl(src.mediaUrl),
      postId,
    });
  }

  const seen = new Set<string>();
  return out.filter((m) => (seen.has(m.url) ? false : (seen.add(m.url), true)));
}

function BlurredGate({
  onStartVeriff,
}: {
  onStartVeriff: () => void | Promise<void>;
}) {
  const tVerify = useTranslations('verify');

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-black p-6 text-white">
      <div className="w-full max-w-[520px] rounded-3xl border border-white/15 bg-black/70 p-6 text-center backdrop-blur-xl">
        <div className="text-base font-semibold">{tVerify('overlay.heading')}</div>
        <div className="mt-2 text-sm text-white/80">{tVerify('overlay.body')}</div>
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--purple)] px-4 py-2 text-white hover:opacity-95"
          onClick={() => void onStartVeriff()}
        >
          {tVerify('overlay.cta')}
        </button>
        <div className="mt-2 text-[11px] text-white/60">{tVerify('overlay.note')}</div>
      </div>
    </div>
  );
}

function MediaSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-black">
      <div className="media-skeleton aspect-[16/10] w-[90%] max-w-5xl rounded-3xl" />
    </div>
  );
}

function BottomPostPanel({
  post,
  visible,
  expanded,
  onExpand,
}: {
  post?: PostWithMedia;
  visible: boolean;
  expanded: boolean;
  onExpand: () => void;
}) {
  if (!post) return null;

  const text = post.text?.trim() ?? '';
  if (!text) return null;

  return (
    <div
      className={[
        'fixed inset-x-0 bottom-[60px] z-[55] transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3',
      ].join(' ')}
    >
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="mx-auto w-full">
          <div
            className={[
              'text-white text-[14px] leading-5',
              expanded ? '' : 'truncate',
            ].join(' ')}
          >
            {text}
          </div>

          {!expanded ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onExpand();
              }}
              className="mt-1 text-sm font-medium text-white/75 hover:text-white"
            >
              mehr lesen
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function PostMediaPage() {
  const router = useRouter();
  const params = useParams() as { locale: string; id: string };
  const { locale, id } = params;
  const search = useSearchParams();
  const initialIndexRef = React.useRef<number>(
    Math.max(0, parseInt(search.get('i') || '0', 10) || 0)
  );

  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;
  const tPost = useTranslations('post');

  const [uiVisible, setUiVisible] = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [allMedia, setAllMedia] = React.useState<ContentMedia[]>([]);
  const [posts, setPosts] = React.useState<Map<string, PostWithMedia>>(new Map());
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [oldestCursor, setOldestCursor] = React.useState<string | null>(null);
  const [textExpanded, setTextExpanded] = React.useState(false);

  const [likeTrigger, setLikeTrigger] = React.useState<{
    seq: number;
    postId: string;
  } | null>(null);
  const [heartBurst, setHeartBurst] = React.useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const slideRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const wheelLockRef = React.useRef(false);
  const hideUiTimerRef = React.useRef<number | null>(null);
  const ignoreClickRef = React.useRef(false);
  const touchStartRef = React.useRef<{ x: number; y: number } | null>(null);

  const lastTapRef = React.useRef<{ time: number; x: number; y: number } | null>(null);
  const heartBurstTimerRef = React.useRef<number | null>(null);

  const currentMedia = allMedia[currentIndex];

  const currentPost = React.useMemo(() => {
    if (!currentMedia?.postId) return undefined;
    return posts.get(currentMedia.postId);
  }, [posts, currentMedia?.postId]);

  const currentPostMedia = React.useMemo(() => {
    return currentPost?.media ?? [];
  }, [currentPost]);

  const currentPostMediaIndex = React.useMemo(() => {
    if (!currentMedia || currentPostMedia.length === 0) return 0;
    const idx = currentPostMedia.findIndex((m) => m.url === currentMedia.url);
    return idx >= 0 ? idx : 0;
  }, [currentMedia, currentPostMedia]);

  const currentPostId = currentPost?.id ?? currentMedia?.postId ?? id;

  const currentHeaderSubtitle = React.useMemo(() => {
    if (!currentPost?.author) return undefined;
    const handle = currentPost.author.handle ? `@${currentPost.author.handle}` : '';
    const display = currentPost.author.displayName || '';
    if (display && handle) return `${display} · ${handle}`;
    return display || handle || undefined;
  }, [currentPost]);

  const clearHideUiTimer = React.useCallback(() => {
    if (hideUiTimerRef.current) {
      window.clearTimeout(hideUiTimerRef.current);
      hideUiTimerRef.current = null;
    }
  }, []);

  const scheduleAutoHide = React.useCallback(() => {
    clearHideUiTimer();
    hideUiTimerRef.current = window.setTimeout(() => {
      setUiVisible(false);
    }, 2800);
  }, [clearHideUiTimer]);

  const showUi = React.useCallback((sticky = false) => {
    setUiVisible(true);
    if (!sticky) scheduleAutoHide();
    else clearHideUiTimer();
  }, [scheduleAutoHide, clearHideUiTimer]);

  React.useEffect(() => {
    setTextExpanded(false);
    showUi();
    return clearHideUiTimer;
  }, [currentIndex, showUi, clearHideUiTimer]);

  const updateUrlIndex = React.useCallback((idx: number) => {
    try {
      const u = new URL(window.location.href);
      u.searchParams.set('i', String(Math.max(0, idx)));
      window.history.replaceState({}, '', u.toString());
    } catch {}
  }, []);

  const scrollToIndex = React.useCallback(
    (idx: number, behavior: ScrollBehavior = 'smooth') => {
      const target = slideRefs.current[idx];
      if (!target) return;
      target.scrollIntoView({ behavior, inline: 'start', block: 'nearest' });
    },
    []
  );

  const mergePosts = React.useCallback((incoming: PostWithMedia[]) => {
    setPosts((prev) => {
      const next = new Map(prev);
      for (const post of incoming) next.set(post.id, post);
      return next;
    });
  }, []);

  React.useEffect(() => {
    return () => {
      if (heartBurstTimerRef.current) {
        window.clearTimeout(heartBurstTimerRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const cachedRaw = sessionStorage.getItem(`pm:${id}`);

        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as {
            v?: number;
            at?: number;
            items?: ContentMedia[];
            text?: string | null;
            author?: PostWithMedia['author'];
            stats?: { likes?: number; comments?: number; reposts?: number };
            viewer?: { liked?: boolean; bookmarked?: boolean; reposted?: boolean };
          };

          if (parsed?.items?.length && !cancelled) {
            const mediaWithPostId = parsed.items.map((m) => ({ ...m, postId: id }));
            const cachedPost: PostWithMedia = {
              id,
              text: parsed.text ?? null,
              author: parsed.author,
              media: mediaWithPostId,
              stats: parsed.stats,
              viewer: parsed.viewer,
            };

            setAllMedia(mediaWithPostId);
            mergePosts([cachedPost]);
            setIsLoading(false);

            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const safeIdx = Math.min(initialIndexRef.current, Math.max(0, mediaWithPostId.length - 1));
                setCurrentIndex(safeIdx);
                updateUrlIndex(safeIdx);
                if (safeIdx > 0) scrollToIndex(safeIdx, 'auto');
              });
            });
          }
        }

        const res = await fetch(`/api/posts/preview/${encodeURIComponent(id)}`, {
          cache: 'no-store',
        });
        const j: unknown = await res.json().catch(() => null);

        if (!res.ok || !j) throw new Error('Bad response');

        const payload = isObj(j) ? (isObj(j['post']) ? j['post'] : j) : {};
        const media = normalizeMediaFields(payload as MediaContainer, id);
        const createdAt = getString(payload.createdAt);

        if (cancelled) return;

        if (!media.length) {
          setAllMedia([]);
          setIsLoading(false);
          toast.error('Keine Medien im Post gefunden.', 'Keine Medien');
          return;
        }

        const postData: PostWithMedia = {
          id,
          text: extractPostText(payload) ?? null,
          author: getAuthor(payload.author),
          media,
          stats: getStats(payload.stats),
          viewer: getViewer(payload.viewer),
        };

        setAllMedia((prev) => (prev.length > 0 ? prev : media));
        mergePosts([postData]);
        setOldestCursor((prev) => prev ?? createdAt);
        setIsLoading(false);

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const safeIdx = Math.min(initialIndexRef.current, Math.max(0, media.length - 1));
            setCurrentIndex(safeIdx);
            updateUrlIndex(safeIdx);
            if (safeIdx > 0) scrollToIndex(safeIdx, 'auto');
          });
        });
      } catch {
        if (!cancelled) {
          setAllMedia([]);
          setIsLoading(false);
          toast.error('Konnte Medien nicht laden.', 'Fehler');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, mergePosts, scrollToIndex, updateUrlIndex]);

  const loadMorePosts = React.useCallback(async () => {
    if (isLoadingMore || !hasMore || !oldestCursor) return;

    setIsLoadingMore(true);

    try {
      const res = await fetch(
      `/api/feed?before=${encodeURIComponent(oldestCursor)}&limit=6&withMedia=1`,
      { cache: 'no-store' }
    );
      const j: unknown = await res.json().catch(() => null);

      if (!res.ok || !isObj(j) || !Array.isArray(j.posts)) {
        setHasMore(false);
        return;
      }

      const items = j.posts as Array<Record<string, unknown>>;
      if (items.length === 0) {
        setHasMore(false);
        return;
      }

      const incomingPosts: PostWithMedia[] = [];
      const incomingMedia: ContentMedia[] = [];
      const existingPostIds = new Set(Array.from(posts.keys()));

      
      for (const item of items) {
        const repostOf = isObj(item.repostOf) ? item.repostOf : null;

        // Für den Viewer soll immer der eigentliche Content-Post verwendet werden
        const contentPost = repostOf ?? item;
        const contentPostId = getString(contentPost.id);

        if (!contentPostId || existingPostIds.has(contentPostId)) continue;

        const media = normalizeMediaFields(contentPost as MediaContainer, contentPostId);

        if (!media.length) continue;

        incomingMedia.push(...media);

        incomingPosts.push({
          id: contentPostId,
          text: getString(contentPost.text) ?? null,
          author: getAuthor(contentPost.author),
          media,
          stats: isObj(item._count)
            ? {
                likes: typeof item._count.Like === 'number' ? item._count.Like : 0,
                comments: typeof item._count.Comment === 'number' ? item._count.Comment : 0,
                reposts: typeof item._count.reposts === 'number' ? item._count.reposts : 0,
              }
            : undefined,
          viewer: getViewer(item.viewer),
        });
      }

      if (incomingPosts.length > 0) {
        mergePosts(incomingPosts);
      }

      if (incomingMedia.length > 0) {
        setAllMedia((prev) => [...prev, ...incomingMedia]);
      } else {
        console.warn('loadMorePosts: keine neuen Medien aus /api/feed extrahiert');
      }

      const lastItem = items[items.length - 1];
      const lastCursor = getString(lastItem?.createdAt);

      setOldestCursor(lastCursor);

      if (items.length < 6 || !lastCursor) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more posts:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMore, isLoadingMore, posts, oldestCursor, mergePosts]);

  React.useEffect(() => {
    if (!containerRef.current || allMedia.length === 0) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        let bestIdx = currentIndex;
        let bestRatio = 0;

        for (const entry of entries) {
          const idx = parseInt(entry.target.getAttribute('data-media-index') || '0', 10);
          if (entry.isIntersecting && entry.intersectionRatio >= bestRatio) {
            bestRatio = entry.intersectionRatio;
            bestIdx = idx;
          }
        }

        if (bestRatio > 0 && bestIdx !== currentIndex) {
          setCurrentIndex(bestIdx);
          updateUrlIndex(bestIdx);
        }
      },
      {
        root: containerRef.current,
        threshold: [0.55, 0.7, 0.85],
      }
    );

    slideRefs.current.forEach((node) => {
      if (node) observerRef.current?.observe(node);
    });

    return () => observerRef.current?.disconnect();
  }, [allMedia.length, currentIndex, updateUrlIndex]);

  React.useEffect(() => {
    if (!hasMore || isLoadingMore || allMedia.length === 0) return;

    const isOnLastSlide = currentIndex >= allMedia.length - 1;
    if (isOnLastSlide) {
      void loadMorePosts();
    }
  }, [currentIndex, hasMore, isLoadingMore, allMedia.length, loadMorePosts]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back();
        return;
      }

      if (!allMedia.length) return;

      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'PageDown') {
        e.preventDefault();
        scrollToIndex(Math.min(currentIndex + 1, allMedia.length - 1));
      }

      if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'PageUp') {
        e.preventDefault();
        scrollToIndex(Math.max(currentIndex - 1, 0));
      }

      if (e.key === 'Home') {
        e.preventDefault();
        scrollToIndex(0);
      }

      if (e.key === 'End') {
        e.preventDefault();
        scrollToIndex(allMedia.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allMedia.length, currentIndex, router, scrollToIndex]);

  const startAgeVerification = React.useCallback(async () => {
    try {
      const back = `/${locale}/p/${id}/media?i=${currentIndex}`;

      if (!session) {
        router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }

      const res = await fetch(
        `/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`,
        { method: 'POST' }
      );

      const j: unknown = await res.json().catch(() => null);
      const url = isObj(j) ? (j['url'] as string | undefined) : undefined;

      if (!res.ok || !url) throw new Error('veriff start failed');
      router.push(url);
    } catch {
      toast.error('Die Verifikation konnte nicht gestartet werden.', 'Fehler');
    }
  }, [currentIndex, id, locale, router, session]);

  const handleContainerWheel = React.useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (allMedia.length <= 1) return;

      const dominantDelta =
        Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;

      if (Math.abs(dominantDelta) < 24) return;

      e.preventDefault();
      showUi();

      if (wheelLockRef.current) return;
      wheelLockRef.current = true;

      if (dominantDelta > 0) {
        scrollToIndex(Math.min(currentIndex + 1, allMedia.length - 1));
      } else {
        scrollToIndex(Math.max(currentIndex - 1, 0));
      }

      window.setTimeout(() => {
        wheelLockRef.current = false;
      }, 360);
    },
    [allMedia.length, currentIndex, scrollToIndex, showUi]
  );

  const onTouchStart = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      const t = e.touches[0];
      touchStartRef.current = { x: t.clientX, y: t.clientY };
      ignoreClickRef.current = false;
      showUi();
    },
    [showUi]
  );

  const onTouchMove = React.useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (!touchStartRef.current) return;
      const t = e.touches[0];
      const dx = Math.abs(t.clientX - touchStartRef.current.x);
      const dy = Math.abs(t.clientY - touchStartRef.current.y);
      if (dx > 12 || dy > 12) {
        ignoreClickRef.current = true;
      }
      showUi();
    },
    [showUi]
  );

  const fireHeartBurst = React.useCallback((x: number, y: number) => {
    if (heartBurstTimerRef.current) {
      window.clearTimeout(heartBurstTimerRef.current);
    }

    setHeartBurst({
      id: Date.now(),
      x,
      y,
    });

    heartBurstTimerRef.current = window.setTimeout(() => {
      setHeartBurst(null);
    }, 900);
  }, []);

  const triggerDoubleLike = React.useCallback((x: number, y: number) => {
    if (!currentPost?.id) return;

    fireHeartBurst(x, y);
    setUiVisible(true);
    scheduleAutoHide();

    setLikeTrigger((prev) => ({
      postId: currentPost.id,
      seq: prev ? prev.seq + 1 : 1,
    }));
  }, [currentPost?.id, fireHeartBurst, scheduleAutoHide]);

  const onTouchEnd = React.useCallback(() => {
    touchStartRef.current = null;
  }, []);

  const handleMediaTap = React.useCallback(
    (clientX: number, clientY: number) => {
      if (ignoreClickRef.current) {
        ignoreClickRef.current = false;
        return;
      }

      const now = Date.now();
      const last = lastTapRef.current;

      if (
        last &&
        now - last.time < 280 &&
        Math.abs(last.x - clientX) < 24 &&
        Math.abs(last.y - clientY) < 24
      ) {
        lastTapRef.current = null;
        triggerDoubleLike(clientX, clientY);
        return;
      }

      lastTapRef.current = { time: now, x: clientX, y: clientY };

      window.setTimeout(() => {
        const current = lastTapRef.current;
        if (!current) return;
        if (current.time !== now) return;

        lastTapRef.current = null;

        if (textExpanded) {
          setTextExpanded(false);
          scheduleAutoHide();
          return;
        }

        setUiVisible((prev) => {
          const next = !prev;
          if (next) scheduleAutoHide();
          else clearHideUiTimer();
          return next;
        });
      }, 280);
    },
    [textExpanded, triggerDoubleLike, scheduleAutoHide, clearHideUiTimer]
  );

  let content: React.ReactNode;

  if (!ageOk) {
    content = <BlurredGate onStartVeriff={startAgeVerification} />;
  } else if (isLoading) {
    content = <MediaSkeleton />;
  } else if (allMedia.length === 0) {
    content = (
      <div className="grid h-full place-items-center bg-black text-white/70">
        <div className="text-center">
          <div className="mb-3 text-4xl">📷</div>
          <div>Keine Medien gefunden</div>
        </div>
      </div>
    );
  } else {
    content = (
      <div className="relative h-full w-full bg-black">
        <div
          ref={containerRef}
          className="media-viewer-container h-full w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory no-scrollbar"
          style={{
            WebkitOverflowScrolling: 'touch',
            overscrollBehaviorX: 'contain',
            overscrollBehaviorY: 'none',
            scrollBehavior: 'smooth',
            touchAction: 'pan-x',
          }}
          onWheel={handleContainerWheel}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseMove={() => showUi()}
        >
          <div className="flex h-full w-max">
            {allMedia.map((m, i) => {
              const isGif = m.kind === 'gif';
              const isVideoLike = m.kind === 'video' || isGif;
              const isCurrentItem = i === currentIndex;

              return (
                <div
                  key={`${m.url}-${i}`}
                  ref={(el) => {
                    slideRefs.current[i] = el;
                  }}
                  data-media-index={i}
                  className="media-viewer-item relative h-full w-[100vw] shrink-0 snap-center overflow-hidden bg-black"
                >
                  <button
                    type="button"
                    className="media-viewer-tap-area absolute inset-0 z-10"
                    onClick={(e) => handleMediaTap(e.clientX, e.clientY)}
                    aria-label={uiVisible ? 'Hide overlay' : 'Show overlay'}
                  />

                  <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4">
                    {isVideoLike ? (
                      <VideoPlayer
                        src={m.url}
                        className="max-h-full max-w-full h-auto w-auto"
                        autoPlay={isCurrentItem}
                        muted
                        loop
                        showScrubber={uiVisible}
                        rightTag={isGif ? 'GIF' : undefined}
                        clickToToggle={false}
                      />
                    ) : (
                      <Image
                        src={m.url}
                        alt={m.alt ?? ''}
                        width={1920}
                        height={1080}
                        className="max-h-full max-w-full h-auto w-auto object-contain select-none"
                        unoptimized
                        priority={i <= initialIndexRef.current + 1}
                        draggable={false}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {isLoadingMore ? (
          <div className="pointer-events-none absolute bottom-4 right-4 z-[50] rounded-full border border-white/10 bg-black/55 px-3 py-1.5 text-xs text-white/80 backdrop-blur-xl">
            Weitere Medien werden geladen …
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-black text-white">
      <MediaDetailHeader
        key={`header-${currentPostId}`}
        visible={uiVisible}
        title={tPost('headerTitle')}
        subtitle={currentHeaderSubtitle}
        currentIndex={currentPostMediaIndex}
        total={currentPostMedia.length}
      />

      <div className="absolute inset-0">
        {content}
      </div>

      {heartBurst ? (
        <div
          className="pointer-events-none absolute z-[70]"
          style={{
            left: heartBurst.x,
            top: heartBurst.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className="media-like-heart">
            <svg
              viewBox="0 0 32 32"
              fill="currentColor"
              aria-hidden
              className="block h-16 w-16 sm:h-20 sm:w-20"
              style={{
                overflow: 'visible',
                filter: 'drop-shadow(0 10px 24px rgba(0,0,0,.35))',
              }}
            >
              <path d="M23.6 3.2c-2.8 0-5.1 1.3-6.6 3.3-1.5-2-3.8-3.3-6.6-3.3C5.7 3.2 2 6.8 2 11.4c0 9 12.6 16.2 14.2 17.1a1.6 1.6 0 0 0 1.6 0C19.4 27.6 32 20.4 32 11.4c0-4.6-3.7-8.2-8.4-8.2Z" />
            </svg>
          </div>
        </div>
      ) : null}

      {ageOk && allMedia.length > 0 && currentPost ? (
        <>
          <BottomPostPanel
            post={currentPost}
            visible={uiVisible}
            expanded={textExpanded}
            onExpand={() => {
              setTextExpanded(true);
              setUiVisible(true);
              clearHideUiTimer();
            }}
          />

          <PostActionsBar
            key={`actions-${currentPost.id}`}
            postId={currentPost.id}
            stats={currentPost.stats}
            viewer={currentPost.viewer}
            onCommentClick={() => router.push(`/${locale}/p/${currentPost.id}`)}
            visible={uiVisible}
            likeTrigger={
              likeTrigger?.postId === currentPost.id ? likeTrigger.seq : 0
            }
          />
        </>
      ) : null}

      <style jsx global>{`
        .media-viewer-container::-webkit-scrollbar,
        .no-scrollbar::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }

        .media-viewer-container {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .media-skeleton {
          background:
            linear-gradient(
              90deg,
              rgba(255, 255, 255, 0.05) 0%,
              rgba(255, 255, 255, 0.1) 25%,
              rgba(255, 255, 255, 0.05) 50%
            ),
            #0a0a0a;
          background-size: 200% 100%;
          animation: mediaShimmer 1.2s linear infinite;
        }

        @keyframes mediaShimmer {
          from {
            background-position: 200% 0;
          }
          to {
            background-position: -200% 0;
          }
        }

        @keyframes mediaLikeHeartFloat {
          0% {
            opacity: 0;
            transform: translate3d(0, 14px, 0) scale(0.45);
          }
          18% {
            opacity: 1;
            transform: translate3d(0, 0, 0) scale(1.08);
          }
          30% {
            opacity: 1;
            transform: translate3d(0, -4px, 0) scale(0.96);
          }
          48% {
            opacity: 1;
            transform: translate3d(0, -10px, 0) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate3d(0, -54px, 0) scale(0.92);
          }
        }

        .media-like-heart {
          color: var(--purple);
          animation: mediaLikeHeartFloat 900ms cubic-bezier(.22,.8,.24,1) forwards;
          will-change: transform, opacity;
        }
      `}</style>
    </div>
  );
}