//src/components/PostCard.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import ProfileLink from '@/components/ProfileLink';
import BookmarkButton from '@/components/BookmarkButton';
import { likePostAction, unlikePostAction } from '@/app/actions/likes';
import CommentComposer from '@/components/comments/CommentComposer';
import { reportPostAction } from '@/app/actions/reports';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import { pinPostAction, unpinPostAction } from '@/app/actions/pin-post';
import RichText from '@/components/RichText';
import QuoteOverlay from '@/components/quotes/QuoteOverlay';
import VideoPlayer from '@/components/VideoPlayer';

const AVATAR_PH = '/images/avatar-placeholder.png';

/** —— Gemeinsames Feed-Shape (inkl. optionaler Quote) —— */
export type FeedPost = {
  id: string;
  createdAtISO: string;
  content: {
    id: string;
    text: string;
    mediaUrl?: string | null;
    mediaAlt?: string | null;
    createdAt: string;
    author: {
      id: string;
      handle: string;
      displayName: string;
      role?: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl?: string | null;
    };
    quote?: {
      id: string;
      text: string;
      mediaUrl?: string | null;
      mediaAlt?: string | null;
      createdAt: string;
      author: {
        id: string;
        handle: string;
        displayName: string;
        role?: 'DOMME' | 'SUBMISSIVE' | null;
        avatarUrl?: string | null;
      };
    } | null;
  };
  reposter: { id: string; handle: string; displayName: string } | null;
  stats?: { comments?: number; reposts?: number; likes?: number };
  viewer?: {
    liked?: boolean;
    bookmarked?: boolean;
    hasBlockedAuthor?: boolean;
    blockedByAuthor?: boolean;
  };
  initiallyBookmarked?: boolean;
  community?: { name: string; slug: string } | null;
};

/** --- Fix: Form-Action-Signatur für Server Actions an React angleichen --- */
type VoidFormAction = (formData: FormData) => void | Promise<void>;
const pinPostFormAction = pinPostAction as unknown as VoidFormAction;
const unpinPostFormAction = unpinPostAction as unknown as VoidFormAction;

function Counter({ value = 0, active }: { value?: number; active?: boolean }) {
  return (
    <span className="text-sm" style={{ color: active ? 'var(--purple)' : 'var(--muted)' }}>
      {value ?? 0}
    </span>
  );
}

/** Lokalisierte Kurzzeit-Angabe: now / 5m / 2h / 3d */
function timeAgoShort(iso: string, tTime: ReturnType<typeof useTranslations>) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return tTime('time.now');
  if (m < 60) return tTime('time.m', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tTime('time.h', { count: h });
  const d = Math.floor(h / 24);
  return tTime('time.d', { count: d });
}

/* ----------------------------- Icons ----------------------------- */
function BanIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm5.657 3.343L6.343 17.657M5.3 9.9a7 7 0 0 1 8.8-4.6m4.6 8.8a7 7 0 0 1-8.8 4.6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function ShieldOffIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path d="M19.5 12.5v-6l-7.5-3-7.5 3v6c0 4.2 3.2 7.7 7.5 8 1.6-.11 3.2-.71 4.5-1.66M3 3l18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function RepostBadgeIcon({
  size = 22,
  strokeWidth = 1.9,
}: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 7h9" />
      <path d="M16 7l-2-2" />
      <path d="M16 7l-2 2" />
      <path d="M17 17H8" />
      <path d="M8 17l2-2" />
      <path d="M8 17l2 2" />
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

/* ------------------------ Blockstatus-Badges ------------------------ */
function BlockBadges({
  hasBlockedAuthor,
  blockedByAuthor,
  tPost,
}: {
  hasBlockedAuthor: boolean;
  blockedByAuthor: boolean;
  tPost: ReturnType<typeof useTranslations>;
}) {
  if (!hasBlockedAuthor && !blockedByAuthor) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1" data-no-nav>
      {hasBlockedAuthor && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
          <BanIcon /> {tPost('block.youBlock')}
        </span>
      )}
      {blockedByAuthor && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
          <ShieldOffIcon /> {tPost('block.blocksYou')}
        </span>
      )}
    </span>
  );
}

/* ------------------------ Media Helper ------------------------ */
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

/** Media-Renderer */
function MediaView({
  url,
  alt,
  priority = false,
}: { url?: string | null; alt?: string | null; priority?: boolean }) {
  if (!url) return null;

  if (isVideoUrl(url)) {
    const stop = (e: React.SyntheticEvent) => { e.stopPropagation(); };
    return (
      <figure
        className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20"
        data-no-nav
        onClick={stop}
        onDoubleClick={stop}
        onPointerDownCapture={stop}
        onKeyDownCapture={(e) => {
          if ((e as React.KeyboardEvent).key === ' ' || (e as React.KeyboardEvent).key === 'Enter') {
            e.stopPropagation();
          }
        }}
      >
        <VideoPlayer src={url} className="w-full h-auto max-h-[65vh] sm:max-h-[70vh]" />
      </figure>
    );
  }

  if (isGifUrl(url)) {
    return (
      <figure className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={alt ?? ''}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="block mx-auto h-auto w-auto max-w-full max-h-[65vh] sm:max-h-[70vh] object-contain"
        />
      </figure>
    );
  }

  return (
    <figure className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
      <div className="relative w-full">
        <Image
          src={url}
          alt={alt ?? ''}
          width={1200}
          height={900}
          className="block mx-auto h-auto w-auto max-w-full max-h-[65vh] sm:max-h-[70vh]"
          priority={priority}
          draggable={false}
        />
      </div>
    </figure>
  );
}

/* ------------------- DM Share Overlay ------------------- */
function DMShareOverlay({
  open,
  onClose,
  postId,
  locale,
}: {
  open: boolean;
  onClose: () => void;
  postId: string;
  locale: string;
}) {
  const tPost = useTranslations('post');

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<Array<{
    id: string;
    other: { username: string; displayName: string; avatarUrl: string | null };
    lastMessageAt: string;
  }>>([]);

  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/chat', { cache: 'no-store' });
        const j = await res.json();
        if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
        if (!cancelled) setItems(j.items || []);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load chats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    const base = !qq
      ? items
      : items.filter(i =>
          i.other.displayName.toLowerCase().includes(qq) ||
          i.other.username.toLowerCase().includes(qq)
        );
    return base.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [items, q]);

  const postUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/${locale}/p/${postId}`
      : `/${locale}/p/${postId}`;

  async function send() {
    if (selected.size === 0) return;
    try {
      setSending(true);
      setError(null);
      const ids = Array.from(selected);
      await Promise.all(
        ids.map((conversationId) =>
          fetch('/api/chat/share-link', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ conversationId, postId, url: postUrl, note: note.trim() || undefined }),
          }).then(async (r) => {
            if (!r.ok) {
              const j = await r.json().catch(() => null);
              throw new Error(j?.error || `HTTP ${r.status}`);
            }
          })
        )
      );
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483602]"
      data-no-nav
      role="dialog"
      aria-modal="true"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onMouseDown={(e) => e.stopPropagation()}
      />
      {/* Panel */}
      <div
        className="absolute left-1/2 top-1/2 w-[min(720px,94vw)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#0b0b0d] p-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-2 py-2 border-b border-white/10">
          <div className="text-[18px] font-semibold">{tPost('share.dmTitle')}</div>
          <div className="mt-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={tPost('share.searchPlaceholder')}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
            />
          </div>
        </div>

        <div className="mt-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
          {loading && <div className="px-3 py-6 text-sm text-white/70">{tPost('share.loadingChats')}</div>}
          {!loading && error && <div className="px-3 py-3 text-sm text-red-400">{error}</div>}

          {!loading && !error && filtered.length === 0 && (
            <div className="px-3 py-6 text-sm text-white/70">{tPost('share.empty')}</div>
          )}

          <ul className="divide-y divide-white/10">
            {filtered.map((c) => {
              const checked = selected.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5"
                    onClick={() => toggle(c.id)}
                  >
                    <div className="relative size-10 overflow-hidden rounded-full bg-white/10 shrink-0">
                      <Image
                        src={c.other.avatarUrl || AVATAR_PH}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="40px"
                      />
                    </div>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="font-medium truncate">{c.other.displayName}</div>
                      <div className="text-sm text-white/70 truncate">@{c.other.username}</div>
                    </div>
                    <span
                      className={`grid place-items-center rounded-full border ${
                        checked ? 'bg-[var(--purple)] border-[var(--purple)]' : 'border-white/25'
                      }`}
                      style={{ width: 22, height: 22 }}
                      aria-hidden
                    >
                      {checked ? (
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="3">
                          <path d="M5 12.5 10 17l9-10" />
                        </svg>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="px-3 pt-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={200}
            placeholder={tPost('share.notePlaceholder')}
            className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
          />
        </div>

        <div className="px-3 pb-2 pt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
            disabled={sending}
          >
            {tPost('share.cancel')}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void send(); }}
            disabled={sending || selected.size === 0}
            className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50"
          >
            {sending ? tPost('share.sending') : tPost('share.send')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ---------------------- PostCard ---------------------- */
export default function PostCard({
  post,
  pinnedPostId,
}: { post: FeedPost; pinnedPostId?: string | null }) {
  const router = useRouter();
  const params = useParams() as { locale: string; handle?: string };
  const { locale, handle } = params;

  const t = useTranslations();       // Root (common.json)
  const tPost = useTranslations('post');
  const tTime = useTranslations();    // time.* liegen im Root

  const c = post.content;
  const uiRole = c.author.role === 'DOMME' ? 'domme' : c.author.role === 'SUBMISSIVE' ? 'submissive' : undefined;

  // STATE
  const [likes, setLikes] = React.useState<number>(post.stats?.likes ?? 0);
  const [liked, setLiked] = React.useState<boolean>(!!post.viewer?.liked);
  const [comments, setComments] = React.useState<number>(post.stats?.comments ?? 0);
  const [composerOpen, setComposerOpen] = React.useState<boolean>(false);
  const [reposts, setReposts] = React.useState<number>(post.stats?.reposts ?? 0);
  const [repostMenuOpen, setRepostMenuOpen] = React.useState<boolean>(false);
  const [quoteOpen, setQuoteOpen] = React.useState(false);
  const [moreOpen, setMoreOpen] = React.useState(false);

  const [reposting, setReposting] = React.useState(false);
  const [isPinned, setIsPinned] = React.useState<boolean>(false);

  const [shareMenuOpen, setShareMenuOpen] = React.useState(false);
  const [dmShareOpen, setDmShareOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const initialHasBlocked = !!post.viewer?.hasBlockedAuthor;
  const initialBlockedByAuthor = !!post.viewer?.blockedByAuthor;
  const [hasBlockedAuthor, setHasBlockedAuthor] = React.useState<boolean>(initialHasBlocked);
  const blockedByEither = initialBlockedByAuthor || hasBlockedAuthor;

  const [avatarSrc, setAvatarSrc] = React.useState<string>(c.author.avatarUrl || AVATAR_PH);
  const [pendingLike, startLikeTransition] = React.useTransition();

  const goDetail = React.useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-no-nav]')) return;
      router.push(`/${locale}/p/${post.id}`);
    },
    [router, locale, post.id]
  );
  const onKeyActivate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-no-nav]')) return;
      e.preventDefault();
      router.push(`/${locale}/p/${post.id}`);
    }
  };

  React.useEffect(() => {
    function onPinnedChange(ev: Event) {
      const ce = ev as CustomEvent<{ postId: string; pinned: boolean }>;
      if (!ce.detail) return;
      const { postId, pinned } = ce.detail;
      if (postId === c.id) {
        setIsPinned(!!pinned);
      } else if (pinned) {
        setIsPinned(false);
      }
    }
    window.addEventListener('profile:pinnedChange', onPinnedChange);
    return () => window.removeEventListener('profile:pinnedChange', onPinnedChange);
  }, [c.id]);

  React.useEffect(() => {
    if (typeof pinnedPostId === 'string') {
      setIsPinned(pinnedPostId === c.id);
    } else if (pinnedPostId === null) {
      setIsPinned(false);
    }
  }, [pinnedPostId, c.id]);

  const onProfileOfAuthor = typeof handle === 'string' && handle.toLowerCase() === c.author.handle.toLowerCase();

  /* ---------- Actions ---------- */

  function LikeForm() {
    const action = liked ? unlikePostAction : likePostAction;
    const disabled = blockedByEither || pendingLike;
    return (
      <form
        data-no-nav
        action={action}
        onClick={(e) => e.stopPropagation()}
        onSubmit={() => {
          if (blockedByEither) return;
          startLikeTransition(() => {
            setLiked((v) => !v);
            setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
          });
        }}
      >
        <input type="hidden" name="postId" value={c.id} />
        <button
          type="submit"
          disabled={disabled}
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50"
          aria-pressed={liked || undefined}
          aria-disabled={disabled || undefined}
          title={blockedByEither ? tPost('interactionBlocked') : undefined}
        >
          <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }} aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" style={{ color: liked ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}>
              <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
            </svg>
          </span>
          <Counter value={likes} active={liked} />
          <span className="sr-only">{liked ? tPost('unlike') : tPost('like')}</span>
        </button>
      </form>
    );
  }

  function CommentButton() {
    const disabled = blockedByEither;
    return (
      <button
        type="button"
        data-no-nav
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setComposerOpen((v) => !v);
        }}
        className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50"
        aria-expanded={composerOpen || undefined}
        aria-disabled={disabled || undefined}
        title={disabled ? tPost('interactionBlocked') : undefined}
      >
        <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }} aria-hidden>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" style={{ color: 'rgba(255,255,255,.95)' }}>
            <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
          </svg>
        </span>
        <Counter value={comments} />
        <span className="sr-only">{tPost('comment')}</span>
      </button>
    );
  }

  function RepostButton() {
    const disabled = blockedByEither || reposting;
    return (
      <div className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50"
          onClick={() => !disabled && setRepostMenuOpen((v) => !v)}
          disabled={disabled}
          aria-expanded={repostMenuOpen || undefined}
          aria-disabled={disabled || undefined}
          title={disabled ? tPost('interactionBlocked') : undefined}
        >
          <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }} aria-hidden>
            <RepostBadgeIcon />
          </span>
          <Counter value={reposts} />
          <span className="sr-only">{tPost('repost')}</span>
        </button>

        {repostMenuOpen && (
          <div
            data-no-nav
            className="absolute z-20 mt-2 w-40 rounded-lg border border-white/10 bg-black/80 backdrop-blur p-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10 disabled:opacity-50"
              disabled={reposting}
              onClick={async () => {
                setRepostMenuOpen(false);
                setReposting(true);
                setReposts((n) => n + 1);
                try {
                  const resp = await fetch(`/api/posts/${c.id}/repost`, { method: 'POST' });
                  const j = await resp.json().catch(() => null);
                  if (!resp.ok || !j?.ok) throw new Error(j?.error || `HTTP ${resp.status}`);
                  try {
                    window.dispatchEvent(new CustomEvent('post:reposted', { detail: { originalId: c.id, newId: j.id } }));
                  } catch {}
                } catch {
                  setReposts((n) => Math.max(0, n - 1));
                } finally {
                  setReposting(false);
                }
              }}
            >
              {tPost('repost')}
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={() => {
                setRepostMenuOpen(false);
                setQuoteOpen(true);
              }}
            >
              {tPost('quotePost')}
            </button>
          </div>
        )}
      </div>
    );
  }

  async function copyPostText() {
    try { await navigator.clipboard.writeText(c.text ?? ''); } catch {}
  }

  function ShareButton() {
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/p/${post.id}`
        : `/${locale}/p/${post.id}`;

    const brand = t('brand.name');

    const systemShare = async () => {
      try {
        if (navigator.share) {
          await navigator.share({
            title: tPost('share.systemTitle', { name: c.author.displayName, brand }),
            text: tPost('share.systemText', { brand }),
            url,
          });
          setShareMenuOpen(false);
          return;
        }
      } catch {}
    };

    const copyLink = async () => {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1400);
      } catch {}
    };

    return (
      <div className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
          onClick={() => setShareMenuOpen((v) => !v)}
          aria-expanded={shareMenuOpen || undefined}
          title={tPost('share.title')}
        >
          <span
            className="inline-grid place-items-center"
            style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)', color: 'rgba(255,255,255,.95)' }}
            aria-hidden
          >
            <ShareIcon />
          </span>
          <span className="sr-only">{tPost('share.label')}</span>
        </button>

        {shareMenuOpen && (
          <div
            className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1"
            role="menu"
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10 flex items-center justify-between"
              onClick={() => {
                setShareMenuOpen(false);
                setDmShareOpen(true);
              }}
              title={tPost('share.shareInDm')}
            >
              {tPost('share.dm')}
              <span className="opacity-70 text-xs">→</span>
            </button>

            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={copyLink}
              title={tPost('share.copy')}
            >
              {copied ? tPost('share.copied') : tPost('share.copy')}
            </button>

            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={systemShare}
              title={tPost('share.system')}
            >
              {tPost('share.system')}
            </button>
          </div>
        )}
      </div>
    );
  }

  function MoreMenu() {
    const showPinControls = onProfileOfAuthor;

    const optimisticBroadcast = (pinned: boolean) => {
      try {
        window.dispatchEvent(new CustomEvent('profile:pinnedChange', { detail: { postId: c.id, pinned } }));
      } catch {}
    };

    return (
      <div className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label={tPost('more')} className="rounded p-1.5 hover:bg-white/5" onClick={() => setMoreOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>

        {moreOpen && (
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1" role="menu">
            {showPinControls && (
              <>
                {!isPinned ? (
                  <form
                    action={pinPostFormAction}
                    onSubmit={() => {
                      setIsPinned(true);
                      optimisticBroadcast(true);
                      setMoreOpen(false);
                    }}
                  >
                    <input type="hidden" name="handle" value={c.author.handle} />
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="postId" value={c.id} />
                    <button type="submit" className="w-full text-left px-3 py-2 rounded hover:bg-white/10">
                      {tPost('pinToProfile')}
                    </button>
                  </form>
                ) : (
                  <form
                    action={unpinPostFormAction}
                    onSubmit={() => {
                      setIsPinned(false);
                      optimisticBroadcast(false);
                      setMoreOpen(false);
                    }}
                  >
                    <input type="hidden" name="handle" value={c.author.handle} />
                    <input type="hidden" name="locale" value={locale} />
                    <input type="hidden" name="postId" value={c.id} />
                    <button type="submit" className="w-full text-left px-3 py-2 rounded hover:bg-white/10">
                      {tPost('unpinFromProfile')}
                    </button>
                  </form>
                )}
                <div className="h-px my-1 bg-white/10" />
              </>
            )}

            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 rounded hover:bg-white/10"
              onClick={() => { copyPostText(); setMoreOpen(false); }}
            >
              <span>{tPost('copyText')}</span>
            </button>

            {!hasBlockedAuthor ? (
              <form action={blockUserAction} onSubmit={() => { setHasBlockedAuthor(true); setMoreOpen(false); }}>
                <input type="hidden" name="blockedHandle" value={c.author.handle} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10">{tPost('block')}</button>
              </form>
            ) : (
              <form action={unblockUserAction} onSubmit={() => { setHasBlockedAuthor(false); setMoreOpen(false); }}>
                <input type="hidden" name="blockedHandle" value={c.author.handle} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10">{tPost('unblock')}</button>
              </form>
            )}

            <form action={reportPostAction} onSubmit={() => setMoreOpen(false)}>
              <input type="hidden" name="postId" value={c.id} />
              <input type="hidden" name="reason" value="OTHER" />
              <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">{tPost('report')}</button>
            </form>
          </div>
        )}
      </div>
    );
  }

  const RoleBadge = ({ role }: { role?: 'domme' | 'submissive' }) => {
    if (!role) return null;
    return (
      <span className="mt-1 text-[11px] leading-none px-2 py-1 rounded-full" style={{ color: 'var(--purple)', background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.25)' }}>
        {tPost(`role.${role}`)}
      </span>
    );
  };

  function QuoteBox() {
    if (!c.quote) return null;
    const q = c.quote;

    const goQuote = (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if ('key' in e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
      }
      const root = e.currentTarget as HTMLElement;
      const barrier = (e.target as HTMLElement | null)?.closest('[data-no-nav]');
      if (barrier && barrier !== root) return;
      router.push(`/${locale}/p/${q.id}`);
    };

    return (
      <div
        data-no-nav
        role="button"
        tabIndex={0}
        onClick={goQuote}
        onKeyDown={goQuote}
        className="mt-3 rounded-xl border border-white/10 bg-white/[.03] p-3 cursor-pointer hover:bg-white/[.06] focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
      >
        <div className="flex items-start gap-3">
          <div className="relative size-9 overflow-hidden rounded-full bg-white/10">
            <Image src={q.author.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm flex items-center gap-2">
              <span data-no-nav>
                <ProfileLink
                  handle={q.author.handle}
                  className="font-semibold truncate hover:underline"
                >
                  {q.author.displayName}
                </ProfileLink>
              </span>
              <span className="opacity-70 truncate">@{q.author.handle}</span>
              <span className="opacity-50">· {timeAgoShort(q.createdAt, tTime)}</span>
            </div>
            <div className="mt-1 text-[0.95rem] whitespace-pre-wrap break-words">{q.text}</div>
            {q.mediaUrl && <MediaView url={q.mediaUrl} alt={q.mediaAlt ?? ''} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <article
      className="relative bg-card border border-sub rounded-app shadow-app p-4 md:p-5 cursor-pointer"
      onClick={goDetail}
      onKeyDown={onKeyActivate}
      role="button"
      tabIndex={0}
      aria-label={tPost('ariaOpen')}
    >
      {post.community && (
        <div className="mb-3 -mt-1 text-[12px] text-white/80">
          <Link
            href={`/${locale}/communities/${post.community.slug}`}
            className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full border border-white/12 bg-white/[.04] hover:bg-white/[.08]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="opacity-90 font-medium">{tPost('communityPost')}</span>
            <span className="opacity-70">·</span>
            <span className="opacity-90">{post.community.name}</span>
          </Link>
        </div>
      )}

      {post.reposter && (
        <div className="mb-1 -mt-1 flex items-center gap-2 text-[12px] text-white/70">
          <span className="inline-grid place-items-center w-4 h-4"><RepostBadgeIcon /></span>
          <span>{tPost('repostedBy', { name: post.reposter.displayName })}</span>
        </div>
      )}

      <div className="absolute top-2 right-2" data-no-nav onClick={(e) => e.stopPropagation()}>
        <MoreMenu />
      </div>

      <header className="flex items-start gap-3">
        {/* Avatar + Rolle */}
        <div className="shrink-0 flex flex-col items-center w-[3.2em]">
          <div data-no-nav onClick={(e) => e.stopPropagation()}>
            <ProfileLink handle={c.author.handle} className="block focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded-full">
              <div className="size-[3.2em] rounded-full overflow-hidden grid place-items-center bg-white/10 relative hover:opacity-90 transition">
                <Image src={avatarSrc} alt={`${c.author.displayName} avatar`} fill className="object-cover" sizes="3.2em" onError={() => setAvatarSrc(AVATAR_PH)} />
              </div>
            </ProfileLink>
          </div>
          <RoleBadge role={uiRole} />
        </div>

        {/* Name + Meta + Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center flex-wrap">
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <ProfileLink handle={c.author.handle} className="font-semibold leading-tight text-[0.95rem] md:text-[1rem] hover:underline">
                {c.author.displayName}
              </ProfileLink>
            </div>

            <span aria-hidden style={{ display: 'inline-block', width: 8 }} />
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <ProfileLink handle={c.author.handle} className="text-muted truncate text-xs md:text-[11px] hover:underline">
                @{c.author.handle}
              </ProfileLink>
            </div>

            {isPinned && (
              <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-[var(--purple)]/20 text-[var(--purple)] border border-[var(--purple)]/30">
                {tPost('pinned')}
              </span>
            )}

            <BlockBadges
              hasBlockedAuthor={!!hasBlockedAuthor}
              blockedByAuthor={!!initialBlockedByAuthor}
              tPost={tPost}
            />
            <span className="text-muted mx-2 text-xs md:text-[13px]" aria-hidden>·</span>
            <time className="text-muted whitespace-nowrap text-xs md:text-[13px]" dateTime={c.createdAt} title={c.createdAt}>
              {timeAgoShort(c.createdAt, tTime)}
            </time>
          </div>

          <div className="mt-1 leading-relaxed">
            <RichText text={c.text} locale={locale} validateMentions />
          </div>

          {c.mediaUrl && <MediaView url={c.mediaUrl} alt={c.mediaAlt ?? ''} priority />}

          <QuoteBox />

          <div className="mt-3 flex items-center gap-4 sm:gap-6" data-no-nav onClick={(e) => e.stopPropagation()}>
            <CommentButton />
            <RepostButton />
            <LikeForm />
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <BookmarkButton postId={c.id} initiallyBookmarked={post.initiallyBookmarked === true} />
            </div>
            <div className="ml-auto">
              <ShareButton />
            </div>
          </div>

          {composerOpen && !blockedByEither && (
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <CommentComposer
                postId={post.id}
                onSuccess={() => {
                  setComments((n) => (n ?? 0) + 1);
                  setComposerOpen(false);
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('comment:created', { detail: { postId: post.id } }));
                  }
                }}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          )}
          {composerOpen && blockedByEither && (
            <div className="mt-2 text-[12px] text-white/60">{tPost('cantInteract')}</div>
          )}
        </div>
      </header>

      {quoteOpen && (
        <QuoteOverlay
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          target={{
            id: c.id,
            text: c.text,
            createdAt: c.createdAt,
            author: { displayName: c.author.displayName, handle: c.author.handle, avatarUrl: c.author.avatarUrl ?? undefined },
            mediaUrl: c.mediaUrl ?? undefined,
            mediaAlt: c.mediaAlt ?? undefined,
          }}
        />
      )}

      {dmShareOpen && (
        <DMShareOverlay
          open={dmShareOpen}
          onClose={() => setDmShareOpen(false)}
          postId={post.id}
          locale={locale}
        />
      )}
    </article>
  );
}
