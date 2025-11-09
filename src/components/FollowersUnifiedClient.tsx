'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FollowInlineButton from '@/components/FollowInlineButton';
import FollowTabsInline from '@/components/FollowTabsInline';
import { UserBadges } from '@/components/UserBadges';

const AVATAR_PH = '/images/avatar-placeholder.png';
type Tab = 'followers' | 'following' | 'vFollowing' | 'vFollowers';

export type UserLite = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  premiumUntil: string | Date | null;
  isFirstAdopter?: boolean | null;
  role: 'DOMME' | 'SUBMISSIVE' | string;
};
type UserWithFollow = UserLite & { initialFollowing: boolean };

export type FollowersUnifiedClientProps = {
  locale: string;
  handle: string;
  meId: string | null;
  counts: Record<Tab, number>;
  initialTab?: Tab;
  initialItems: UserWithFollow[];
  initialNextCursor: string | null;
};

const toDbRole = (r: UserLite['role']): 'DOMME' | 'SUBMISSIVE' =>
  String(r).toUpperCase() === 'DOMME' ? 'DOMME' : 'SUBMISSIVE';

const isPremiumActive = (u: UserLite) => {
  const until = u.premiumUntil ? new Date(u.premiumUntil) : null;
  return !!until && until.getTime() > Date.now();
};

function ListItem({ locale, u, meId }: { locale: string; u: UserWithFollow; meId: string | null }) {
  const firstAdopter  = !!u.isFirstAdopter;
  const premiumActive = isPremiumActive(u);
  const showFirstAdopter = firstAdopter && !premiumActive;
  const showPremium      = premiumActive && !firstAdopter;

  return (
    <li className="px-3 py-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3">
      <Link href={`/${locale}/u/${u.handle}`} className="flex items-center gap-3 min-w-0">
        <Image
          src={u.avatarUrl || AVATAR_PH}
          alt=""
          width={44}
          height={44}
          className="rounded-full object-cover border border-white/15"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate">{u.displayName}</span>
            <UserBadges
              role={toDbRole(u.role)}
              isPremium={showPremium}
              isFirstAdopter={showFirstAdopter}
              size={16}
              className="-ml-0.5 shrink-0"
            />
          </div>
          <div className="text-sm opacity-70 truncate">@{u.handle}</div>
        </div>
      </Link>

      <div className="shrink-0">
        {meId && meId !== u.id ? (
          <FollowInlineButton targetUserId={u.id} initialFollowing={u.initialFollowing} />
        ) : null}
      </div>
    </li>
  );
}

export default function FollowersUnifiedClient(props: FollowersUnifiedClientProps) {
  const [tab, setTab] = React.useState<Tab>(props.initialTab ?? 'followers');

  type Slice = {
    items: UserWithFollow[];
    nextCursor: string | null;
    loading: boolean;
    inited: boolean;
  };
  const [state, setState] = React.useState<Record<Tab, Slice>>({
    followers:   { items: [], nextCursor: null, loading: false, inited: false },
    following:   { items: [], nextCursor: null, loading: false, inited: false },
    vFollowing:  { items: [], nextCursor: null, loading: false, inited: false },
    vFollowers:  { items: [], nextCursor: null, loading: false, inited: false },
  });

  // Seed initial tab from SSR
  React.useEffect(() => {
    setState(s => ({
      ...s,
      [props.initialTab ?? 'followers']: {
        items: props.initialItems,
        nextCursor: props.initialNextCursor,
        loading: false,
        inited: true,
      },
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const fetchPage = React.useCallback(async (t: Tab) => {
    setState(s => {
      if (s[t].loading || (s[t].inited && !s[t].nextCursor)) return s;
      return { ...s, [t]: { ...s[t], loading: true } };
    });

    try {
      const nextCursor = (prev => prev[t].inited ? prev[t].nextCursor : null)(state);
      const qs = new URLSearchParams({
        tab: t,
        take: '30',
        ...(nextCursor ? { cursor: nextCursor } : {}),
      });
      const res = await fetch(`/api/profile/${props.handle}/follows?${qs.toString()}`, { cache: 'no-store' });
      const j: { ok: boolean; items?: UserWithFollow[]; nextCursor?: string | null } = await res.json();
      if (!j?.ok) throw new Error('fetch failed');

      setState(prev => {
        const prevItems = prev[t].items;
        // Dedupe by id
        const seen = new Set(prevItems.map(i => i.id));
        const merged = prevItems.concat((j.items || []).filter(i => !seen.has(i.id)));
        return {
          ...prev,
          [t]: {
            items: merged,
            nextCursor: j.nextCursor ?? null,
            loading: false,
            inited: true,
          },
        };
      });
    } catch {
      setState(prev => ({ ...prev, [t]: { ...prev[t], loading: false, inited: true } }));
    }
  }, [props.handle, state]);

  // Init fetch for a tab when selected the first time
  React.useEffect(() => {
    setTimeout(() => {
      setState(s => {
        if (s[tab].inited) return s;
        // kick initial load (first page already delivered for initialTab)
        return s;
      });
    }, 0);
    if (!state[tab].inited && tab !== (props.initialTab ?? 'followers')) {
      fetchPage(tab);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // IntersectionObserver: wenn Sentinel sichtbar → nachladen
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.some(e => e.isIntersecting);
      if (!vis) return;
      const slice = state[tab];
      if (slice.loading) return;
      if (!slice.inited) {
        // initial load for this tab
        fetchPage(tab);
      } else if (slice.nextCursor) {
        fetchPage(tab);
      }
    }, { rootMargin: '400px 0px 400px 0px', threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [state, tab, fetchPage]);

  const current = state[tab];
  return (
    <>
      <FollowTabsInline
        active={tab}
        setActive={(t) => setTab(t)}
        counts={props.counts}
      />

      <ul className="divide-y divide-white/10">
        {current.items.map((u) => (
          <ListItem key={u.id} locale={props.locale} u={u} meId={props.meId} />
        ))}

        {current.items.length === 0 && !current.loading && current.inited && (
          <li className="px-4 py-10 text-center opacity-70">
            {tab === 'followers'
              ? 'No followers yet.'
              : tab === 'following'
              ? 'Not following anyone yet.'
              : tab === 'vFollowing'
              ? 'No verified following yet.'
              : 'No verified followers yet.'}
          </li>
        )}
      </ul>

      {/* Sentinel + Loader */}
      <div ref={sentinelRef} />
      {current.loading && (
        <div className="py-4 text-center text-white/70">Loading…</div>
      )}
      {!current.nextCursor && current.inited && current.items.length > 0 && (
        <div className="py-4 text-center text-white/40 text-sm">End of list</div>
      )}
    </>
  );
}
