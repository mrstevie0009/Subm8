//src/components/PostActionBar.tsx
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import BookmarkButton from '@/components/BookmarkButton';
import { likePostAction, unlikePostAction } from '@/app/actions/likes';
import { toast } from '@/lib/toast';
import { useParams } from 'next/navigation';

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-full w-full">
      <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
    </svg>
  );
}

function RepostIconFilled(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden {...props}>
      <path d="m 492.51,213.14 a 29,29 0 0 0 -41,0 l -24.38,24.38 V 89.06 a 29,29 0 0 0 -29,-29 H 161.89 a 29,29 0 0 0 0,58 h 207.23 v 119.46 l -24.38,-24.38 a 29,29 0 1 0 -41,41 L 377.61,328 a 29,29 0 0 0 41,0 l 73.88,-73.88 a 29,29 0 0 0 0.02,-40.98 z m -142.4,180.8 H 142.88 V 274.48 l 24.38,24.38 a 29,29 0 0 0 41,-41 L 134.39,184 a 29,29 0 0 0 -41,0 l -73.9,73.85 a 29,29 0 0 0 41,41 l 24.38,-24.38 v 148.47 a 29,29 0 0 0 29,29 h 236.24 a 29,29 0 0 0 0,-58 z" />
    </svg>
  );
}

function RepostIconOutline(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 512 512" fill="currentColor" aria-hidden {...props}>
      <path d="m 492.51,213.14 a 29,29 0 0 0 -41,0 l -24.38,24.38 V 89.06 a 29,29 0 0 0 -29,-29 H 161.89 a 29,29 0 0 0 0,58 h 207.23 v 119.46 l -24.38,-24.38 a 29,29 0 1 0 -41,41 L 377.61,328 a 29,29 0 0 0 41,0 l 73.88,-73.88 a 29,29 0 0 0 0.02,-40.98 z m -142.4,180.8 H 142.88 V 274.48 l 24.38,24.38 a 29,29 0 0 0 41,-41 L 134.39,184 a 29,29 0 0 0 -41,0 l -73.9,73.85 a 29,29 0 0 0 41,41 l 24.38,-24.38 v 148.47 a 29,29 0 0 0 29,29 h 236.24 a 29,29 0 0 0 0,-58 z" />
    </svg>
  );
}

function ShareIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v10" strokeLinecap="round" />
      <path d="M8.5 6.5 12 3l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="11" width="16" height="9" rx="2.5" />
    </svg>
  );
}

function usePulseFlag(ms = 650) {
  const [flag, setFlag] = React.useState(false);
  const fire = React.useCallback(() => {
    setFlag(true);
    window.setTimeout(() => setFlag(false), ms);
  }, [ms]);
  return [flag, fire] as const;
}

export default function PostActionsBar({
  postId,
  stats,
  viewer,
  onCommentClick,
  visible = true,
  likeTrigger = 0,
}: {
  postId: string;
  stats?: { likes?: number; comments?: number; reposts?: number };
  viewer?: { liked?: boolean; bookmarked?: boolean; reposted?: boolean };
  onCommentClick?: () => void;
  visible?: boolean;
  likeTrigger?: number;
}) {
  const tPost = useTranslations('post');
  const { locale } = useParams() as { locale: string };

  const SNAP_KEY = React.useMemo(() => `ps:snap:${postId}`, [postId]);

  const [likes, setLikes] = React.useState<number>(stats?.likes ?? 0);
  const [liked, setLiked] = React.useState<boolean>(!!viewer?.liked);
  const [comments, setComments] = React.useState<number>(stats?.comments ?? 0);
  const [reposts, setReposts] = React.useState<number>(stats?.reposts ?? 0);
  const [hasReposted, setHasReposted] = React.useState<boolean>(!!viewer?.reposted);
  const [reposting, setReposting] = React.useState(false);
  const [repostMenuOpen, setRepostMenuOpen] = React.useState(false);
  const [bookmarked, setBookmarked] = React.useState<boolean>(!!viewer?.bookmarked);

  const [likePulse, fireLikePulse] = usePulseFlag();
  const [repostPulse, fireRepostPulse] = usePulseFlag();
  const [bookmarkPulse, fireBookmarkPulse] = usePulseFlag();

  const hydratedRef = React.useRef(false);

  React.useEffect(() => {
    setLikes(stats?.likes ?? 0);
    setLiked(!!viewer?.liked);
    setComments(stats?.comments ?? 0);
    setReposts(stats?.reposts ?? 0);
    setHasReposted(!!viewer?.reposted);
    setBookmarked(!!viewer?.bookmarked);
    setRepostMenuOpen(false);
    setReposting(false);
    hydratedRef.current = false;
  }, [postId, stats, viewer]);

  React.useEffect(() => {
    const hasPropsStats =
      typeof stats?.likes === 'number' ||
      typeof stats?.comments === 'number' ||
      typeof stats?.reposts === 'number';

    const hasPropsViewer =
      typeof viewer?.liked === 'boolean' ||
      typeof viewer?.bookmarked === 'boolean' ||
      typeof viewer?.reposted === 'boolean';

    if (hasPropsStats || hasPropsViewer) {
      hydratedRef.current = true;
      try {
        sessionStorage.setItem(
          SNAP_KEY,
          JSON.stringify({
            likes: stats?.likes ?? 0,
            comments: stats?.comments ?? 0,
            reposts: stats?.reposts ?? 0,
            liked: !!viewer?.liked,
            hasReposted: !!viewer?.reposted,
            bookmarked: !!viewer?.bookmarked,
          })
        );
      } catch {}
    }
  }, [SNAP_KEY, stats, viewer]);

  React.useEffect(() => {
    if (hydratedRef.current) return;
    try {
      const raw = sessionStorage.getItem(SNAP_KEY);
      if (!raw) return;

      const s = JSON.parse(raw) as {
        likes?: number;
        comments?: number;
        reposts?: number;
        liked?: boolean;
        hasReposted?: boolean;
        bookmarked?: boolean;
      };

      if (typeof s.likes === 'number') setLikes(s.likes);
      if (typeof s.comments === 'number') setComments(s.comments);
      if (typeof s.reposts === 'number') setReposts(s.reposts);
      if (typeof s.liked === 'boolean') setLiked(s.liked);
      if (typeof s.hasReposted === 'boolean') setHasReposted(s.hasReposted);
      if (typeof s.bookmarked === 'boolean') setBookmarked(s.bookmarked);

      hydratedRef.current = true;
    } catch {}
  }, [SNAP_KEY]);

  React.useEffect(() => {
    if (hydratedRef.current) return;

    let aborted = false;

    (async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/meta`, { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (aborted || !j) return;

        if (j.stats) {
          if (typeof j.stats.likes === 'number') setLikes(j.stats.likes);
          if (typeof j.stats.comments === 'number') setComments(j.stats.comments);
          if (typeof j.stats.reposts === 'number') setReposts(j.stats.reposts);
        }

        if (j.viewer) {
          if (typeof j.viewer.liked === 'boolean') setLiked(j.viewer.liked);
          if (typeof j.viewer.reposted === 'boolean') setHasReposted(j.viewer.reposted);
          if (typeof j.viewer.bookmarked === 'boolean') setBookmarked(j.viewer.bookmarked);
        }

        hydratedRef.current = true;
      } catch {}
    })();

    return () => {
      aborted = true;
    };
  }, [postId]);

  const saveSnapshot = React.useCallback(() => {
    try {
      sessionStorage.setItem(
        SNAP_KEY,
        JSON.stringify({ likes, liked, comments, reposts, hasReposted, bookmarked })
      );
    } catch {}
  }, [SNAP_KEY, likes, liked, comments, reposts, hasReposted, bookmarked]);

  React.useEffect(() => {
    const id = window.setTimeout(saveSnapshot, 60);
    return () => window.clearTimeout(id);
  }, [saveSnapshot]);

  React.useEffect(() => {
    const onLike = (ev: Event) => {
      const ce = ev as CustomEvent<{ contentId: string; liked: boolean; delta: number; byViewer?: boolean }>;
      if (ce?.detail?.contentId !== postId) return;

      if (ce.detail.byViewer) {
        setLiked(!!ce.detail.liked);
        return;
      }

      setLikes((n) => Math.max(0, n + (ce.detail.delta ?? 0)));
    };

    window.addEventListener('post:likeToggle', onLike as EventListener);
    return () => window.removeEventListener('post:likeToggle', onLike as EventListener);
  }, [postId]);

  React.useEffect(() => {
    const onComment = (ev: Event) => {
      const ce = ev as CustomEvent<{ contentId: string; delta: number }>;
      if (ce?.detail?.contentId !== postId) return;
      setComments((n) => Math.max(0, n + (ce.detail.delta ?? 0)));
    };

    window.addEventListener('post:commentDelta', onComment as EventListener);
    return () => window.removeEventListener('post:commentDelta', onComment as EventListener);
  }, [postId]);

  React.useEffect(() => {
    const onBm = (ev: Event) => {
      const ce = ev as CustomEvent<{ postId: string; value: boolean }>;
      if (ce?.detail?.postId !== postId) return;
      setBookmarked(ce.detail.value);
      fireBookmarkPulse();
    };

    window.addEventListener('bookmark:toggled', onBm as EventListener);
    return () => window.removeEventListener('bookmark:toggled', onBm as EventListener);
  }, [postId, fireBookmarkPulse]);

  const [pendingLike, startLikeTransition] = React.useTransition();
  const lastHandledLikeTriggerRef = React.useRef(0);

  React.useEffect(() => {
    lastHandledLikeTriggerRef.current = 0;
  }, [postId]);

  const applyLikeState = React.useCallback(
    (willLike: boolean) => {
      startLikeTransition(() => {
        setLiked(willLike);
        setLikes((n) => Math.max(0, n + (willLike ? 1 : -1)));
      });

      fireLikePulse();

      try {
        window.dispatchEvent(
          new CustomEvent('post:likeToggle', {
            detail: {
              contentId: postId,
              liked: willLike,
              delta: willLike ? +1 : -1,
              byViewer: true,
            },
          })
        );
      } catch {}
    },
    [postId, fireLikePulse]
  );

  const submitLikeToServer = React.useCallback(
    async (willLike: boolean) => {
      try {
        const fd = new FormData();
        fd.set('postId', postId);

        if (willLike) {
          await likePostAction(fd);
        } else {
          await unlikePostAction(fd);
        }
      } catch {
        startLikeTransition(() => {
          setLiked(!willLike);
          setLikes((n) => Math.max(0, n + (willLike ? -1 : +1)));
        });

        try {
          window.dispatchEvent(
            new CustomEvent('post:likeToggle', {
              detail: {
                contentId: postId,
                liked: !willLike,
                delta: willLike ? -1 : +1,
                byViewer: true,
              },
            })
          );
        } catch {}

        toast.error(willLike ? tPost('likeFailed') : tPost('unlikeFailed'));
      }
    },
    [postId, tPost]
  );

  const toggleLike = React.useCallback(
    (forceLike?: boolean) => {
      if (pendingLike) return;

      const willLike = typeof forceLike === 'boolean' ? forceLike : !liked;
      if (willLike === liked) return;

      applyLikeState(willLike);
      void submitLikeToServer(willLike);
    },
    [pendingLike, liked, applyLikeState, submitLikeToServer]
  );

  React.useEffect(() => {
    if (!likeTrigger) return;
    if (likeTrigger === lastHandledLikeTriggerRef.current) return;

    lastHandledLikeTriggerRef.current = likeTrigger;

    if (!liked) {
      toggleLike(true);
    }
  }, [likeTrigger, liked, toggleLike]);

  function LikeForm() {
    return (
      <form
        data-no-nav
        onSubmit={(e) => {
          e.preventDefault();
          toggleLike();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input type="hidden" name="postId" value={postId} />
        <button
          type="submit"
          disabled={pendingLike}
          className={`actify like ${liked ? 'is-active' : ''} ${likePulse ? 'do-pop' : ''} inline-flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-white/5 disabled:opacity-50`}
          aria-pressed={liked || undefined}
        >
          <span
            className="inline-grid place-items-center"
            style={{
              width: '22px',
              height: '22px',
              color: liked ? 'var(--purple)' : 'rgba(255,255,255,.95)',
            }}
            aria-hidden
          >
            <HeartIcon />
          </span>
          <span className="text-sm" style={{ color: liked ? 'var(--purple)' : 'var(--muted)' }}>
            {likes}
          </span>
          <span className="sr-only">{liked ? tPost('unlike') : tPost('like')}</span>
        </button>
      </form>
    );
  }

  function CommentButton() {
    return (
      <button
        type="button"
        data-no-nav
        onClick={(e) => {
          e.stopPropagation();
          if (onCommentClick) {
            onCommentClick();
          } else {
            const url = `/${locale}/p/${postId}`;
            try {
              window.location.assign(url);
            } catch {}
          }
        }}
        className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-white/5"
        aria-label={tPost('comment')}
      >
        <span className="inline-grid place-items-center h-[22px] w-[22px]" aria-hidden>
          <CommentIcon />
        </span>
        <span className="text-sm text-white/85">{comments}</span>
      </button>
    );
  }

  async function doRepost() {
    if (reposting) return;

    setRepostMenuOpen(false);
    setReposting(true);
    setReposts((n) => n + 1);
    setHasReposted(true);
    fireRepostPulse();

    try {
      const resp = await fetch(`/api/posts/${postId}/repost`, { method: 'POST' });
      const j = await resp.json().catch(() => null);

      if (!resp.ok || !j?.ok) {
        throw new Error(j?.error || `HTTP ${resp.status}`);
      }

      try {
        window.dispatchEvent(
          new CustomEvent('post:repostDelta', {
            detail: { contentId: postId, delta: +1, byViewer: true },
          })
        );
      } catch {}
    } catch {
      setReposts((n) => Math.max(0, n - 1));
      setHasReposted(false);
      toast.error(tPost('repostFailed') as string);
    } finally {
      setReposting(false);
    }
  }

  const shareUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/p/${postId}`
      : `/${locale}/p/${postId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(tPost('share.copied'));
    } catch {}
  };

  return (
    <div
      className={[
        'fixed inset-x-0 bottom-0 z-[60] transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-3',
      ].join(' ')}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent" />

      <div className="relative mx-auto w-full max-w-5xl px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] sm:px-6">
        <div
          className="mx-auto flex items-center justify-between gap-2 px-0 py-0"
          onClick={(e) => e.stopPropagation()}
        >
          <CommentButton />

          <div className="relative" data-no-nav>
            <button
              type="button"
              className={`actify repost ${hasReposted ? 'is-active' : ''} ${repostPulse ? 'do-pop' : ''} inline-flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-white/5 disabled:opacity-50`}
              onClick={() => setRepostMenuOpen((v) => !v)}
              disabled={reposting}
              aria-expanded={repostMenuOpen || undefined}
            >
              <span
                className="inline-grid place-items-center h-[22px] w-[22px]"
                style={{ color: hasReposted ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}
                aria-hidden
              >
                {hasReposted ? (
                  <RepostIconFilled className="h-full w-full" />
                ) : (
                  <RepostIconOutline className="h-full w-full" />
                )}
              </span>
              <span className="text-sm" style={{ color: hasReposted ? 'var(--purple)' : 'var(--muted)' }}>
                {reposts}
              </span>
              <span className="sr-only">{tPost('repost')}</span>
            </button>

            {repostMenuOpen ? (
              <div
                className="absolute bottom-full left-0 z-50 mb-2 w-40 rounded-xl border border-white/10 bg-black/85 p-1 backdrop-blur-xl shadow-xl"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/10 disabled:opacity-50"
                  disabled={reposting}
                  onClick={() => void doRepost()}
                >
                  {tPost('repost')}
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/10"
                  onClick={() => {
                    setRepostMenuOpen(false);
                    fireRepostPulse();
                    toast.show({
                      title: tPost('quotePost'),
                      message: tPost('comingSoon') as string,
                    });
                  }}
                >
                  {tPost('quotePost')}
                </button>
              </div>
            ) : null}
          </div>

          <LikeForm />

          <div className="ml-auto flex items-center gap-1">
            <div
              data-no-nav
              className={`actify bookmark ${bookmarked ? 'is-active' : ''} ${bookmarkPulse ? 'do-pop' : ''} rounded-xl`}
              title={bookmarked ? 'Bookmarked' : undefined}
            >
              <BookmarkButton postId={postId} initiallyBookmarked={bookmarked} />
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="actify inline-flex items-center gap-2 rounded-xl px-2.5 py-2 hover:bg-white/5"
              data-no-nav
            >
              <span
                className="inline-grid place-items-center h-[22px] w-[22px]"
                style={{ color: 'rgba(255,255,255,.95)' }}
                aria-hidden
              >
                <ShareIcon />
              </span>
              <span className="sr-only">{tPost('share.copy')}</span>
            </button>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .actify {
          position: relative;
          border-radius: 12px;
          transition: transform 120ms ease, opacity 220ms ease;
        }

        @keyframes actify-pop {
          0% {
            transform: scale(1);
          }
          40% {
            transform: scale(1.08);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes actify-burst {
          0% {
            opacity: 0.9;
            transform: translate(-50%, -50%) scale(0.6) rotate(0deg);
          }
          70% {
            opacity: 0.7;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(1.25) rotate(25deg);
          }
        }

        .actify.do-pop {
          animation: actify-pop 380ms ease;
        }

        .actify.do-pop::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          width: 140%;
          height: 140%;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.9) 0 3px, transparent 4px) 50% 10%/8px 8px no-repeat,
            radial-gradient(circle at 0% 50%, rgba(255, 255, 255, 0.9) 0 3px, transparent 4px) 10% 50%/8px 8px no-repeat,
            radial-gradient(circle at 100% 50%, rgba(255, 255, 255, 0.9) 0 3px, transparent 4px) 90% 50%/8px 8px no-repeat,
            radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.9) 0 3px, transparent 4px) 50% 90%/8px 8px no-repeat;
          animation: actify-burst 450ms ease forwards;
          z-index: 0;
        }

        .actify > * {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </div>
  );
}