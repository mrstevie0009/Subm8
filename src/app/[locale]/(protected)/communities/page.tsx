//src/app/[locale]/(protected)/communities/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import CommunityJoinButton from '@/components/CommunityJoinButton';
import CreateCommunityButton from '@/components/CreateCommunityButton';
import { toast } from '@/lib/toast';
import { createPortal } from 'react-dom';

const COMMS_CACHE_DISCOVER = 'communities:discover:v1';
const COMMS_CACHE_YOURS    = 'communities:yours:v1';

function readCachedCommunities(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { ts, items } = JSON.parse(raw) as { ts: number; items: CommunityItem[] };
    if (Date.now() - ts > 3 * 60 * 1000) return null; // bis 3 Minuten frisch
    return items as CommunityItem[];
  } catch { return null; }
}
function writeCachedCommunities(key: string, items: CommunityItem[]) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), items }));
  } catch {}
}

const BANNER_PH = '/images/banner-placeholder.png';

type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';
type Role = 'DOMME' | 'SUBMISSIVE' | null;

type CommunityItem = {
  id: string;
  slug: string;
  name: string;
  description: string;
  members: number;
  joined: boolean;
  policy: JoinPolicy;
  bannerUrl?: string | null;
  /** vom Server geliefert */
  isOwner?: boolean;
};

// Policy-Badge Klassen (nur Styling)
function policyClasses(p: JoinPolicy) {
  switch (p) {
    case 'OPEN':
      return 'text-white/85 border-white/15 bg-white/5';
    case 'INVITE_ONLY':
      return 'text-white/85 border-white/20 bg-white/5';
    case 'DOMME_ONLY':
      return 'text-purple-300 border-purple-400/30 bg-purple-500/10';
    case 'SUB_ONLY':
      return 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10';
    default:
      return 'text-white/80 border-white/15 bg-white/5';
  }
}

// Darf ich clientseitig "Join" anbieten?
function canJoinByRole(policy: JoinPolicy, role: Role): boolean {
  if (policy === 'INVITE_ONLY') return false;
  if (policy === 'DOMME_ONLY') return role === 'DOMME';
  if (policy === 'SUB_ONLY') return role === 'SUBMISSIVE';
  return true; // OPEN
}

function CommunityCardSkeleton() {
  return (
    <article className="relative rounded-app border border-sub shadow-app overflow-hidden">
      <div className="h-28 bg-white/10 animate-pulse" />
      <div className="p-3">
        <div className="flex items-start gap-3">
          <div className="size-10 rounded-full bg-white/10 border border-white/20 animate-pulse" />
          <div className="min-w-0 flex-1">
            <div className="h-3 w-44 bg-white/10 rounded animate-pulse" />
            <div className="mt-2 h-3 w-28 bg-white/10 rounded animate-pulse" />
            <div className="mt-3 h-5 w-24 bg-white/10 rounded-full animate-pulse" />
          </div>
        </div>
        <div className="mt-3 h-3 w-[85%] bg-white/10 rounded animate-pulse" />
        <div className="mt-2 h-3 w-[60%] bg-white/10 rounded animate-pulse" />
        <div className="mt-4 flex items-center justify-between">
          <div className="h-3 w-24 bg-white/10 rounded animate-pulse" />
          <div className="h-8 w-24 bg-white/10 rounded-full animate-pulse" />
        </div>
      </div>
    </article>
  );
}

export default function CommunitiesPage() {
  const locale = useLocale();
  const t = useTranslations('communities.communitiesPage');
  const ttt = useTranslations('communities.communities.create');
  const tt = useTranslations('home.toast');

  const policyLabel = React.useCallback(
    (p: JoinPolicy) =>
      p === 'OPEN'
        ? t('policy.open')
        : p === 'INVITE_ONLY'
        ? t('policy.inviteOnly')
        : p === 'DOMME_ONLY'
        ? t('policy.dommesOnly')
        : t('policy.subsOnly'),
    [t]
  );

  const [tab, setTab] = React.useState<'discover' | 'yours'>('discover');
  const [discover, setDiscover] = React.useState<CommunityItem[]>([]);
  const [mine, setMine] = React.useState<CommunityItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const [viewerRole, setViewerRole] = React.useState<Role>(null);
  const latestReqRef = React.useRef(0);
  const pollRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch('/api/me', { cache: 'no-store' });
        if (!r.ok) return;
        const j = await r.json().catch(() => null);
        if (!cancelled && j && 'role' in j) {
          const v = j.role as Role;
          setViewerRole(v ?? null);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const myReq = ++latestReqRef.current;

    (async () => {
      setLoading(true);

      // 1) Cache sofort anzeigen
      const cacheKey = tab === 'discover' ? COMMS_CACHE_DISCOVER : COMMS_CACHE_YOURS;
      const cached = readCachedCommunities(cacheKey);
      if (!cancelled && cached) {
        if (tab === 'discover') setDiscover(cached);
        else setMine(cached);
        setLoading(false); // UI sofort sichtbar
      }

      // 2) Netzwerk – frische Daten
      try {
        const ctrl = new AbortController();
        const tmo = setTimeout(() => ctrl.abort(), 12000);

        const url =
          tab === 'discover'
            ? '/api/communities?limit=24'
            : '/api/communities?mine=1&limit=48';

        const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
        clearTimeout(tmo);

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as { ok: boolean; items: CommunityItem[] };
        if (!j?.ok) throw new Error('Bad payload');

        if (cancelled || myReq !== latestReqRef.current) return;

        if (tab === 'discover') setDiscover(j.items);
        else setMine(j.items);

        writeCachedCommunities(cacheKey, j.items);
      } catch {
        /* leise: wir haben evtl. Cache gezeigt */
      } finally {
        if (!cancelled && myReq === latestReqRef.current) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [tab]);

  React.useEffect(() => {
    const tick = async () => {
      const myReq = ++latestReqRef.current;
      try {
        const url =
          tab === 'discover'
            ? '/api/communities?limit=24'
            : '/api/communities?mine=1&limit=48';

        const res = await fetch(url, { cache: 'no-store' });
        const j = await res.json().catch(() => null);
        if (!j?.ok || myReq !== latestReqRef.current) return;

        const fresh = j.items as CommunityItem[];
        const before = (tab === 'discover' ? discover : mine)
          .map(i => `${i.id}:${i.members}:${i.joined}`)
          .join('|');
        const after = fresh.map(i => `${i.id}:${i.members}:${i.joined}`).join('|');

        if (before !== after) {
          if (tab === 'discover') setDiscover(fresh);
          else setMine(fresh);
          writeCachedCommunities(tab === 'discover' ? COMMS_CACHE_DISCOVER : COMMS_CACHE_YOURS, fresh);
        }
      } catch {}
    };

    const onVis = () => { if (!document.hidden) tick(); };
    document.addEventListener('visibilitychange', onVis);

    pollRef.current = window.setInterval(() => {
      if (!document.hidden) tick();
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', onVis);
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

  }, [tab, discover, mine]);

  /* ------------------------ Delete Modal State & Logic ------------------------ */
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<{ slug: string; name: string } | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  function openDelete(c: { slug: string; name: string }) {
    setDeleteTarget({ slug: c.slug, name: c.name });
    setDeleteOpen(true);
  }
  // 1) closeDelete stabil machen
  const closeDelete = React.useCallback(() => {
    if (deleting) return;
    setDeleteOpen(false);
    setDeleteTarget(null);
  }, [deleting]);

  // 2) Effect-Dependencies anpassen
  React.useEffect(() => {
      if (!deleteOpen) return;
      const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDelete(); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
  }, [deleteOpen, closeDelete]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const slug = deleteTarget.slug;
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}`, { method: 'DELETE' });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) {
        toast.error(tt('generic.failedTitle'), j?.error || `HTTP ${res.status}`);
        return;
      }

      // Aus aktuellem Tab entfernen
      if (tab === 'discover') {
        const next = discover.filter((c) => c.slug !== slug);
        setDiscover(next);
        writeCachedCommunities(COMMS_CACHE_DISCOVER, next);
      } else {
        const next = mine.filter((c) => c.slug !== slug);
        setMine(next);
        writeCachedCommunities(COMMS_CACHE_YOURS, next);
      }

      toast.show({ title: t('delete.success'), variant: 'success', durationMs: 1800 });
      closeDelete();
    } catch (e) {
      toast.error(tt('generic.failedTitle'), e instanceof Error ? e.message : 'Failed');
    } finally {
      setDeleting(false);
    }
  }
  /* --------------------------------------------------------------------------- */

  const list = tab === 'discover' ? discover : mine;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header + Tabs */}
      <div className="sticky top=[calc(var(--header-h))] top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">{t('title')}</div>
          <CreateCommunityButton />
        </div>
        <div className="grid grid-cols-2">
          {(['discover', 'yours'] as const).map((k) => {
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`py-3 font-medium ${active ? 'text-white' : 'text-white/70'} relative`}
              >
                {k === 'discover' ? t('tabs.discover') : t('tabs.yours')}
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--purple)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <>
            {Array.from({ length: 9 }).map((_, i) => <CommunityCardSkeleton key={i} />)}
          </>
        )}

        {!loading && list.length === 0 && (
          <div className="col-span-full text-center opacity-70 py-10">
            {tab === 'discover' ? t('empty.discover') : t('empty.yours')}
          </div>
        )}

        {!loading &&
          list.map((c) => {
            const blocked = !c.joined && !canJoinByRole(c.policy, viewerRole);
            return (
              <article
                key={c.id}
                className={`relative rounded-app border border-sub shadow-app overflow-hidden flex flex-col ${blocked ? 'opacity-60 saturate-50' : ''}`}
                data-disabled={blocked ? true : undefined}
              >
                {/* Banner */}
                <div className="relative h-28 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.bannerUrl || BANNER_PH} alt="" className="object-cover w-full h-full" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/30" />
                </div>

                {c.isOwner && (
                  <button
                    type="button"
                    title={t('delete.title')}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); openDelete(c); }}
                    className="absolute top-2 right-2 z-20 px-3 h-8 rounded-full
                              bg-black text-red-200 border border-red-400/40
                              hover:bg-black/80 shadow"
                    data-no-nav
                  >
                    {t('delete.button')}
                  </button>
                )}

                {/* Body */}
                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 size-10 rounded-full grid place-items-center bg-white/10 border border-white/20">
                      <span className="font-semibold">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-sm opacity-70 truncate">@{c.slug}</div>
                      <div className="mt-1">
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${policyClasses(c.policy)}`}>
                          {c.policy === 'INVITE_ONLY' && (
                            <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="4" y="10" width="16" height="10" rx="2" />
                              <path d="M8 10V7a4 4 0 1 1 8 0v3" />
                            </svg>
                          )}
                          {policyLabel(c.policy)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-2 text-sm opacity-90 line-clamp-2">{c.description}</p>

                  <div className="mt-auto pt-3 flex items-center justify-between relative z-20">
                    <Link
                      href={`/${locale}/communities/${c.slug}/members`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[.06] hover:bg-white/[.1] px-3 py-1.5 text-sm text-white transition focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/60 shadow-sm hover:shadow"
                      aria-label={`${Intl.NumberFormat(locale).format(c.members)} members – open members list`}
                      data-no-nav
                    >
                      <UsersIcon className="opacity-90" />
                      <span className="font-medium">Members</span>
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10 tabular-nums">
                        {Intl.NumberFormat(locale).format(c.members)}
                      </span>
                    </Link>

                    <div className="flex items-center gap-2">
                      <CommunityJoinButton
                        slug={c.slug}
                        initialJoined={c.joined}
                        initialMembers={c.members}
                        policy={c.policy}
                        viewerRole={viewerRole}
                      />
                    </div>
                  </div>
                </div>

                {/* Klick-Overlay */}
                {blocked ? (
                  <div
                    className="absolute inset-0 z-10 cursor-not-allowed"
                    aria-hidden
                    tabIndex={-1}
                    title={
                      c.policy === 'INVITE_ONLY'
                        ? t('blocked.inviteOnly')
                        : c.policy === 'DOMME_ONLY'
                        ? t('blocked.dommesOnly')
                        : t('blocked.subsOnly')
                    }
                  />
                ) : (
                  <Link href={`/${locale}/communities/${c.slug}`} className="absolute inset-0 z-10" aria-label={c.name} />
                )}
              </article>
            );
          })}
      </div>

      {/* Delete confirmation modal */}
      {deleteOpen && createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="delTitle" className="fixed inset-0 z-[2147483646]">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeDelete} />
          {/* Sheet */}
          <div
            className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#101114] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div id="delTitle" className="text-base sm:text-lg font-semibold">
                {t('delete.title')}
              </div>
              <button
                type="button"
                onClick={closeDelete}
                className="inline-grid place-items-center size-8 rounded-lg hover:bg-white/10"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-2">
              <p className="text-white/90">{t('delete.confirm')}</p>
              {deleteTarget?.name && (
                <p className="text-sm text-white/60">
                  <span className="opacity-80">Community:</span> <span className="font-medium">{deleteTarget.name}</span>
                </p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={closeDelete}
                className="px-4 h-9 rounded-full border border-white/15 hover:bg-white/10 disabled:opacity-50"
              >
                {ttt('actions.cancel', { default: 'Cancel' })}
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 h-9 rounded-full bg-red-600/90 hover:bg-red-600 text-white disabled:opacity-50"
              >
                {deleting ? t('loading', { default: 'Deleting…' }) : t('delete.button')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );

  function UsersIcon({ className }: { className?: string }) {
    return (
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
}
