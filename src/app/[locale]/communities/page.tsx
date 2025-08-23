'use client';

import * as React from 'react';

type Community = {
  id: string;
  name: string;
  handle: string;
  members: number;
  banner?: string;
  about: string;
};

const BANNER_PH = '/images/banner-placeholder.png';

export default function CommunitiesPage() {
  const [tab, setTab] = React.useState<'discover' | 'yours'>('discover');

  const discover: Community[] = [
    { id: 'c1', name: 'Findom Europe', handle: 'findom-eu', members: 3210, about: 'EU based findom & tips' },
    { id: 'c2', name: 'Aftercare', handle: 'aftercare', members: 1540, about: 'Care, talk & resources' },
    { id: 'c3', name: 'Rope & Knots', handle: 'rope-knots', members: 780, about: 'Shibari & safety' },
  ];
  const yours: Community[] = [
    { id: 'c4', name: 'Vienna Kink', handle: 'vienna-kink', members: 420, about: 'Local meetups in Vienna' },
  ];

  const list = tab === 'discover' ? discover : yours;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header + Tabs */}
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Communities</div>
          <button className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95">
            New Community
          </button>
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
        {list.map((c) => (
          <article
            key={c.id}
            className="rounded-app border border-sub shadow-app overflow-hidden flex flex-col"
          >
            {/* Banner */}
            <div className="relative h-28 bg-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.banner || BANNER_PH} alt="" className="object-cover w-full h-full" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 to-black/30" />
            </div>

            {/* Body */}
            <div className="p-3 flex-1 flex flex-col">
              <div className="flex items-start gap-3">
                {/* simple letter avatar */}
                <div className="shrink-0 size-10 rounded-full grid place-items-center bg-white/10 border border-white/20">
                  <span className="font-semibold">{c.name.charAt(0)}</span>
                </div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{c.name}</div>
                  <div className="text-sm opacity-70 truncate">@{c.handle}</div>
                </div>
              </div>

              <p className="mt-2 text-sm opacity-90 line-clamp-2">{c.about}</p>

              <div className="mt-auto pt-3 flex items-center justify-between">
                <span className="text-sm opacity-80">{c.members.toLocaleString()} members</span>
                <button className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5">
                  Join
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
