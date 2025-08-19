'use client';

import * as React from 'react';
import Image from 'next/image';
import ProfileLink from '@/components/ProfileLink';
import BookmarkButton from '@/components/BookmarkButton';

const AVATAR_PH = '/images/avatar-placeholder.png';

export type Post = {
  /** NEU: id für Bookmarks */
  id: string;
  author: { name: string; role?: 'domme' | 'submissive'; handle: string; avatarUrl?: string };
  createdAt: string; // "2h", ISO, etc.
  text: string;
  mediaUrl?: string;
  mediaAlt?: string;
  stats?: { comments?: number; reposts?: number; likes?: number };
  /** optional: initialer Bookmark-Status */
  initiallyBookmarked?: boolean;
};

function ActionButton({
  label,
  color = 'rgba(255,255,255,.95)',
  activeColor,
  count = 0,
  active = false,
  onToggle,
  render,
}: {
  label: string;
  color?: string;
  activeColor?: string;
  count?: number;
  active?: boolean;
  onToggle?: () => void;
  render: (c: string) => React.ReactNode;
}) {
  const iconSize = 'clamp(18px, 1.8vw, 26px)';
  const c = active ? activeColor ?? 'var(--purple)' : color;

  return (
    <button
      className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
      aria-pressed={active || undefined}
      onClick={onToggle}
      type="button"
    >
      <span className="inline-grid place-items-center" style={{ width: iconSize, height: iconSize, position: 'relative' }} aria-hidden="true">
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', margin: 'auto', color: c }}>
          {render(c)}
        </div>
      </span>
      <span className="text-sm" style={{ color: active ? c : 'var(--muted)' }}>
        {count}
      </span>
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default function PostCard({ post }: { post: Post }) {
  const [likes, setLikes] = React.useState(post.stats?.likes ?? 0);
  const [liked, setLiked] = React.useState(false);

  const [reposts, setReposts] = React.useState(post.stats?.reposts ?? 0);
  const [reposted, setReposted] = React.useState(false);

  const [comments, setComments] = React.useState(post.stats?.comments ?? 0);
  const [commented, setCommented] = React.useState(false);

  // Avatar-Fallback (PNG)
  const [avatarSrc, setAvatarSrc] = React.useState<string>(post.author.avatarUrl || AVATAR_PH);

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
    <article className="bg-card border border-sub rounded-app shadow-app p-4 md:p-5">
      <header className="flex items-start gap-3">
        {/* Avatar + Rolle darunter */}
        <div className="shrink-0 flex flex-col items-center w-[3.2em]">
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
          <RoleBadge role={post.author.role} />
        </div>

        {/* Name + @handle · time */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center">
            <ProfileLink
              handle={post.author.handle}
              className="font-semibold leading-tight text-[0.95rem] md:text-[1rem] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded"
            >
              {post.author.name}
            </ProfileLink>

            <span aria-hidden="true" style={{ display: 'inline-block', width: 8 }} />

            <ProfileLink
              handle={post.author.handle}
              className="text-muted truncate text-xs md:text-[11px] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/50 rounded"
            >
              @{post.author.handle}
            </ProfileLink>

            <span className="text-muted mx-2 text-xs md:text-[13px]" aria-hidden="true">·</span>

            <time
              className="text-muted whitespace-nowrap text-xs md:text-[13px]"
              dateTime={post.createdAt}
              title={post.createdAt}
            >
              {post.createdAt}
            </time>
          </div>

          {/* Text */}
          <div className="mt-1 whitespace-pre-wrap leading-relaxed">{post.text}</div>

          {/* Medien */}
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
          <div className="mt-3 flex items-center gap-4 sm:gap-6">
            {/* Comment */}
            <ActionButton
              label="Comment"
              count={comments}
              active={commented}
              onToggle={() => {
                setCommented((v) => !v);
                setComments((n) => (commented ? Math.max(0, n - 1) : n + 1));
              }}
              render={(c) => (
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: c, width: '100%', height: '100%' }}>
                  <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
                </svg>
              )}
            />

            {/* Repost */}
            <ActionButton
              label="Repost"
              count={reposts}
              active={reposted}
              onToggle={() => {
                setReposted((v) => !v);
                setReposts((n) => (reposted ? Math.max(0, n - 1) : n + 1));
              }}
              render={(c) => (
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: c, width: '100%', height: '100%' }}>
                  <path d="M7 9H4l4-4 4 4H9v6a3 3 0 0 0 3 3h2v-2h-2a1 1 0 0 1-1-1V9z" />
                  <path d="M17 15h3l-4 4-4-4h3V9a3 3 0 0 0-3-3h-2V4h2a5 5 0 0 1 5 5v6z" />
                </svg>
              )}
            />

            {/* Like */}
            <ActionButton
              label="Like"
              count={likes}
              active={liked}
              activeColor="var(--purple)"
              onToggle={() => {
                setLiked((v) => !v);
                setLikes((n) => (liked ? Math.max(0, n - 1) : n + 1));
              }}
              render={(c) => (
                <svg viewBox="0 0 24 24" fill="currentColor" style={{ color: c, width: '100%', height: '100%' }}>
                  <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
                </svg>
              )}
            />

            {/* Bookmark */}
            <BookmarkButton
              postId={post.id}
              initiallyBookmarked={post.initiallyBookmarked === true}
            />
          </div>
        </div>
      </header>
    </article>
  );
}
