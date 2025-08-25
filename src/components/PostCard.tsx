// src/components/PostCard.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import ProfileLink from '@/components/ProfileLink';
import BookmarkButton from '@/components/BookmarkButton';
import { likePostAction, unlikePostAction } from '@/app/actions/likes';
import CommentComposer from '@/components/comments/CommentComposer';

const AVATAR_PH = '/images/avatar-placeholder.png';

export type Post = {
  id: string;
  author: { name: string; role?: 'domme' | 'submissive'; handle: string; avatarUrl?: string };
  createdAt: string; // relative/ISO – Anzeige
  text: string;
  mediaUrl?: string;
  mediaAlt?: string;
  stats?: { comments?: number; reposts?: number; likes?: number };
  viewer?: { liked?: boolean; bookmarked?: boolean };
  initiallyBookmarked?: boolean;
};

function Counter({ value, active }: { value: number; active?: boolean }) {
  return (
    <span className="text-sm" style={{ color: active ? 'var(--purple)' : 'var(--muted)' }}>
      {value}
    </span>
  );
}

export default function PostCard({ post }: { post: Post }) {
  const router = useRouter();
  const { locale } = useParams() as { locale: string };

  // STATE
  const [likes, setLikes] = React.useState<number>(post.stats?.likes ?? 0);
  const [liked, setLiked] = React.useState<boolean>(!!post.viewer?.liked);

  const [comments, setComments] = React.useState<number>(post.stats?.comments ?? 0);
  const [composerOpen, setComposerOpen] = React.useState<boolean>(false);

  // „Reposts“ UI (Menü auf/zu), Zählwert lokal
  const [reposts, setReposts] = React.useState<number>(post.stats?.reposts ?? 0);
  const [repostMenuOpen, setRepostMenuOpen] = React.useState<boolean>(false);

  // Avatar-Fallback
  const [avatarSrc, setAvatarSrc] = React.useState<string>(post.author.avatarUrl || AVATAR_PH);

  // Transitions
  const [pendingLike, startLikeTransition] = React.useTransition();

  // Ganze Card klickbar → zum Detail
  const goDetail = React.useCallback(
    (e: React.MouseEvent) => {
      // Wenn innerhalb eines interaktiven Elements geklickt wurde: abbrechen
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-no-nav]')) return;
      router.push(`/${locale}/p/${post.id}`);
    },
    [router, locale, post.id]
  );

  const onKeyActivate = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // nur aktivieren, wenn Fokus nicht auf interaktivem Child liegt
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-no-nav]')) return;
      e.preventDefault();
      router.push(`/${locale}/p/${post.id}`);
    }
  };

  // LIKE: Server Action Form (mit Optimistic UI)
  function LikeForm() {
    const action = liked ? unlikePostAction : likePostAction;
    return (
      <form
        // Alles in diesem Bereich blockt das Card-Navigieren
        data-no-nav
        action={action}
        onClick={(e) => e.stopPropagation()}
        onSubmit={() => {
          startLikeTransition(() => {
            setLiked((v) => !v);
            setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
          });
        }}
      >
        <input type="hidden" name="postId" value={post.id} />
        <button
          type="submit"
          disabled={pendingLike}
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
          aria-pressed={liked || undefined}
        >
          <span
            className="inline-grid place-items-center"
            style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }}
            aria-hidden
          >
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-full h-full"
              style={{ color: liked ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}
            >
              <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
            </svg>
          </span>
          <Counter value={likes} active={liked} />
          <span className="sr-only">{liked ? 'Unlike' : 'Like'}</span>
        </button>
      </form>
    );
  }

  // COMMENT: Button öffnet Composer
  function CommentButton() {
    return (
      <button
        type="button"
        data-no-nav
        onClick={(e) => {
          e.stopPropagation();
          setComposerOpen((v) => !v);
        }}
        className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
        aria-expanded={composerOpen || undefined}
      >
        <span
          className="inline-grid place-items-center"
          style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" style={{ color: 'rgba(255,255,255,.95)' }}>
            <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
          </svg>
        </span>
        <Counter value={comments} />
        <span className="sr-only">Comment</span>
      </button>
    );
  }

  // REPOST: Menü (Repost / Quote)
  function RepostButton() {
    return (
      <div className="relative" data-no-nav onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
          onClick={() => setRepostMenuOpen((v) => !v)}
          aria-expanded={repostMenuOpen || undefined}
        >
          <span
            className="inline-grid place-items-center"
            style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }}
            aria-hidden
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full" style={{ color: 'rgba(255,255,255,.95)' }}>
              <path d="M7 9H4l4-4 4 4H9v6a3 3 0 0 0 3 3h2v-2h-2a1 1 0 0 1-1-1V9z" />
              <path d="M17 15h3l-4 4-4-4h3V9a3 3 0 0 0-3-3h-2V4h2a5 5 0 0 1 5 5v6z" />
            </svg>
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
                // hier deine Server Action/Route aufrufen
                // z.B. await repostAction(post.id)
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
                // Quote: zum Composer mit Quote-Context navigieren oder eigenen Dialog öffnen
                router.push(`/${locale}/compose?quote=${post.id}`);
              }}
            >
              Quote post
            </button>
          </div>
        )}
      </div>
    );
  }

  const RoleBadge = ({ role }: { role?: 'domme' | 'submissive' }) => {
    if (!role) return null;
    const label = role.charAt(0).toUpperCase() + role.slice(1);
    return (
      <span
        className="mt-1 text-[11px] leading-none px-2 py-1 rounded-full"
        style={{
          color: 'var(--purple)',
          background: 'rgba(139,92,246,.15)',
          border: '1px solid rgba(139,92,246,.25)',
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <article
      className="bg-card border border-sub rounded-app shadow-app p-4 md:p-5 cursor-pointer"
      onClick={goDetail}
      onKeyDown={onKeyActivate}
      role="button"
      tabIndex={0}
      aria-label="Open post"
    >
      <header className="flex items-start gap-3">
        {/* Avatar + Rolle */}
        <div className="shrink-0 flex flex-col items-center w-[3.2em]">
          <div data-no-nav onClick={(e) => e.stopPropagation()}>
            <ProfileLink
              handle={post.author.handle}
              className="block focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded-full"
            >
              <div className="size-[3.2em] rounded-full overflow-hidden grid place-items-center bg-white/10 relative hover:opacity-90 transition">
                <Image
                  src={avatarSrc}
                  alt={`${post.author.name} avatar`}
                  fill
                  className="object-cover"
                  sizes="3.2em"
                  onError={() => setAvatarSrc(AVATAR_PH)}
                  priority={false}
                />
              </div>
            </ProfileLink>
          </div>
          <RoleBadge role={post.author.role} />
        </div>

        {/* Name + Meta + Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <ProfileLink
                handle={post.author.handle}
                className="font-semibold leading-tight text-[0.95rem] md:text-[1rem] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded"
              >
                {post.author.name}
              </ProfileLink>
            </div>

            <span aria-hidden style={{ display: 'inline-block', width: 8 }} />

            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <ProfileLink
                handle={post.author.handle}
                className="text-muted truncate text-xs md:text-[11px] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded"
              >
                @{post.author.handle}
              </ProfileLink>
            </div>

            <span className="text-muted mx-2 text-xs md:text-[13px]" aria-hidden>
              ·
            </span>

            <time
              className="text-muted whitespace-nowrap text-xs md:text-[13px]"
              dateTime={post.createdAt}
              title={post.createdAt}
            >
              {post.createdAt}
            </time>
          </div>

          <div className="mt-1 whitespace-pre-wrap leading-relaxed">{post.text}</div>

          {post.mediaUrl && (
            <figure className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.mediaUrl}
                alt={post.mediaAlt ?? ''}
                loading="lazy"
                decoding="async"
                className="block mx-auto max-w-full h-auto max-h-[65vh] sm:max-h-[70vh]"
              />
            </figure>
          )}

          {/* Actions */}
          <div className="mt-3 flex items-center gap-4 sm:gap-6" data-no-nav onClick={(e) => e.stopPropagation()}>
            <CommentButton />
            <RepostButton />
            <LikeForm />
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <BookmarkButton postId={post.id} initiallyBookmarked={post.initiallyBookmarked === true} />
            </div>
          </div>

          {/* Composer unter dem Post */}
          {composerOpen && (
            <div data-no-nav onClick={(e) => e.stopPropagation()}>
              <CommentComposer
                postId={post.id}
                onSuccess={() => {
                  setComments((n) => n + 1);
                  setComposerOpen(false);
                }}
                onCancel={() => setComposerOpen(false)}
              />
            </div>
          )}
        </div>
      </header>
    </article>
  );
}
