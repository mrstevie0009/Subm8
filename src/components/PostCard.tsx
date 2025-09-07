// src/components/PostCard.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import ProfileLink from '@/components/ProfileLink';
import BookmarkButton from '@/components/BookmarkButton';
import { likePostAction, unlikePostAction } from '@/app/actions/likes';
import CommentComposer from '@/components/comments/CommentComposer';
import { reportPostAction } from '@/app/actions/reports';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import RichText from '@/components/RichText';
import QuoteOverlay from '@/components/quotes/QuoteOverlay';

const AVATAR_PH = '/images/avatar-placeholder.png';

/** —— Gemeinsames Feed-Shape (inkl. optionaler Quote) —— */
export type FeedPost = {
  id: string;                 // ID des Feed-Items (bei Repost = ID des Reposts)
  createdAtISO: string;

  content: {
    id: string;               // ID des Inhalts (bei normalem Post == id)
    text: string;
    mediaUrl?: string | null;
    mediaAlt?: string | null;
    createdAt: string;        // ISO
    author: {
      id: string;
      handle: string;
      displayName: string;
      role?: 'DOMME' | 'SUBMISSIVE' | null;
      avatarUrl?: string | null;
    };
    /** Wenn dies ein "Quote Post" ist → eingebetteter Original-Post */
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

  /** Wenn Repost → wer hat reposted, sonst null */
  reposter: { id: string; handle: string; displayName: string } | null;

  stats?: { comments?: number; reposts?: number; likes?: number };
  viewer?: {
    liked?: boolean;
    bookmarked?: boolean;
    hasBlockedAuthor?: boolean;
    blockedByAuthor?: boolean;
  };
  initiallyBookmarked?: boolean;
};

function Counter({ value = 0, active }: { value?: number; active?: boolean }) {
  return (
    <span className="text-sm" style={{ color: active ? 'var(--purple)' : 'var(--muted)' }}>
      {value ?? 0}
    </span>
  );
}

function timeAgoShort(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
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
function RepostBadgeIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden>
      <path d="M7 9H4l4-4 4 4H9v6a3 3 0 0 0 3 3h2v-2h-2a1 1 0 0 1-1-1V9z" />
      <path d="M17 15h3l-4 4-4-4h3V9a3 3 0 0 0-3-3h-2V4h2a5 5 0 0 1 5 5v6z" />
    </svg>
  );
}

/* ------------------------ Blockstatus-Badges ------------------------ */
function BlockBadges({ hasBlockedAuthor, blockedByAuthor }: { hasBlockedAuthor: boolean; blockedByAuthor: boolean }) {
  if (!hasBlockedAuthor && !blockedByAuthor) return null;
  return (
    <span className="ml-2 inline-flex items-center gap-1" data-no-nav>
      {hasBlockedAuthor && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
          <BanIcon /> Du blockierst
        </span>
      )}
      {blockedByAuthor && (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-400/40 bg-red-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-red-300">
          <ShieldOffIcon /> Blockiert dich
        </span>
      )}
    </span>
  );
}

export default function PostCard({ post }: { post: FeedPost }) {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };

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

  // Block-Status (für Interaktionen)
  const initialHasBlocked = !!post.viewer?.hasBlockedAuthor;
  const initialBlockedByAuthor = !!post.viewer?.blockedByAuthor;
  const [hasBlockedAuthor, setHasBlockedAuthor] = React.useState<boolean>(initialHasBlocked);
  const blockedByEither = initialBlockedByAuthor || hasBlockedAuthor;

  // Avatar (vom ORIGINAL)
  const [avatarSrc, setAvatarSrc] = React.useState<string>(c.author.avatarUrl || AVATAR_PH);
  const [pendingLike, startLikeTransition] = React.useTransition();

  // Navigation zum Feed-Item
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

  /* ----------------------------- LIKE ----------------------------- */
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
        {/* Wichtig: auf das Original zeigen */}
        <input type="hidden" name="postId" value={c.id} />
        <button
          type="submit"
          disabled={disabled}
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50"
          aria-pressed={liked || undefined}
          aria-disabled={disabled || undefined}
          title={blockedByEither ? 'Interaktionen sind blockiert' : undefined}
        >
          <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }} aria-hidden>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" style={{ color: liked ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}>
              <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
            </svg>
          </span>
          <Counter value={likes} active={liked} />
          <span className="sr-only">{liked ? 'Unlike' : 'Like'}</span>
        </button>
      </form>
    );
  }

  /* --------------------------- COMMENT BTN --------------------------- */
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
        title={disabled ? 'Interaktionen sind blockiert' : undefined}
      >
        <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }} aria-hidden>
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" style={{ color: 'rgba(255,255,255,.95)' }}>
            <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
          </svg>
        </span>
        <Counter value={comments} />
        <span className="sr-only">Comment</span>
      </button>
    );
  }

  /* ---------------------------- REPOST/QUOTE MENU ---------------------------- */
  function RepostButton() {
    const disabled = blockedByEither;
    return (
      <div className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5 disabled:opacity-50"
          onClick={() => !disabled && setRepostMenuOpen((v) => !v)}
          disabled={disabled}
          aria-expanded={repostMenuOpen || undefined}
          aria-disabled={disabled || undefined}
          title={disabled ? 'Interaktionen sind blockiert' : undefined}
        >
          <span className="inline-grid place-items-center" style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }} aria-hidden>
            <RepostBadgeIcon />
          </span>
          <Counter value={reposts} />
          <span className="sr-only">Repost</span>
        </button>

        {repostMenuOpen && (
          <div
            data-no-nav
            className="absolute z-20 mt-2 w-40 rounded-lg border border-white/10 bg-black/80 backdrop-blur p-1 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={() => {
                setReposts((n) => n + 1);
                setRepostMenuOpen(false);
              }}
            >
              Repost
            </button>
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={() => {
                setRepostMenuOpen(false);
                setQuoteOpen(true);   // ⟵ Overlay öffnen
              }}
            >
              Quote post
            </button>
          </div>
        )}
      </div>
    );
  }

  async function copyPostText() {
    try { await navigator.clipboard.writeText(c.text ?? ''); } catch {}
  }

  /* ----------------------------- MORE MENU ----------------------------- */
  function MoreMenu() {
    return (
      <div className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button type="button" aria-label="Mehr" className="rounded p-1.5 hover:bg-white/5" onClick={() => setMoreOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2}>
            <circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>

        {moreOpen && (
          <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1" role="menu">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 rounded hover:bg-white/10"
              onClick={() => { copyPostText(); setMoreOpen(false); }}
            >
              <span>Post-Text kopieren</span>
            </button>

            {!hasBlockedAuthor ? (
              <form action={blockUserAction} onSubmit={() => { setHasBlockedAuthor(true); setMoreOpen(false); }}>
                <input type="hidden" name="blockedHandle" value={c.author.handle} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10">Account blockieren</button>
              </form>
            ) : (
              <form action={unblockUserAction} onSubmit={() => { setHasBlockedAuthor(false); setMoreOpen(false); }}>
                <input type="hidden" name="blockedHandle" value={c.author.handle} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10">Account entblocken</button>
              </form>
            )}

            <form action={reportPostAction} onSubmit={() => setMoreOpen(false)}>
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="reason" value="OTHER" />
              <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">Post melden</button>
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
        {role.charAt(0).toUpperCase() + role.slice(1)}
      </span>
    );
  };

  /** Kleine Quote-Box im Post (falls vorhanden) */
  function QuoteBox() {
    if (!c.quote) return null;
    const q = c.quote;

    const goQuote = (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      // Tastatur-Support
      if ('key' in e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
      }
      const target = e.target as HTMLElement | null;
      // Klicks auf Links/Buttons innerhalb der Box nicht abfangen
      if (target && target.closest('[data-no-nav]')) return;
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
              <span className="opacity-50">· {timeAgoShort(q.createdAt)}</span>
            </div>
            <div className="mt-1 text-[0.95rem] whitespace-pre-wrap break-words">{q.text}</div>
            {q.mediaUrl && (
              <figure className="mt-2 overflow-hidden rounded-lg border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.mediaUrl} alt={q.mediaAlt ?? ''} className="block max-h-64 w-auto mx-auto" />
              </figure>
            )}
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
      aria-label="Open post"
    >
      {/* Repost-Badge */}
      {post.reposter && (
        <div className="mb-1 -mt-1 flex items-center gap-2 text-[12px] text-white/70">
          <span className="inline-grid place-items-center w-4 h-4"><RepostBadgeIcon /></span>
          <span><strong>{post.reposter.displayName}</strong> reposted</span>
        </div>
      )}

      <div className="absolute top-2 right-2" data-no-nav onClick={(e) => e.stopPropagation()}>
        <MoreMenu />
      </div>

      <header className="flex items-start gap-3">
        {/* Avatar + Rolle (ORIGINAL) */}
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

            <BlockBadges hasBlockedAuthor={!!hasBlockedAuthor} blockedByAuthor={!!initialBlockedByAuthor} />
            <span className="text-muted mx-2 text-xs md:text-[13px]" aria-hidden>·</span>
            <time className="text-muted whitespace-nowrap text-xs md:text-[13px]" dateTime={c.createdAt} title={c.createdAt}>
              {timeAgoShort(c.createdAt)}
            </time>
          </div>

          <div className="mt-1 leading-relaxed">
            <RichText text={c.text} locale={locale} validateMentions />
          </div>

          {c.mediaUrl && (
            <figure className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.mediaUrl} alt={c.mediaAlt ?? ''} loading="lazy" decoding="async" className="block mx-auto max-w-full h-auto max-h-[65vh] sm:max-h-[70vh]" />
            </figure>
          )}

          {/* Eingebettete Quote (falls vorhanden) */}
          <QuoteBox />

          {/* Actions */}
          <div className="mt-3 flex items-center gap-4 sm:gap-6" data-no-nav onClick={(e) => e.stopPropagation()}>
            <CommentButton />
            <RepostButton />
            <LikeForm />
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              {/* Wichtig: auf das Original zeigen */}
              <BookmarkButton postId={c.id} initiallyBookmarked={post.initiallyBookmarked === true} />
            </div>
          </div>

          {/* Composer unter dem Post */}
          {composerOpen && !blockedByEither && (
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <CommentComposer
                postId={post.id}
                onSuccess={() => {
                  setComments((n) => (n ?? 0) + 1);
                  setComposerOpen(false);
                  // 🔔 Kommentar-Thread informieren
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('comment:created', { detail: { postId: post.id } }));
                  }
                }}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          )}
          {composerOpen && blockedByEither && (
            <div className="mt-2 text-[12px] text-white/60">Du kannst mit diesem Account nicht interagieren.</div>
          )}
        </div>
      </header>

      {/* Quote-Overlay */}
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
    </article>
  );
}
