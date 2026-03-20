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

// ——— Types ———
type ContentMedia = { 
  url: string; 
  alt?: string | null; 
  kind?: 'image' | 'video' | 'gif';
  postId: string;
};

type PostWithMedia = {
  id: string;
  media: ContentMedia[];
  stats?: { likes?: number; comments?: number; reposts?: number };
  viewer?: { liked?: boolean; bookmarked?: boolean; reposted?: boolean };
};

// ——— Helpers ———
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
  uploaded?: Array<{ url: string; alt?: string | null; type?: string | null }> | null;
  mediaUrls?: string[] | null;
  attachments?: Array<{ url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif' }> | null;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
};

function normalizeMediaFields(src: MediaContainer, postId: string): ContentMedia[] {
  const out: ContentMedia[] = [];
  
  const pushArr = (arr?: ContentMedia[] | null) => {
    if (!Array.isArray(arr)) return;
    for (const m of arr) {
      if (m?.url) out.push({ 
        url: m.url, 
        alt: m.alt ?? null, 
        kind: m.kind ?? kindFromUrl(m.url),
        postId 
      });
    }
  };
  
  pushArr(src.media);
  
  if (Array.isArray(src.uploaded)) {
    for (const m of src.uploaded) {
      if (m?.url) {
        const mime = m.type ?? null;
        const kind: 'image' | 'video' | 'gif' =
          mime === 'image/gif' ? 'gif' : mime?.startsWith('video/') ? 'video' : 'image';
        out.push({ url: m.url, alt: m.alt ?? null, kind, postId });
      }
    }
  }
  
  if (Array.isArray(src.attachments)) {
    for (const m of src.attachments) {
      if (m?.url) out.push({ 
        url: m.url, 
        alt: m.alt ?? null, 
        kind: m.kind ?? kindFromUrl(m.url),
        postId 
      });
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
      postId 
    });
  }
  
  const seen = new Set<string>();
  return out.filter(m => (seen.has(m.url) ? false : (seen.add(m.url), true)));
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
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

// ——— Loading Skeleton ———
function MediaSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-black">
      <div className="media-skeleton w-[90%] max-w-2xl aspect-[4/3] rounded-xl" />
    </div>
  );
}

export default function PostMediaPage() {
  const router = useRouter();
  const params = useParams() as { locale: string; id: string };
  const { locale, id } = params;
  const search = useSearchParams();
  const startMediaIndex = Math.max(0, parseInt(search.get('i') || '0', 10) || 0);
  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;

  const [uiVisible, setUiVisible] = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [allMedia, setAllMedia] = React.useState<ContentMedia[]>([]);
  const [posts, setPosts] = React.useState<Map<string, PostWithMedia>>(new Map());
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [oldestPostId, setOldestPostId] = React.useState<string | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const observerRef = React.useRef<IntersectionObserver | null>(null);
  const loadMoreTriggerRef = React.useRef<HTMLDivElement>(null);

  // Initial Post laden
  React.useEffect(() => {
    let cancelled = false;
    
    (async () => {
      try {
        // 1. Aus SessionStorage versuchen
        const cachedRaw = sessionStorage.getItem(`pm:${id}`);
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw) as { 
            v?: number; 
            at?: number; 
            items?: ContentMedia[];
            stats?: { likes?: number; comments?: number; reposts?: number };
            viewer?: { liked?: boolean; bookmarked?: boolean; reposted?: boolean };
          };
          
          if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
            if (!cancelled) {
              const mediaWithPostId = parsed.items.map(m => ({ ...m, postId: id }));
              setAllMedia(mediaWithPostId);
              setPosts(new Map([[id, {
                id,
                media: mediaWithPostId,
                stats: parsed.stats,
                viewer: parsed.viewer,
              }]]));
              setOldestPostId(id);
              setIsLoading(false);
              
              // Scroll to start index
              setTimeout(() => {
                if (startMediaIndex > 0 && containerRef.current) {
                  const items = containerRef.current.querySelectorAll('[data-media-index]');
                  const target = items[startMediaIndex] as HTMLElement | undefined;
                  target?.scrollIntoView({ behavior: 'instant', block: 'start' });
                }
              }, 100);
              return;
            }
          }
        }

        // 2. API Fetch
        const res = await fetch(`/api/posts/preview/${encodeURIComponent(id)}`, { 
          cache: 'no-store' 
        });
        const j: unknown = await res.json().catch(() => null);
        
        if (!res.ok || !j) throw new Error('Bad response');

        const payload = isObj(j) ? (isObj(j['post']) ? j['post'] : j) : {};
        const media = normalizeMediaFields(payload as MediaContainer, id);
        
        if (!cancelled) {
          if (!Array.isArray(media) || media.length === 0) {
            setAllMedia([]);
            setIsLoading(false);
            toast.error('Keine Medien im Post gefunden.', 'Keine Medien');
            return;
          }
          
          setAllMedia(media);
          setPosts(new Map([[id, {
            id,
            media,
            stats: (payload as { stats?: PostWithMedia['stats'] }).stats,
            viewer: (payload as { viewer?: PostWithMedia['viewer'] }).viewer,
          }]]));
          setOldestPostId(id);
          setIsLoading(false);
          
          // Scroll to start index
          setTimeout(() => {
            if (startMediaIndex > 0 && containerRef.current) {
              const items = containerRef.current.querySelectorAll('[data-media-index]');
              const target = items[startMediaIndex] as HTMLElement | undefined;
              target?.scrollIntoView({ behavior: 'instant', block: 'start' });
            }
          }, 100);
        }
      } catch {
        if (!cancelled) {
          setAllMedia([]);
          setIsLoading(false);
          toast.error('Konnte Medien nicht laden.', 'Fehler');
        }
      }
    })();
    
    return () => { cancelled = true; };
  }, [id, startMediaIndex]);

  // Load More Posts
  const loadMorePosts = React.useCallback(async () => {
    if (isLoadingMore || !hasMore || !oldestPostId) return;

    setIsLoadingMore(true);
    
    try {
      // Get user's feed with media posts before oldestPostId
      const res = await fetch(
        `/api/feed?before=${oldestPostId}&limit=5&withMedia=true`,
        { cache: 'no-store' }
      );
      const j = await res.json();
      
      if (!res.ok || !j?.ok || !Array.isArray(j.items)) {
        setHasMore(false);
        return;
      }

      const newPosts = j.items as Array<{
        id: string;
        content: {
          id: string;
          mediaUrl?: string;
          mediaAlt?: string;
          uploaded?: Array<{ url: string; alt?: string | null; type?: string | null }>;
        };
        stats?: { likes?: number; comments?: number; reposts?: number };
        viewer?: { liked?: boolean; bookmarked?: boolean; reposted?: boolean };
      }>;

      if (newPosts.length === 0) {
        setHasMore(false);
        return;
      }

      const newMediaItems: ContentMedia[] = [];
      const newPostsMap = new Map(posts);

      for (const post of newPosts) {
        const postId = post.content.id;
        const media = normalizeMediaFields(post.content, postId);
        
        if (media.length > 0) {
          newMediaItems.push(...media);
          newPostsMap.set(postId, {
            id: postId,
            media,
            stats: post.stats,
            viewer: post.viewer,
          });
        }
      }

      if (newMediaItems.length > 0) {
        setAllMedia(prev => [...prev, ...newMediaItems]);
        setPosts(newPostsMap);
        setOldestPostId(newPosts[newPosts.length - 1].content.id);
      }

      if (newPosts.length < 5) {
        setHasMore(false);
      }
    } catch (err) {
      console.error('Failed to load more posts:', err);
      setHasMore(false);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, oldestPostId, posts]);

  // Intersection Observer für Current Index
  React.useEffect(() => {
    if (allMedia.length === 0 || !containerRef.current) return;

    const options = {
      root: containerRef.current,
      threshold: 0.6,
    };

    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.getAttribute('data-media-index') || '0', 10);
          setCurrentIndex(idx);
        }
      });
    }, options);

    const items = containerRef.current.querySelectorAll('[data-media-index]');
    items.forEach((item) => observerRef.current?.observe(item));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [allMedia.length]);

  // Load More Trigger Observer
  React.useEffect(() => {
    if (!loadMoreTriggerRef.current || !hasMore) return;

    const loadMoreObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isLoadingMore) {
          loadMorePosts();
        }
      },
      { threshold: 0.1 }
    );

    loadMoreObserver.observe(loadMoreTriggerRef.current);

    return () => {
      loadMoreObserver.disconnect();
    };
  }, [hasMore, isLoadingMore, loadMorePosts]);

  // Auto-hide UI
  React.useEffect(() => {
    if (!uiVisible) return;
    const timer = setTimeout(() => setUiVisible(false), 3000);
    return () => clearTimeout(timer);
  }, [uiVisible, currentIndex]);

  // Keyboard Navigation
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        router.back();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

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
  }, [id, locale, router, session, currentIndex]);

  // Get current post data
  const currentMedia = allMedia[currentIndex];
  const currentPost = currentMedia ? posts.get(currentMedia.postId) : undefined;

  // Content
  let content: React.ReactNode;

  if (!ageOk) {
    content = <BlurredGate onStartVeriff={startAgeVerification} />;
  } else if (isLoading) {
    content = <MediaSkeleton />;
  } else if (allMedia.length === 0) {
    content = (
      <div className="flex-1 grid place-items-center text-white/70 bg-black">
        <div className="text-center">
          <div className="text-4xl mb-3">📷</div>
          <div>Keine Medien gefunden</div>
        </div>
      </div>
    );
  } else {
    content = (
      <div
        ref={containerRef}
        className="media-viewer-container flex-1 overflow-y-scroll snap-y snap-mandatory bg-black"
        style={{ 
          WebkitOverflowScrolling: 'touch', 
          overscrollBehaviorY: 'contain',
          scrollBehavior: 'smooth',
        }}
      >
        {allMedia.map((m, i) => {
          const isGif = m.kind === 'gif';
          const isVideoLike = m.kind === 'video' || isGif;
          const isCurrentItem = i === currentIndex;

          return (
            <div
              key={`${m.url}-${i}`}
              data-media-index={i}
              className="media-viewer-item relative snap-start snap-always w-full h-[100svh] flex items-center justify-center"
              onClick={() => setUiVisible(v => !v)}
            >
              {isVideoLike ? (
                <VideoPlayer
                  src={m.url}
                  className="max-h-[calc(100svh-120px)] max-w-[100vw] w-auto h-auto"
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
                  className="max-h-[calc(100svh-120px)] max-w-[100vw] w-auto h-auto object-contain select-none"
                  unoptimized
                  priority={i === startMediaIndex}
                  draggable={false}
                />
              )}

              {/* Index Pill */}
              <div className={`media-ui-fade absolute right-4 top-20 z-20 transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                <span className="inline-flex items-center gap-2 rounded-full bg-black/70 border border-white/20 px-3 py-1.5 text-sm font-medium backdrop-blur-sm">
                  <span className="text-white/90">{i + 1}</span>
                  <span className="text-white/40">/</span>
                  <span className="text-white/60">{allMedia.length}{hasMore ? '+' : ''}</span>
                </span>
              </div>

              {/* Gradients */}
              <div className={`media-ui-fade pointer-events-none absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-black/80 to-transparent transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`} />
              <div className={`media-ui-fade pointer-events-none absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${uiVisible ? 'opacity-100' : 'opacity-0'}`} />
            </div>
          );
        })}

        {/* Load More Trigger */}
        {hasMore && (
          <div 
            ref={loadMoreTriggerRef}
            className="w-full h-[100svh] flex items-center justify-center"
          >
            <div className="media-skeleton w-[90%] max-w-2xl aspect-[4/3] rounded-xl" />
          </div>
        )}

        {/* End of Feed */}
        {!hasMore && allMedia.length > 0 && (
          <div className="w-full h-[100svh] flex items-center justify-center text-white/50 text-sm">
            Keine weiteren Medien
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-black text-white flex flex-col overflow-hidden">
      <MediaDetailHeader fixed transparentOnHide={!uiVisible} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {content}
        
        {ageOk && allMedia.length > 0 && currentPost && (
          <PostActionsBar
            postId={currentPost.id}
            stats={currentPost.stats}
            viewer={currentPost.viewer}
            onCommentClick={() => router.push(`/${locale}/p/${currentPost.id}`)}
            transparentOnHide={!uiVisible}
          />
        )}
      </div>
    </div>
  );
}