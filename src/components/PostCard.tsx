// src/components/PostCard.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import ProfileLink from '@/components/ProfileLink';
import BookmarkButton from '@/components/BookmarkButton';
import { likePostAction, unlikePostAction } from '@/app/actions/likes';
import CommentComposer from '@/components/comments/CommentComposer';
import { addCommentAction } from '@/app/actions/comments';

const AVATAR_PH = '/images/avatar-placeholder.png';

export type Post = {
  id: string;
  author: { name: string; role?: 'domme' | 'submissive'; handle: string; avatarUrl?: string };
  createdAt: string;
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

  const [reposts, setReposts] = React.useState<number>(post.stats?.reposts ?? 0);
  const [shareOpen, setShareOpen] = React.useState<boolean>(false);

  const [avatarSrc, setAvatarSrc] = React.useState<string>(post.author.avatarUrl || AVATAR_PH);

  const [pendingLike, startLikeTransition] = React.useTransition();

  const goToDetail = React.useCallback(() => {
    router.push(`/${locale}/p/${post.id}`);
  }, [router, locale, post.id]);

  const stopClick: React.MouseEventHandler = (e) => e.stopPropagation();
  const stopKey: React.KeyboardEventHandler = (e) => e.stopPropagation();

  function LikeForm() {
    const action = liked ? unlikePostAction : likePostAction;
    return (
      <form
        action={async (fd: FormData) => {
          await action(fd);
          startLikeTransition(() => {
            setLiked((v) => !v);
            setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
          });
        }}
        onClickCapture={stopClick}
        onKeyDownCapture={stopKey}
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

  function CommentButton() {
    return (
      <button
        type="button"
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
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-full h-full"
            style={{ color: 'rgba(255,255,255,.95)' }}
          >
            <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
          </svg>
        </span>
        <Counter value={comments} />
        <span className="sr-only">Comment</span>
      </button>
    );
  }

  function ShareButton() {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShareOpen(true);
          }}
          className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
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
          <span className="sr-only">Share</span>
        </button>

        {shareOpen && (
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3" onClickCapture={stopClick}>
            <div className="text-sm opacity-80 mb-2">Share this post</div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={typeof window !== 'undefined' ? window.location.href : ''}
                className="flex-1 px-2 py-1.5 rounded-md bg-transparent border border-white/10"
              />
              <button
                type="button"
                className="px-3 py-1.5 rounded-md border border-white/15 hover:bg-white/5"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await navigator.clipboard.writeText(window.location.href);
                    setReposts((n) => n + 1);
                    setShareOpen(false);
                  } catch {
                    /* noop */
                  }
                }}
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </>
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

  const commentAction = React.useCallback(async (fd: FormData) => {
    await addCommentAction(fd);
  }, []);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label="Open post"
      onClick={goToDetail}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToDetail();
        }
      }}
      className="cursor-pointer bg-card border border-sub rounded-app shadow-app p-4 md:p-5"
    >
      <header className="flex items-start gap-3">
        {/* Avatar + Rolle */}
        <div className="shrink-0 flex flex-col items-center w-[3.2em]">
          {/* Wrapper stoppt die Karten-Navigation, ohne ProfileLink zu ändern */}
          <span onClickCapture={stopClick} onKeyDownCapture={stopKey}>
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
          </span>
          <RoleBadge role={post.author.role} />
        </div>

        {/* Name + Meta + Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <span onClickCapture={stopClick} onKeyDownCapture={stopKey}>
              <ProfileLink
                handle={post.author.handle}
                className="font-semibold leading-tight text-[0.95rem] md:text-[1rem] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded"
              >
                {post.author.name}
              </ProfileLink>
            </span>

            <span aria-hidden style={{ display: 'inline-block', width: 8 }} />

            <span onClickCapture={stopClick} onKeyDownCapture={stopKey}>
              <ProfileLink
                handle={post.author.handle}
                className="text-muted truncate text-xs md:text-[11px] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded"
              >
                @{post.author.handle}
              </ProfileLink>
            </span>

            <span className="text-muted mx-2 text-xs md:text-[13px]" aria-hidden>
              ·
            </span>

            <time
              className="text-muted whitespace-nowrap text-xs md:text-[13px]"
              dateTime={post.createdAt}
              title={post.createdAt}
              onClick={stopClick}
              onKeyDown={stopKey}
            >
              {post.createdAt}
            </time>
          </div>

          <div className="mt-1 whitespace-pre-wrap leading-relaxed">{post.text}</div>

          {post.mediaUrl && (
            <figure
              className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/20"
              onClick={stopClick}
              onKeyDown={stopKey}
            >
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
          <div className="mt-3 flex items-center gap-4 sm:gap-6" onClickCapture={stopClick} onKeyDownCapture={stopKey}>
            <CommentButton />
            <ShareButton />
            <LikeForm />
            <div onClickCapture={stopClick} onKeyDownCapture={stopKey}>
              <BookmarkButton postId={post.id} initiallyBookmarked={post.initiallyBookmarked === true} />
            </div>
          </div>

          {/* Composer */}
          {composerOpen && (
            <div className="mt-3" onClickCapture={stopClick} onKeyDownCapture={stopKey}>
              <CommentComposer
                postId={post.id}
                action={commentAction}
                onSubmitted={() => {
                  setComposerOpen(false);
                  setComments((n) => n + 1);
                }}
              />
            </div>
          )}
        </div>
      </header>
    </article>
  );
}
