// src/app/[locale]/notifications/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { followAction, unfollowAction } from '@/app/actions/follow';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

// ---------- Types returned by /api/notifications ----------
type ApiUser = {
  id?: string;
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  viewerFollows?: boolean;
};

type ApiFollow       = { id: string; kind: 'follow';        time: string; user: ApiUser };
type ApiLike         = { id: string; kind: 'like';          time: string; user: ApiUser; text: string; postId: string };
type ApiMention      = { id: string; kind: 'mention';       time: string; user: ApiUser; text: string; postId?: string };
type ApiComment      = { id: string; kind: 'comment';       time: string; user: ApiUser; text: string; postId: string };
type ApiReply        = { id: string; kind: 'reply';         time: string; user: ApiUser; text: string; postId: string };
type ApiCommentLike  = { id: string; kind: 'comment_like';  time: string; user: ApiUser; text: string; postId: string };
type ApiNoti = ApiFollow | ApiLike | ApiMention | ApiComment | ApiReply | ApiCommentLike;

// ---------- UI Types ----------
type NotiBase = {
  id: string;
  time: string; // relative, already localized short form
  user: { id?: string; handle: string; name?: string; avatar?: string; viewerFollows?: boolean };
  postId?: string;
  text?: string;
};

type Noti =
  | (NotiBase & { kind: 'follow' })
  | (NotiBase & { kind: 'like' })
  | (NotiBase & { kind: 'mention' })
  | (NotiBase & { kind: 'comment' })
  | (NotiBase & { kind: 'reply' })
  | (NotiBase & { kind: 'comment_like' });

// ---------- Helpers ----------
function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// Relatives times using i18n keys from common.time
function timeAgoIntl(
  date: Date,
  tTime: (key: string, values?: Record<string, string | number | Date>) => string
): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return tTime('now');
  const m = Math.floor(s / 60);
  if (m < 60) return tTime('m', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tTime('h', { count: h });
  const d = Math.floor(h / 24);
  return tTime('d', { count: d });
}

// ---------- Small Server-Action Follow Form ----------
function FollowForm({
  userId,
  handle,
  initialFollowing,
  labels,
}: {
  userId?: string;
  handle: string;
  initialFollowing: boolean;
  labels: { follow: string; following: string };
}) {
  const [following, setFollowing] = React.useState<boolean>(!!initialFollowing);
  const [pending, startTransition] = React.useTransition();

  const cls = following
    ? 'px-3 py-1.5 rounded-full border border-white/25 hover:bg-white/5'
    : 'px-3 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95';

  return (
    <form
      method="POST"
      action={following ? unfollowAction : followAction}
      onSubmit={() => startTransition(() => setFollowing((v) => !v))}
    >
      {userId ? <input type="hidden" name="userId" value={userId} /> : null}
      <input type="hidden" name="handle" value={handle} />
      <button type="submit" disabled={pending} className={cls}>
        {following ? labels.following : labels.follow}
      </button>
    </form>
  );
}

// ---------- Page ----------
export default function NotificationsPage() {
  const [tab, setTab] = React.useState<'all' | 'mentions' | 'comments'>('all');
  const [items, setItems] = React.useState<Noti[]>([]);
  const [loadingNoti, setLoadingNoti] = React.useState(false);

  const router = useRouter();
  const { locale } = useParams() as { locale: string };

  const t = useTranslations('notifications.notificationsPage');
  const tTime = useTranslations('common.time');

  // Notifications laden
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingNoti(true);
      try {
        const res = await fetch(`/api/notifications?tab=${tab}`, { cache: 'no-store' });
        const j: { ok: boolean; items?: ApiNoti[] } = await res.json();
        if (!cancelled && j?.ok && Array.isArray(j.items)) {
          const mapped: Noti[] = j.items.map((n) => {
            const rel = timeAgoIntl(new Date(n.time), tTime);
            const base: NotiBase = {
              id: n.id,
              time: rel,
              user: {
                id: n.user.id,
                handle: n.user.handle,
                name: n.user.displayName,
                avatar: n.user.avatarUrl ?? undefined,
                viewerFollows: n.user.viewerFollows,
              },
              postId: 'postId' in n ? n.postId : undefined,
              text: 'text' in n ? n.text : undefined,
            };
            return { ...base, kind: n.kind } as Noti;
          });
          setItems(mapped);
        } else if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoadingNoti(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, tTime]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-[calc(var(--header-h))] z-10 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">{t('title')}</h1>
        </div>

        {/* Segmented Tabs */}
        <div className="px-4 pb-3">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[.04] p-1">
            {(['all', 'mentions', 'comments'] as const).map((k) => {
              const active = tab === k;
              return (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn(
                    'px-4 py-1.5 text-sm rounded-full transition',
                    active ? 'bg-[var(--purple)] text-white' : 'text-white/80 hover:bg-white/10'
                  )}
                >
                  {k === 'all' ? t('tabs.all') : k === 'mentions' ? t('tabs.mentions') : t('tabs.comments')}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <ul className="mt-4">
        {loadingNoti && (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        )}

        {!loadingNoti && items.length === 0 && (
          <li className="px-4 py-12 text-center">
            <div className="inline-flex flex-col items-center gap-3 opacity-80">
              <div className="grid place-items-center size-12 rounded-full bg-white/5 border border-white/10">
                <BellIcon tone="purple" />
              </div>
              <div className="text-base font-medium">{t('empty.title')}</div>
              <div className="text-sm opacity-70">{t('empty.desc')}</div>
            </div>
          </li>
        )}

        {items.map((n) => (
          <li key={n.id} className="px-4 py-3 hover:bg-white/5 border-b border-white/10">
            <div className="flex items-start gap-3">
              {/* Avatar + kind badge */}
              <div className="relative">
                <Avatar size={40} name={n.user.name ?? n.user.handle} src={n.user.avatar} />
                <div className="absolute -bottom-1 -right-1 grid place-items-center rounded-full border border-black size-5 bg-[var(--purple)] text-white">
                  {n.kind === 'follow' && <SmallUserPlusIcon />}
                  {n.kind === 'mention' && <SmallAtIcon />}
                  {(n.kind === 'like' || n.kind === 'comment_like') && <SmallHeartIcon />}
                  {(n.kind === 'comment' || n.kind === 'reply') && <SmallCommentIcon />}
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 leading-tight">
                {n.kind === 'follow' && (
                  <div>
                    <b>@{n.user.handle}</b> {t('messages.followedYou')}{' '}
                    <span className="text-xs opacity-60">{t('messages.timeSep', { time: n.time })}</span>
                  </div>
                )}

                {n.kind === 'mention' && (
                  <div>
                    <b>@{n.user.handle}</b> {t('messages.mentionedYou')}{' '}
                    <span className="opacity-90">{n.text}</span>{' '}
                    <span className="text-xs opacity-60">{t('messages.timeSep', { time: n.time })}</span>
                  </div>
                )}

                {n.kind === 'like' && (
                  <div>
                    <b>@{n.user.handle}</b> {t('messages.likedYourPost')}{' '}
                    <span className="opacity-90">{n.text}</span>{' '}
                    <span className="text-xs opacity-60">{t('messages.timeSep', { time: n.time })}</span>
                  </div>
                )}

                {n.kind === 'comment' && (
                  <div>
                    <b>@{n.user.handle}</b> {t('messages.commentedOnYourPost')}{' '}
                    <span className="opacity-90">{n.text}</span>{' '}
                    <span className="text-xs opacity-60">{t('messages.timeSep', { time: n.time })}</span>
                  </div>
                )}

                {n.kind === 'reply' && (
                  <div>
                    <b>@{n.user.handle}</b> {t('messages.repliedToYourComment')}{' '}
                    <span className="opacity-90">{n.text}</span>{' '}
                    <span className="text-xs opacity-60">{t('messages.timeSep', { time: n.time })}</span>
                  </div>
                )}

                {n.kind === 'comment_like' && (
                  <div>
                    <b>@{n.user.handle}</b> {t('messages.likedYourComment')}{' '}
                    <span className="opacity-90">{n.text}</span>{' '}
                    <span className="text-xs opacity-60">{t('messages.timeSep', { time: n.time })}</span>
                  </div>
                )}
              </div>

              {/* Action */}
              {n.kind === 'follow' ? (
                <FollowForm
                  userId={n.user.id}
                  handle={n.user.handle}
                  initialFollowing={!!n.user.viewerFollows}
                  labels={{ follow: t('actions.follow'), following: t('actions.following') }}
                />
              ) : (
                <button
                  className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5"
                  onClick={() => n.postId && router.push(`/${locale}/p/${n.postId}`)}
                >
                  {t('actions.view')}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- UI bits ----
function Avatar({ src, name, size = 40 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={size}
        height={size}
        className="rounded-full object-cover border border-white/15"
        sizes={`${size}px`}
      />
    );
  }
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  return (
    <div
      className="grid place-items-center rounded-full bg-white/10 border border-white/20"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <span className="font-semibold">{initial}</span>
    </div>
  );
}

function SkeletonRow() {
  return (
    <li className="px-4 py-3 border-b border-white/10">
      <div className="flex items-start gap-3">
        <div className="size-10 rounded-full bg-white/10 animate-pulse" />
        <div className="flex-1 min-w-0">
          <div className="h-3 w-2/3 bg-white/10 rounded animate-pulse" />
          <div className="h-3 w-1/3 bg-white/10 rounded mt-2 animate-pulse" />
        </div>
        <div className="h-8 w-20 rounded-full border border-white/15" />
      </div>
    </li>
  );
}

// ---- Icons ----
function BellIcon({ tone = 'neutral' }: { tone?: 'neutral' | 'purple' }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" className={tone === 'purple' ? 'text-[var(--purple)]' : 'text-white/80'} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 9a6 6 0 1 1 12 0c0 4 2 5 2 6H4c0-1 2-2 2-6Z" />
      <path d="M9 19a3 3 0 0 0 6 0" />
    </svg>
  );
}
function SmallUserPlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
      <path d="M15 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
      <path d="M2 20c0-4 4-7 9-7s9 3 9 7H2Z" />
      <path d="M19 8v-2m0 0V4m0 2h2m-2 0h-2" stroke="black" strokeWidth="1" />
    </svg>
  );
}
function SmallAtIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
      <path d="M12 4a8 8 0 1 0 5.3 14.1l.2-.2a1 1 0 1 0-1.5-1.3l-.2.2A6 6 0 1 1 12 6a5 5 0 0 1 5 5v.5a1.5 1.5 0 0 1-3 0V7.5a1 1 0 1 0-2 0V11a3.5 3.5 0 1 0 7 0V11a7 7 0 0 0-7-7Z" />
    </svg>
  );
}
function SmallHeartIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
      <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
    </svg>
  );
}
function SmallCommentIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden>
      <path d="M4 7a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v4a5 5 0 0 1-5 5H11l-4 3v-3H9a5 5 0 0 1-5-5V7Z" />
    </svg>
  );
}
