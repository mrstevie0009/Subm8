'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';

type UserSug = { handle: string; name: string; avatar?: string; followers?: number };
type PostCounts = { likes: number; comments: number; bookmarks: number };
type Author = { handle: string; name: string; avatar?: string };
type PostItem = {
  id: string;
  text: string;
  mediaUrl?: string;
  mediaAlt?: string;
  createdAt: string | Date;
  author: Author;
  counts: PostCounts;
};

const AVATAR_PH = '/images/avatar-placeholder.png';

export default function SearchPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { locale } = useParams() as { locale: string };

  // Query & Tab aus URL
  const qParam = sp.get('q') || '';
  const tabParam = (sp.get('tab') || 'top') as 'top' | 'latest' | 'people';

  // Eingabefeld steuern
  const [q, setQ] = React.useState(qParam);
  React.useEffect(() => setQ(qParam), [qParam]);

  // ---- Startansicht-States (wenn q leer ist)
  const [recent, setRecent] = React.useState<string[]>([]);
  const [trending, setTrending] = React.useState<{ tag: string; posts: number }[]>([]);
  const [suggestPeople, setSuggestPeople] = React.useState<UserSug[]>([]);

  // Recent aus localStorage lesen (nur beim ersten Mount)
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem('subm8.search.recent');
      if (raw) {
        setRecent(JSON.parse(raw));
      } else {
        setRecent(['more4eve', 'domme tips', 'vienna']);
      }
    } catch {
      setRecent(['more4eve', 'domme tips', 'vienna']);
    }
  }, []);
  const saveRecent = React.useCallback((list: string[]) => {
    setRecent(list);
    try {
      localStorage.setItem('subm8.search.recent', JSON.stringify(list));
    } catch {}
  }, []);

  // Trending für Startansicht laden (Fallback wenn API nichts liefert)
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/search');
        const j = await res.json();
        if (j?.ok && Array.isArray(j.trending) && j.trending.length) {
          setTrending(j.trending.slice(0, 10));
          return;
        }
      } catch {
        /* noop */
      }
      // Fallback
      setTrending([
        { tag: 'Findom', posts: 14700 },
        { tag: 'NSFW', posts: 89200 },
        { tag: 'BDSM', posts: 41300 },
        { tag: 'aftercare', posts: 3201 },
      ]);
    })();
  }, []);
  // Vorschläge: Top-Follower (nur für Startansicht)
 React.useEffect(() => {
   if (qParam) return; // nur laden, wenn keine Suche aktiv
   (async () => {
     try {
       const res = await fetch('/api/users/suggest?limit=6', { cache: 'no-store' });
       const j = await res.json();
       if (j?.ok && Array.isArray(j.users)) setSuggestPeople(j.users);
     } catch {/* noop */}
   })();
 }, [qParam]);
  // Recent-Interaktionen (Startansicht)
  function applyRecent(r: string) {
    setQ(r);
    const next = [r, ...recent.filter((x) => x !== r)].slice(0, 10);
    saveRecent(next);
  }
  function removeRecent(r: string) {
    saveRecent(recent.filter((x) => x !== r));
  }

  // ---- Ergebnis-States (wenn q gesetzt ist)
  const [topUsers, setTopUsers] = React.useState<UserSug[]>([]);
  const [topPosts, setTopPosts] = React.useState<PostItem[]>([]);
  const [latestPosts, setLatestPosts] = React.useState<PostItem[]>([]);
  const [people, setPeople] = React.useState<UserSug[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Enter → URL updaten (ohne Layoutänderung)
  function goToQuery(nextTab?: 'top' | 'latest' | 'people') {
    const tab = nextTab || tabParam || 'top';
    const url = `/${locale}/search?q=${encodeURIComponent(q)}&tab=${tab}`;
    router.push(url);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToQuery();
    }
  }

  // Daten für aktive Tab-Kombination laden, wenn URL-Query sich ändert
  React.useEffect(() => {
    const query = sp.get('q') || '';
    const tab = (sp.get('tab') || 'top') as 'top' | 'latest' | 'people';
    if (!query) {
      setTopUsers([]);
      setTopPosts([]);
      setLatestPosts([]);
      setPeople([]);
      return;
    }
    setLoading(true);

    (async () => {
      try {
        if (tab === 'top') {
          const [uRes, pRes] = await Promise.all([
            fetch(`/api/search/users?q=${encodeURIComponent(query)}&sort=followers&limit=5`),
            fetch(`/api/search/posts?q=${encodeURIComponent(query)}&sort=top&limit=20`),
          ]);
          const [uj, pj] = await Promise.all([uRes.json(), pRes.json()]);
          setTopUsers(uj?.users ?? []);
          setTopPosts(pj?.posts ?? []);
        } else if (tab === 'latest') {
          const pRes = await fetch(
            `/api/search/posts?q=${encodeURIComponent(query)}&sort=latest&limit=20`
          );
          const pj = await pRes.json();
          setLatestPosts(pj?.posts ?? []);
        } else if (tab === 'people') {
          const uRes = await fetch(
            `/api/search/users?q=${encodeURIComponent(query)}&sort=followers&limit=20`
          );
          const uj = await uRes.json();
          setPeople(uj?.users ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sp]);

  // Tab-UI
  function TabLink({ id, label }: { id: 'top' | 'latest' | 'people'; label: string }) {
    const active = tabParam === id;
    const href = `/${locale}/search?q=${encodeURIComponent(qParam)}&tab=${id}`;
    return (
      <button
        onClick={() => router.push(href)}
        className={`px-3 py-2 text-sm border-b-2 ${
          active ? 'border-white' : 'border-transparent opacity-70 hover:opacity-100'
        }`}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Sticky Suchleiste (Enter öffnet Suchergebnisse) */}
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 rounded-2xl backdrop-blur border-b border-white/10">
        <div className="px-4 py-3">
          <label className="relative block">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-70" aria-hidden>
              <SearchIcon />
            </span>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Search Subm8"
              className="w-full pl-10 pr-3 h-11 rounded-full bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
          </label>
        </div>
      </div>

      {/* STARTANSICHT (wie vorher), wenn keine Query gesetzt ist */}
      {!qParam ? (
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
                      onClick={() => applyRecent(r)}
                      title={r}
                    >
                      #{r}
                    </button>
                    <button
                      className="text-muted hover:text-white/90"
                      onClick={() => removeRecent(r)}
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
            <header className="px-4 py-3 border-b border-white/10 font-semibold">Trending now</header>
            <ul>
              {trending.slice(0, 4).map((t, i) => (
                <li key={t.tag} className="px-4 py-3 hover:bg-white/5">
                  <div className="text-sm opacity-70">#{i + 1} · Topic</div>
                  <div className="font-medium">{t.tag}</div>
                  <div className="text-sm opacity-70">
                    {Intl.NumberFormat().format(t.posts)} posts
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* People you might want to follow */}
          <section className="rounded-app border border-sub shadow-app">
            <header className="px-4 py-3 border-b border-white/10 font-semibold">
              People you might want to follow
            </header>
            <ul className="divide-y divide-white/10">
              {(suggestPeople.length ? suggestPeople : []).map((u) => (
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
                      {typeof u.followers === 'number' && (
                        <div className="text-xs opacity-60">
                          {Intl.NumberFormat().format(u.followers)} followers
                        </div>
                   )}
                    </div>
                  </div>
                  <button className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95">
                    Follow
                  </button>
                </li>
              ))}
              {suggestPeople.length === 0 && (
                <li className="px-4 py-6 text-sm opacity-70">Keine Vorschläge verfügbar</li>
              )}
            </ul>
          </section>
        </div>
      ) : (
        // SUCHERGEBNISSE (Tabs)
        <>
          <div className="px-4 pt-3 flex gap-2 border-b border-white/10">
            <TabLink id="top" label="Top" />
            <TabLink id="latest" label="Neueste" />
            <TabLink id="people" label="Personen" />
          </div>

          <div className="p-4 grid gap-6">
            {loading && <div className="opacity-70">Lade…</div>}

            {tabParam === 'top' && !loading && (
              <>
                {/* Personen (ein paar, mit den meisten Followern) */}
                {topUsers.length > 0 && (
                  <section className="rounded-app border border-sub shadow-app">
                    <header className="px-4 py-3 border-b border-white/10 font-semibold">
                      Personen
                    </header>
                    <ul className="divide-y divide-white/10">
                      {topUsers.map((u) => (
                        <li
                          key={u.handle}
                          className="flex items-center justify-between px-4 py-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Image
                              src={u.avatar || AVATAR_PH}
                              alt=""
                              width={40}
                              height={40}
                              className="rounded-full object-cover border border-white/15"
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{u.name}</div>
                              <div className="text-sm opacity-70 truncate">@{u.handle}</div>
                              {typeof u.followers === 'number' && (
                                <div className="text-xs opacity-60">
                                  {Intl.NumberFormat().format(u.followers)} followers
                                </div>
                              )}
                            </div>
                          </div>
                          <button className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95">
                            Follow
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {/* Passende Posts (Top nach Likes) */}
                <section className="rounded-app border border-sub shadow-app">
                  <header className="px-4 py-3 border-b border-white/10 font-semibold">Posts</header>
                  <ul className="divide-y divide-white/10">
                    {topPosts.map((p) => (
                      <PostRow key={p.id} post={p} />
                    ))}
                    {topPosts.length === 0 && (
                      <li className="px-4 py-6 text-sm opacity-70">Keine Posts gefunden</li>
                    )}
                  </ul>
                </section>
              </>
            )}

            {tabParam === 'latest' && !loading && (
              <section className="rounded-app border border-sub shadow-app">
                <header className="px-4 py-3 border-b border-white/10 font-semibold">
                  Neueste Posts
                </header>
                <ul className="divide-y divide-white/10">
                  {latestPosts.map((p) => (
                    <PostRow key={p.id} post={p} />
                  ))}
                  {latestPosts.length === 0 && (
                    <li className="px-4 py-6 text-sm opacity-70">Keine Posts gefunden</li>
                  )}
                </ul>
              </section>
            )}

            {tabParam === 'people' && !loading && (
              <section className="rounded-app border border-sub shadow-app">
                <header className="px-4 py-3 border-b border-white/10 font-semibold">
                  Personen
                </header>
                <ul className="divide-y divide-white/10">
                  {people.map((u) => (
                    <li key={u.handle} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <Image
                          src={u.avatar || AVATAR_PH}
                          alt=""
                          width={40}
                          height={40}
                          className="rounded-full object-cover border border-white/15"
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
                  {people.length === 0 && (
                    <li className="px-4 py-6 text-sm opacity-70">Keine Personen gefunden</li>
                  )}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PostRow({ post }: { post: PostItem }) {
  return (
    <li className="px-4 py-4">
      <div className="flex items-start gap-3">
        <Image
          src={post.author.avatar || AVATAR_PH}
          alt=""
          width={40}
          height={40}
          className="rounded-full object-cover border border-white/15"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium truncate">{post.author.name}</span>
            <span className="opacity-70 truncate">@{post.author.handle}</span>
            <span className="opacity-50">
              · {new Date(post.createdAt).toLocaleDateString()}
            </span>
          </div>
          <div className="mt-1 whitespace-pre-wrap break-words">{post.text}</div>
          {post.mediaUrl && (
            <div className="mt-2">
              <Image
                src={post.mediaUrl}
                alt={post.mediaAlt || ''}
                width={600}
                height={400}
                className="rounded-xl border border-white/10 object-cover w-full h-auto"
              />
            </div>
          )}
          <div className="mt-2 text-xs opacity-70 flex gap-4">
            <span>❤ {Intl.NumberFormat().format(post.counts?.likes || 0)}</span>
            <span>💬 {Intl.NumberFormat().format(post.counts?.comments || 0)}</span>
            <span>🔖 {Intl.NumberFormat().format(post.counts?.bookmarks || 0)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.2-3.2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}
