'use client';

import * as React from 'react';
import Image from 'next/image';

type UserSug = { handle: string; name: string; avatar?: string };
const AVATAR_PH = '/images/avatar-placeholder.png';

export default function SearchPage() {
  const [q, setQ] = React.useState('');
  const [recent, setRecent] = React.useState<string[]>(['more4eve', 'domme tips', 'vienna']);
  const trending = [
    { tag: 'Findom', posts: '14.7K' },
    { tag: 'NSFW', posts: '89.2K' },
    { tag: 'BDSM', posts: '41.3K' },
    { tag: 'aftercare', posts: '3,201' },
  ];
  const suggestions: UserSug[] = [
    { handle: 'mistress_aria', name: 'Mistress Aria' },
    { handle: 'user1001', name: 'User 1001' },
    { handle: 'rope_nerd', name: 'Rope Nerd' },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      {/* Sticky Suchleiste */}
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70" aria-hidden>
              <SearchIcon />
            </span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search Subm8"
              className="w-full pl-10 pr-3 h-11 rounded-full bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
          </label>
        </div>
      </div>

      <div className="p-4 grid gap-6">
        {/* Recent */}
        {recent.length > 0 && (
          <section className="rounded-app border border-sub shadow-app">
            <header className="px-4 py-3 border-b border-white/10 font-semibold">Recent</header>
            <ul>
              {recent.map((r) => (
                <li
                  key={r}
                  className="flex items-center justify-between px-4 py-3 hover:bg-white/5"
                >
                  <button
                    className="text-left truncate hover:underline"
                    onClick={() => setQ(r)}
                    title={r}
                  >
                    #{r}
                  </button>
                  <button
                    className="text-muted hover:text-white/90"
                    onClick={() => setRecent((arr) => arr.filter((x) => x !== r))}
                    aria-label={`Remove ${r}`}
                    title="Remove"
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Trending */}
        <section className="rounded-app border border-sub shadow-app">
          <header className="px-4 py-3 border-b border-white/10 font-semibold">
            Trending now
          </header>
          <ul>
            {trending.map((t, i) => (
              <li key={t.tag} className="px-4 py-3 hover:bg-white/5">
                <div className="text-sm opacity-70">#{i + 1} · Topic</div>
                <div className="font-medium">{t.tag}</div>
                <div className="text-sm opacity-70">{t.posts} posts</div>
              </li>
            ))}
          </ul>
        </section>

        {/* People */}
        <section className="rounded-app border border-sub shadow-app">
          <header className="px-4 py-3 border-b border-white/10 font-semibold">
            People you may like
          </header>
          <ul className="divide-y divide-white/10">
            {suggestions.map((u) => (
              <li key={u.handle} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    src={u.avatar || AVATAR_PH}
                    alt=""
                    width={40}
                    height={40}
                    className="rounded-full object-cover border border-white/15"
                    sizes="40px"
                  />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.name}</div>
                    <div className="text-sm opacity-70 truncate">@{u.handle}</div>
                  </div>
                </div>
                <button className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95">
                  Follow
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
