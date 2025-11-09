'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FollowInlineButton from '@/components/FollowInlineButton';
import { UserBadges } from '@/components/UserBadges';

const AVATAR_PH = '/images/avatar-placeholder.png';

export type UserLite = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  premiumUntil: string | Date | null;
  isFirstAdopter?: boolean | null;
  role: 'DOMME' | 'SUBMISSIVE' | string;
};

type Tab = 'members' | 'verified';
type UserWithFollow = UserLite & { initialFollowing: boolean };

export type CommunityMembersClientProps = {
  locale: string;
  slug: string;
  meId: string | null;
  counts: { members: number; verified: number };
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

function TabsInline({
  active, setActive, counts,
}: {
  active: Tab;
  setActive: (t: Tab) => void;
  counts: { members: number; verified: number };
}) {
  const tabs: Array<{ key: Tab; label: string; count: number }> = [
    { key: 'members',  label: 'Members',          count: counts.members },
    { key: 'verified', label: 'Verified Members', count: counts.verified },
  ];
  return (
    <div className="px-3 sm:px-4 pb-2">
      <div className="w-full">
        <div className="flex w-full rounded-full border border-white/12 bg-white/[.04] p-1 backdrop-blur">
          {tabs.map(t => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={`flex-1 px-3 sm:px-4 py-1.5 text-sm rounded-full transition
                  ${isActive
                    ? 'bg-[var(--purple)] text-white shadow-[0_6px_20px_-10px_rgba(139,92,246,.9)]'
                    : 'text-white/80 hover:bg-white/[.08]'}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {t.label}
                  <span className={`text-[11px] tabular-nums ${isActive ? 'text-white/95' : 'text-white/60'}`}>
                    {t.count.toLocaleString()}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ListItem({
  locale, u, meId,
}: {
  locale: string; u: UserWithFollow; meId: string | null;
}) {
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

export default function CommunityMembersClient(props: CommunityMembersClientProps) {
  const [tab, setTab] = React.useState<Tab>(props.initialTab ?? 'members');

  type Slice = { items: UserWithFollow[]; nextCursor: string | null; loading: boolean; inited: boolean };
  const [state, setState] = React.useState<Record<Tab, Slice>>({
    members:  { items: [], nextCursor: null, loading: false, inited: false },
    verified: { items: [], nextCursor: null, loading: false, inited: false },
  });

  // seed initial tab from SSR
  React.useEffect(() => {
    setState(s => ({
      ...s,
      [props.initialTab ?? 'members']: {
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
    setState(prev => {
      const slice = prev[t];
      if (slice.loading) return prev;
      if (slice.inited && !slice.nextCursor) return prev; // nichts mehr zu laden
      return { ...prev, [t]: { ...slice, loading: true } };
    });

    try {
      const nextCursor = state[t].inited ? state[t].nextCursor : null;
      const qs = new URLSearchParams({
        tab: t,
        take: '30',
        ...(nextCursor ? { cursor: nextCursor } : {}),
      });
      const res = await fetch(`/api/communities/${props.slug}/members?${qs.toString()}`, { cache: 'no-store' });
      const j: { ok: boolean; items?: UserWithFollow[]; nextCursor?: string | null } = await res.json();
      if (!j?.ok) throw new Error('fetch failed');

      setState(prev => {
        const prevItems = prev[t].items;
        const seen = new Set(prevItems.map(i => i.id));
        const merged = prevItems.concat((j.items || []).filter(i => !seen.has(i.id)));
        return {
          ...prev,
          [t]: { items: merged, nextCursor: j.nextCursor ?? null, loading: false, inited: true },
        };
      });
    } catch {
      setState(prev => ({ ...prev, [t]: { ...prev[t], loading: false, inited: true } }));
    }
  }, [props.slug, state]);

  // Bei Tab-Wechsel: wenn noch nicht geladen (und nicht der initiale SSR-Tab), erste Seite holen
  React.useEffect(() => {
    if (!state[tab].inited && tab !== (props.initialTab ?? 'members')) {
      fetchPage(tab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Infinite scroll via IntersectionObserver
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const vis = entries.some(e => e.isIntersecting);
      if (!vis) return;

      const slice = state[tab];
      if (slice.loading) return;

      if (!slice.inited) {
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
      <TabsInline active={tab} setActive={setTab} counts={props.counts} />

      <ul className="divide-y divide-white/10">
        {current.items.map((u) => (
          <ListItem key={u.id} locale={props.locale} u={u} meId={props.meId} />
        ))}

        {current.items.length === 0 && !current.loading && current.inited && (
          <li className="px-4 py-10 text-center opacity-70">
            {tab === 'members' ? 'No members yet.' : 'No verified members yet.'}
          </li>
        )}
      </ul>

      <div ref={sentinelRef} />
      {current.loading && <div className="py-4 text-center text-white/70">Loading…</div>}
      {!current.nextCursor && current.inited && current.items.length > 0 && (
        <div className="py-4 text-center text-white/40 text-sm">End of list</div>
      )}
    </>
  );
}
