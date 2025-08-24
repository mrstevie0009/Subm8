// src/app/[locale]/notifications/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { followAction, unfollowAction } from '@/app/actions/follow';

// ---------- Types ----------
type ApiUser = {
  id?: string;                       // optional – falls deine API noch keine id liefert
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  viewerFollows?: boolean;           // muss von deiner API berechnet werden
};

type ApiFollow   = { id: string; kind: 'follow';  time: string; user: ApiUser };
type ApiLike     = { id: string; kind: 'like';    time: string; user: ApiUser; text: string; postId: string };
type ApiMention  = { id: string; kind: 'mention'; time: string; user: ApiUser; text: string; postId?: string };
type ApiNoti     = ApiFollow | ApiLike | ApiMention;


type NotiBase = {
  id: string;
  time: string; // relative
  user: { id?: string; handle: string; name?: string; avatar?: string; viewerFollows?: boolean };
};

type Noti =
  | (NotiBase & { kind: 'follow' })
  | (NotiBase & { kind: 'like'; text: string })
  | (NotiBase & { kind: 'mention'; text: string });

// ---------- Helpers ----------
function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
function cn(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(' ');
}

// ---------- Small Server-Action Follow Form ----------
function FollowForm({
  userId,
  handle,
  initialFollowing,
}: {
  userId?: string;
  handle: string;
  initialFollowing: boolean;
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
      {/* Wir geben BEIDES mit: userId (falls vorhanden) UND handle als Fallback */}
      {userId ? <input type="hidden" name="userId" value={userId} /> : null}
      <input type="hidden" name="handle" value={handle} />
      <button type="submit" disabled={pending} className={cls}>
        {following ? 'Following' : 'Follow'}
      </button>
    </form>
  );
}

// ---------- Page ----------
export default function NotificationsPage() {
  const [tab, setTab] = React.useState<'all' | 'mentions'>('all');

  const [items, setItems] = React.useState<Noti[]>([]);
  const [loadingNoti, setLoadingNoti] = React.useState(false);


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
            const rel = timeAgo(new Date(n.time));
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
            };
            if (n.kind === 'follow') return { ...base, kind: 'follow' };
            if (n.kind === 'like') return { ...base, kind: 'like', text: n.text };
            return { ...base, kind: 'mention', text: n.text };
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
  }, [tab]);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-[calc(var(--header-h))] z-10 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="px-4 pt-3 pb-2">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight">Notifications</h1>
        </div>

        {/* Segmented Tabs */}
        <div className="px-4 pb-3">
          <div className="inline-flex rounded-full border border-white/10 bg-white/[.04] p-1">
            {(['all', 'mentions'] as const).map((k) => {
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
                  {k === 'all' ? 'All' : 'Mentions'}
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
              <div className="text-base font-medium">All caught up</div>
              <div className="text-sm opacity-70">You have no notifications right now.</div>
            </div>
          </li>
        )}

        {items.map((n) => (
          <li key={n.id} className="px-4 py-3 hover:bg-white/5 border-b border-white/10">
            <div className="flex items-start gap-3">
              {/* Avatar + Kind-Badge */}
              <div className="relative">
                <Avatar size={40} name={n.user.name ?? n.user.handle} src={n.user.avatar} />
                <div className="absolute -bottom-1 -right-1 grid place-items-center rounded-full border border-black size-5 bg-[var(--purple)] text-white">
                  {n.kind === 'follow' && <SmallUserPlusIcon />}
                  {n.kind === 'mention' && <SmallAtIcon />}
                  {n.kind === 'like' && <SmallHeartIcon />}
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 leading-tight">
                {n.kind === 'follow' && (
                  <div>
                    <b>@{n.user.handle}</b> followed you{' '}
                    <span className="text-xs opacity-60">· {n.time}</span>
                  </div>
                )}
                {n.kind === 'mention' && (
                  <div>
                    <b>@{n.user.handle}</b> mentioned you:{' '}
                    <span className="opacity-90">{n.text}</span>{' '}
                    <span className="text-xs opacity-60">· {n.time}</span>
                  </div>
                )}
                {n.kind === 'like' && (
                  <div>
                    <b>@{n.user.handle}</b> liked your post:{' '}
                    <span className="opacity-90">{n.text}</span>{' '}
                    <span className="text-xs opacity-60">· {n.time}</span>
                  </div>
                )}
              </div>

              {/* Action */}
              {n.kind === 'follow' ? (
                <FollowForm
                  userId={n.user.id}
                  handle={n.user.handle}
                  initialFollowing={!!n.user.viewerFollows}
                />
              ) : (
                <button className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5">
                  View
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
