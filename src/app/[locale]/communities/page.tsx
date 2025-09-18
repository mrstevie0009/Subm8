//src/app/[locale]/communities/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import CommunityJoinButton from '@/components/CommunityJoinButton';
import CreateCommunityButton from '@/components/CreateCommunityButton';

const BANNER_PH = '/images/banner-placeholder.png';

type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';

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

export default function CommunitiesPage() {
  const locale = useLocale();
  const [tab, setTab] = React.useState<'discover' | 'yours'>('discover');
  const [discover, setDiscover] = React.useState<CommunityItem[]>([]);
  const [mine, setMine] = React.useState<CommunityItem[]>([]);
  const [loading, setLoading] = React.useState(false);

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
    return () => { cancelled = true; };
  }, [tab]);

  const list = tab === 'discover' ? discover : mine;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header + Tabs */}
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Communities</div>
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
                {k === 'discover' ? 'Discover' : 'Your communities'}
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--purple)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="col-span-full text-center opacity-70 py-8">Lade…</div>
        )}

        {!loading && list.length === 0 && (
          <div className="col-span-full text-center opacity-70 py-10">
            {tab === 'discover' ? 'Noch keine Communities gefunden.' : 'Du bist noch keiner Community beigetreten.'}
          </div>
        )}

        {!loading && list.map((c) => (
          <article
            key={c.id}
            className="relative rounded-app border border-sub shadow-app overflow-hidden flex flex-col"
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
                </div>
              </div>

              <p className="mt-2 text-sm opacity-90 line-clamp-2">{c.description}</p>

              <div className="mt-auto pt-3 flex items-center justify-between relative z-20">
                <span className="text-sm opacity-80">{c.members.toLocaleString()} members</span>
                <CommunityJoinButton
                  slug={c.slug}
                  initialJoined={c.joined}
                  initialMembers={c.members}
                />
              </div>
            </div>

            {/* Klick-Overlay */}
            <Link
              href={`/${locale}/communities/${c.slug}`}
              className="absolute inset-0 z-10"
              aria-label={c.name}
            />
          </article>
        ))}
      </div>
    </div>
  );
}
