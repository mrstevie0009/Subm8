//src/components/CommunityMembersClient.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
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
  isAdmin: boolean;
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

function SearchBar({
  value,
  onChange,
  onClear,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="px-3 sm:px-4 pb-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        className="relative"
      >
        {/* Search icon */}
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 opacity-70">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
        </div>

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search members…"
          className="
            w-full h-10 rounded-full
            bg-white/[.04] border border-white/12
            pl-9 pr-10
            text-sm text-white placeholder:text-white/45
            outline-none
            focus:border-white/20 focus:bg-white/[.06]
          "
        />

        {/* Clear (X) */}
        {value.trim().length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="
              absolute right-2 top-1/2 -translate-y-1/2
              size-7 rounded-full
              grid place-items-center
              border border-white/10 bg-black/30
              hover:bg-white/10
            "
            aria-label="Clear search"
            title="Clear"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </form>

      {/* Optional hint row (keeps UI tight and polished) */}
      <div className="mt-2 text-xs text-white/45">
        Press Enter to keep the filter. Clear with the X.
      </div>
    </div>
  );
}

function ListItem({
  locale, u, meId, canKick, onKick,
}: {
  locale: string;
  u: UserWithFollow;
  meId: string | null;
  canKick: boolean;
  onKick: (user: UserWithFollow) => void;
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

      <div className="shrink-0 flex items-center gap-2">
        {meId && meId !== u.id ? (
          <FollowInlineButton targetUserId={u.id} initialFollowing={u.initialFollowing} />
        ) : null}

        {canKick && meId && u.id !== meId ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onKick(u);
            }}
            className="
              px-3 py-1.5 rounded-full
              border border-red-500/35
              bg-red-500/10
              text-red-200
              hover:bg-red-500/20
              hover:border-red-400/50
              transition
            "
            aria-label={`Kick @${u.handle}`}
            title="Kick"
          >
            Kick
          </button>
        ) : null}
      </div>
    </li>
  );
}

function isVerifiedMember(u: UserLite) {
  const first = !!u.isFirstAdopter;
  const until = u.premiumUntil ? new Date(u.premiumUntil) : null;
  const premium = !!until && until.getTime() > Date.now();
  return first || premium;
}

export default function CommunityMembersClient(props: CommunityMembersClientProps) {
  const [tab, setTab] = React.useState<Tab>(props.initialTab ?? 'members');

  const [counts, setCounts] = React.useState(props.counts);

  const [searchDraft, setSearchDraft] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState(''); // committed

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

  const [kickOpen, setKickOpen] = React.useState(false);
  const [kickTarget, setKickTarget] = React.useState<UserWithFollow | null>(null);
  const [kicking, setKicking] = React.useState(false);

  const openKick = React.useCallback((u: UserWithFollow) => {
    if (!props.isAdmin) return;
    if (!props.meId) return;
    if (u.id === props.meId) return;
    setKickTarget(u);
    setKickOpen(true);
  }, [props.isAdmin, props.meId]);

  const closeKick = React.useCallback(() => {
    if (kicking) return;
    setKickOpen(false);
    setKickTarget(null);
  }, [kicking]);

  React.useEffect(() => {
    if (!kickOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeKick();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kickOpen, closeKick]);

  const kickMemberConfirmed = React.useCallback(async () => {
    if (!props.isAdmin) return;
    if (!props.meId) return;
    if (!kickTarget) return;

    const userId = kickTarget.id;
    if (userId === props.meId) return;

    setKicking(true);
    try {
      const res = await fetch(`/api/communities/${props.slug}/members/kick`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const j: { ok: boolean; error?: string } = await res.json().catch(() => ({ ok: false }));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP_${res.status}`);

      // remove from BOTH tab slices + update counts ONCE (based on what we currently have loaded)
      setState((prev) => {
        const target =
          prev.members.items.find((u) => u.id === userId) ??
          prev.verified.items.find((u) => u.id === userId) ??
          kickTarget;

        const drop = (items: UserWithFollow[]) => items.filter((u) => u.id !== userId);

        // counts update derived from target
        setCounts((cPrev) => {
          const nextMembers = Math.max(0, (cPrev.members ?? 0) - 1);
          const decVerified = target ? isVerifiedMember(target) : false;
          const nextVerified = Math.max(0, (cPrev.verified ?? 0) - (decVerified ? 1 : 0));
          return { members: nextMembers, verified: nextVerified };
        });

        return {
          members:  { ...prev.members,  items: drop(prev.members.items) },
          verified: { ...prev.verified, items: drop(prev.verified.items) },
        };
      });

      closeKick();
    } catch {
      // später gern toast; für jetzt minimal
      alert('Konnte Member nicht entfernen.');
    } finally {
      setKicking(false);
    }
  }, [props.isAdmin, props.meId, props.slug, kickTarget, closeKick]);

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
        ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
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
  }, [props.slug, state, searchQuery]);

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

      // ✅ NEW: don't auto-load more while searching
      if (searchDraft.trim().length > 0) return;

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
  }, [state, tab, fetchPage, searchDraft]);

  const current = state[tab];

  // ✅ NEW: computed filtered list (instant as you type)
  const q = searchDraft.trim().toLowerCase();
  const filteredItems = React.useMemo(() => {
    if (!q) return current.items;
    return current.items.filter((u) => {
      const hay = `${u.displayName} @${u.handle}`.toLowerCase();
      return hay.includes(q);
    });
  }, [current.items, q]);

  return (
    <>
      <TabsInline active={tab} setActive={setTab} counts={counts} />

      {/* ✅ NEW: Search UI */}
      <SearchBar
        value={searchDraft}
        onChange={(v) => setSearchDraft(v)}
        onClear={() => {
          setSearchDraft('');
          setSearchQuery('');
        }}
        onSubmit={() => {
          setSearchQuery(searchDraft.trim());
        }}
      />

      <ul className="divide-y divide-white/10">
        {filteredItems.map((u) => (
          <ListItem
            key={u.id}
            locale={props.locale}
            u={u}
            meId={props.meId}
            canKick={props.isAdmin}
            onKick={openKick}
          />
        ))}

        {filteredItems.length === 0 && !current.loading && current.inited && (
          <li className="px-4 py-10 text-center opacity-70">
            {q ? 'No matches.' : tab === 'members' ? 'No members yet.' : 'No verified members yet.'}
          </li>
        )}
      </ul>

      <div ref={sentinelRef} />
      {current.loading && <div className="py-4 text-center text-white/70">Loading…</div>}
      {!current.nextCursor && current.inited && current.items.length > 0 && (
        <div className="py-4 text-center text-white/40 text-sm">End of list</div>
      )}

      {kickOpen && createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="kickTitle" className="fixed inset-0 z-[2147483646]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeKick} />

          {/* Modal */}
          <div
            className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#101114] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div id="kickTitle" className="text-base sm:text-lg font-semibold">
                Member entfernen
              </div>

              <button
                type="button"
                onClick={closeKick}
                className="inline-grid place-items-center size-8 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              <p className="text-white/90">
                Member wirklich aus der Community entfernen?
              </p>

              {kickTarget && (
                <p className="text-sm text-white/60">
                  <span className="opacity-80">Member:</span>{' '}
                  <span className="font-medium">{kickTarget.displayName}</span>{' '}
                  <span className="opacity-70">@{kickTarget.handle}</span>
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={kicking}
                onClick={closeKick}
                className="px-4 h-9 rounded-full border border-white/15 hover:bg-white/10 disabled:opacity-50"
              >
                Abbrechen
              </button>

              <button
                type="button"
                onClick={kickMemberConfirmed}
                disabled={kicking || !kickTarget}
                className="px-4 h-9 rounded-full bg-red-600/90 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {kicking ? 'Entferne…' : 'Kick'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
