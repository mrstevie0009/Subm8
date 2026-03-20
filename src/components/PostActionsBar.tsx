//src/components/PostActionsBar.tsx
'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import BookmarkButton from '@/components/BookmarkButton';
import { likePostAction, unlikePostAction } from '@/app/actions/likes';
import { toast } from '@/lib/toast';
import { useParams } from 'next/navigation';

/* ── Icons (gleich wie in PostCard) ─────────────────────────────────── */
function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
      <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
    </svg>
  );
}
function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
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

/* ── kleine Helfer wie in PostCard ─────────────────────────────────── */
function usePulseFlag(ms = 650) {
  const [flag, setFlag] = React.useState(false);
  const fire = React.useCallback(() => {
    setFlag(true);
    window.setTimeout(() => setFlag(false), ms);
  }, [ms]);
  return [flag, fire] as const;
}

/* ── Komponente ────────────────────────────────────────────────────── */
export default function PostActionsBar({
  postId,
  stats,
  viewer,
  onCommentClick,
  transparentOnHide = false,
}: {
  postId: string;
  stats?: { likes?: number; comments?: number; reposts?: number };
  viewer?: { liked?: boolean; bookmarked?: boolean; reposted?: boolean };
  onCommentClick?: () => void;
  transparentOnHide?: boolean;
}) {
  const tPost = useTranslations('post');
  const { locale } = useParams() as { locale: string };

  const SNAP_KEY = React.useMemo(() => `ps:snap:${postId}`, [postId]);

  // ---- State (identisch zu PostCard) --------------------------------
  const [likes, setLikes] = React.useState<number>(stats?.likes ?? 0);
  const [liked, setLiked] = React.useState<boolean>(!!viewer?.liked);

  const [comments, setComments] = React.useState<number>(stats?.comments ?? 0);

  const [reposts, setReposts] = React.useState<number>(stats?.reposts ?? 0);
  const [hasReposted, setHasReposted] = React.useState<boolean>(!!viewer?.reposted);
  const [reposting, setReposting] = React.useState(false);
  const [repostMenuOpen, setRepostMenuOpen] = React.useState(false);

  const [bookmarked, setBookmarked] = React.useState<boolean>(!!viewer?.bookmarked);

  // Animations
  const [likePulse, fireLikePulse] = usePulseFlag();
  const [repostPulse, fireRepostPulse] = usePulseFlag();
  const [bookmarkPulse, fireBookmarkPulse] = usePulseFlag();

  // ---------------- Hydration-Priorität ----------------
  // 1) Props (stats/viewer)
  // 2) sessionStorage Snapshot (ps:snap:<id>)
  // 3) Fallback-Fetch /api/posts/:id/meta (nur wenn noch nicht hydriert)
  const hydratedRef = React.useRef(false);

  // Wenn Props bereits echte Werte liefern, markieren & initialen Snapshot schreiben
  React.useEffect(() => {
    const hasPropsStats =
      (typeof stats?.likes === 'number') ||
      (typeof stats?.comments === 'number') ||
      (typeof stats?.reposts === 'number');
    const hasPropsViewer =
      (typeof viewer?.liked === 'boolean') ||
      (typeof viewer?.bookmarked === 'boolean') ||
      (typeof viewer?.reposted === 'boolean');

    if (hasPropsStats || hasPropsViewer) {
      hydratedRef.current = true;
      // Initial gleich persistieren, damit die Media-Seite sofort lesen kann
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

  // Snapshot aus Session lesen, falls Props nichts geliefert haben
  React.useEffect(() => {
    if (hydratedRef.current) return;
    try {
      const raw = sessionStorage.getItem(SNAP_KEY);
      if (raw) {
        const s = JSON.parse(raw) as {
          likes?: number; comments?: number; reposts?: number;
          liked?: boolean; hasReposted?: boolean; bookmarked?: boolean;
        };
        if (typeof s.likes === 'number') setLikes(s.likes);
        if (typeof s.comments === 'number') setComments(s.comments);
        if (typeof s.reposts === 'number') setReposts(s.reposts);
        if (typeof s.liked === 'boolean') setLiked(s.liked);
        if (typeof s.hasReposted === 'boolean') setHasReposted(s.hasReposted);
        if (typeof s.bookmarked === 'boolean') setBookmarked(s.bookmarked);
        hydratedRef.current = true;
      }
    } catch {}
  }, [SNAP_KEY]);

  // Fallback-Fetch nur, wenn weder Props noch Session hydriert haben
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
          if (typeof j.stats.likes === 'number')    setLikes(j.stats.likes);
          if (typeof j.stats.comments === 'number') setComments(j.stats.comments);
          if (typeof j.stats.reposts === 'number')  setReposts(j.stats.reposts);
        }
        if (j.viewer) {
          if (typeof j.viewer.liked === 'boolean')      setLiked(j.viewer.liked);
          if (typeof j.viewer.reposted === 'boolean')   setHasReposted(j.viewer.reposted);
          if (typeof j.viewer.bookmarked === 'boolean') setBookmarked(j.viewer.bookmarked);
        }
        hydratedRef.current = true;
      } catch {}
    })();
    return () => { aborted = true; };
  }, [postId]);

  // ---------------- Snapshot-Persist (debounced) ----------------
  const saveSnapshot = React.useCallback(() => {
    try {
      const snap = { likes, liked, comments, reposts, hasReposted, bookmarked };
      sessionStorage.setItem(SNAP_KEY, JSON.stringify(snap));
    } catch {}
  }, [SNAP_KEY, likes, liked, comments, reposts, hasReposted, bookmarked]);

  React.useEffect(() => {
    const id = window.setTimeout(saveSnapshot, 60);
    return () => window.clearTimeout(id);
  }, [saveSnapshot]);

  // ---------------- Globale Event-Syncs ----------------
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
      const ce = ev as CustomEvent<{ contentId: string; delta: number; byViewer?: boolean }>;
      if (ce?.detail?.contentId !== postId) return;
      setComments((n) => Math.max(0, n + (ce.detail.delta ?? 0)));
    };
    window.addEventListener('post:commentDelta', onComment as EventListener);
    return () => window.removeEventListener('post:commentDelta', onComment as EventListener);
  }, [postId]);

  React.useEffect(() => {
    const onComment = (ev: Event) => {
      const ce = ev as CustomEvent<{ contentId: string; delta: number; byViewer?: boolean }>;
      if (ce?.detail?.contentId !== postId) return;
      // Zähler IMMER anpassen (auch wenn byViewer), kein "aktiv"-State mehr
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

  // ---------------- Actions ----------------
  const [pendingLike, startLikeTransition] = React.useTransition();

  function LikeForm() {
    const action = liked ? unlikePostAction : likePostAction;

    return (
      <form
        data-no-nav
        action={action}
        onSubmit={() => {
          const willLike = !liked;
          startLikeTransition(() => {
            setLiked((v) => !v);
            setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
          });
          fireLikePulse();
          try {
            window.dispatchEvent(
              new CustomEvent('post:likeToggle', {
                detail: { contentId: postId, liked: willLike, delta: willLike ? +1 : -1, byViewer: true },
              })
            );
          } catch {}
          // Snapshot wird vom Effect gespeichert
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input type="hidden" name="postId" value={postId} />
        <button
          type="submit"
          disabled={pendingLike}
          className={`actify like ${liked ? 'is-active' : ''} ${likePulse ? 'do-pop' : ''} group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50`}
          aria-pressed={liked || undefined}
        >
          <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)', color: liked ? 'var(--purple)' : 'rgba(255,255,255,.95)' }} aria-hidden>
            <HeartIcon />
          </span>
          <span className="text-sm" style={{ color: liked ? 'var(--purple)' : 'var(--muted)' }}>{likes}</span>
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
            try { window.location.assign(url); } catch {}
          }
        }}
        className="flex items-center gap-2 px-2 py-1 text-sm hover:underline"
        aria-label={tPost('comment')}
      >
        <span
          className="inline-grid place-items-center"
          style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }}
          aria-hidden
        >
          <CommentIcon />
        </span>
        <span className="text-sm">{comments}</span>
      </button>
    );
  }

  const btnRepostRef = React.useRef<HTMLButtonElement>(null);
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
      if (!resp.ok || !j?.ok) throw new Error(j?.error || `HTTP ${resp.status}`);
      try {
        window.dispatchEvent(new CustomEvent('post:repostDelta', { detail: { contentId: postId, delta: +1, byViewer: true } }));
      } catch {}
    } catch {
      setReposts((n) => Math.max(0, n - 1));
      setHasReposted(false);
      toast.error(tPost('repostFailed') as string);
    } finally {
      setReposting(false);
      // Snapshot speichert der Effect
    }
  }

  // ---------------- Share ----------------
  const shareUrl = typeof window !== 'undefined' ? `${window.location.origin}/${locale}/p/${postId}` : `/${locale}/p/${postId}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success(tPost('share.copied'));
    } catch {}
  };

  // ---------------- Render ----------------
  return (
    <div className={`fixed inset-x-0 bottom-0 z-50 transition-all duration-300 ${transparentOnHide ? 'bg-transparent border-transparent' : 'bg-black/80 backdrop-blur-md border-t border-white/10'}`}>
      <div className="max-w-2xl mx-auto px-3">

        <div className="flex items-center justify-between gap-3 py-2" onClick={(e) => e.stopPropagation()}>
          {/* Comment */}
          <CommentButton />

          {/* Repost (mit Popover) */}
          <div className="relative" data-no-nav>
            <button
              ref={btnRepostRef}
              type="button"
              className={`actify repost ${hasReposted ? 'is-active' : ''} ${repostPulse ? 'do-pop' : ''} group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50`}
              onClick={() => setRepostMenuOpen((v) => !v)}
              disabled={reposting}
              aria-expanded={repostMenuOpen || undefined}
            >
              <span
                className="inline-grid place-items-center"
                style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)', color: hasReposted ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}
                aria-hidden
              >
                {hasReposted ? <RepostIconFilled className="w-full h-full" /> : <RepostIconOutline className="w-full h-full" />}
              </span>
              <span className="text-sm" style={{ color: hasReposted ? 'var(--purple)' : 'var(--muted)' }}>{reposts}</span>
              <span className="sr-only">{tPost('repost')}</span>
            </button>

            {repostMenuOpen && (
              <div
                className="absolute left-0 bottom-full mb-2 z-50 w-40 rounded-lg border border-white/10 bg-black/80 backdrop-blur p-1 shadow-lg"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
                  disabled={reposting}
                  onClick={() => void doRepost()}
                >
                  {tPost('repost')}
                </button>
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
                  onClick={() => {
                    setRepostMenuOpen(false);
                    fireRepostPulse();
                    toast.show({ title: tPost('quotePost'), message: tPost('comingSoon') as string });
                  }}
                >
                  {tPost('quotePost')}
                </button>
              </div>
            )}
          </div>

          {/* Like */}
          <LikeForm />

          {/* rechts: Bookmark + Share */}
          <div className="ml-auto flex items-center gap-3">
            <div
              data-no-nav
              className={`actify bookmark ${bookmarked ? 'is-active' : ''} ${bookmarkPulse ? 'do-pop' : ''}`}
              title={bookmarked ? 'Bookmarked' : undefined}
            >
              <BookmarkButton postId={postId} initiallyBookmarked={bookmarked} />
            </div>

            <button
              type="button"
              onClick={copyLink}
              className="actify group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
              data-no-nav
            >
              <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)', color: 'rgba(255,255,255,.95)' }} aria-hidden>
                <ShareIcon />
              </span>
              <span className="sr-only">{tPost('share.copy')}</span>
            </button>
          </div>
        </div>

        {/* Safe-Area für iOS */}
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>

      {/* Globale Actify-Styles */}
      <style jsx global>{`
        .actify { position: relative; border-radius: 10px; transition: transform 120ms ease, opacity 220ms ease; }
        @keyframes actify-pop { 0%{transform:scale(1)} 40%{transform:scale(1.08)} 100%{transform:scale(1)} }
        @keyframes actify-burst {
          0% { opacity:.9; transform:translate(-50%,-50%) scale(.6) rotate(0deg); }
          70% { opacity:.7; }
          100% { opacity:0; transform:translate(-50%,-50%) scale(1.25) rotate(25deg); }
        }
        .actify.do-pop { animation: actify-pop 380ms ease; }
        .actify.do-pop::after {
          content:''; position:absolute; left:50%; top:50%; width:140%; height:140%; pointer-events:none;
          background:
            radial-gradient(circle at 50% 0%, rgba(255,255,255,.9) 0 3px, transparent 4px) 50% 10%/8px 8px no-repeat,
            radial-gradient(circle at 0% 50%, rgba(255,255,255,.9) 0 3px, transparent 4px) 10% 50%/8px 8px no-repeat,
            radial-gradient(circle at 100% 50%, rgba(255,255,255,.9) 0 3px, transparent 4px) 90% 50%/8px 8px no-repeat,
            radial-gradient(circle at 50% 100%, rgba(255,255,255,.9) 0 3px, transparent 4px) 50% 90%/8px 8px no-repeat;
          animation: actify-burst 450ms ease forwards; z-index:0;
        }
        .actify > * { position: relative; z-index: 1; }
      `}</style>
    </div>
  );
}

