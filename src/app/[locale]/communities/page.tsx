'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import CommunityJoinButton from '@/components/CommunityJoinButton';
import CreateCommunityButton from '@/components/CreateCommunityButton';

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

export default function CommunitiesPage() {
  const locale = useLocale();
  const t = useTranslations('common.communitiesPage');

  // Policy-Label via i18n
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

  // Viewer-Rolle (für Ausgrauen/Disable)
  const [viewerRole, setViewerRole] = React.useState<Role>(null);
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

    async function load() {
      setLoading(true);
      try {
        if (tab === 'discover') {
          const r = await fetch('/api/communities?limit=24', { cache: 'no-store' });
          const j = (await r.json()) as { ok: boolean; items: CommunityItem[] };
          if (!cancelled && j?.ok) setDiscover(j.items);
        } else {
          const r = await fetch('/api/communities?mine=1&limit=48', { cache: 'no-store' });
          const j = (await r.json()) as { ok: boolean; items: CommunityItem[] };
          if (!cancelled && j?.ok) setMine(j.items);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  const list = tab === 'discover' ? discover : mine;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header + Tabs */}
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
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
        {loading && <div className="col-span-full text-center opacity-70 py-8">{t('loading')}</div>}

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
                className={`relative rounded-app border border-sub shadow-app overflow-hidden flex flex-col ${
                  blocked ? 'opacity-60 saturate-50' : ''
                }`}
                data-disabled={blocked ? true : undefined}
              >
                {/* Banner */}
                <div className="relative h-28 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.bannerUrl || BANNER_PH} alt="" className="object-cover w-full h-full" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/30" />
                </div>

                {/* Body */}
                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex items-start gap-3">
                    {/* simple letter avatar */}
                    <div className="shrink-0 size-10 rounded-full grid place-items-center bg-white/10 border border-white/20">
                      <span className="font-semibold">{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-sm opacity-70 truncate">@{c.slug}</div>

                      {/* Policy-Badge */}
                      <div className="mt-1">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${policyClasses(
                            c.policy
                          )}`}
                        >
                          {/* kleines Icon für Invite */}
                          {c.policy === 'INVITE_ONLY' && (
                            <svg
                              viewBox="0 0 24 24"
                              width="12"
                              height="12"
                              aria-hidden
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
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
                    <span className="text-sm opacity-80">
                      {t('members', { count: Intl.NumberFormat().format(c.members) })}
                    </span>
                    <CommunityJoinButton
                      slug={c.slug}
                      initialJoined={c.joined}
                      initialMembers={c.members}
                      policy={c.policy}
                      viewerRole={viewerRole}
                    />
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
    </div>
  );
}
