//src/app/[locale]/(protected)/search/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { followAction, unfollowAction } from '@/app/actions/follow';

type PostCounts = { likes: number; comments: number; bookmarks: number };
type Author = { handle: string; name: string; avatar?: string | null };
type PostItem = {
  id: string;
  text: string;
  mediaUrl?: string;
  mediaAlt?: string;
  createdAt: string | Date;
  author: Author;
  counts: PostCounts;
};

// Vereinheitlichte User-Typen für Suche & Vorschläge (optionale Felder!)
type SearchUser = {
  id?: string;
  handle: string;
  name?: string;
  displayName?: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  followers?: number;
  followersCount?: number;
  viewerFollows?: boolean;
};

const AVATAR_PH = '/images/avatar-placeholder.png';

export default function SearchPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { locale } = useParams() as { locale: string };
  const t = useTranslations('search');

  // Query & Tab aus URL
  const qParam = sp.get('q') || '';
  const tabParam = (sp.get('tab') || 'top') as 'top' | 'latest' | 'people';

  // Eingabefeld steuern
  const [q, setQ] = React.useState(qParam);
  React.useEffect(() => setQ(qParam), [qParam]);

  // ---- Startansicht-States (wenn q leer ist)
  const [recent, setRecent] = React.useState<string[]>([]);
  const [trending, setTrending] = React.useState<{ tag: string; posts: number }[]>([]);
  const [suggestions, setSuggestions] = React.useState<SearchUser[]>([]);
  const [loadingSug, setLoadingSug] = React.useState(false);

  const saveRecent = React.useCallback((list: string[]) => {
    setRecent(list);
    try {
      localStorage.setItem('subm8.search.recent', JSON.stringify(list));
    } catch {}
  }, []);

  // Suggestions laden
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingSug(true);
      try {
        const res = await fetch(`/api/users/suggest?limit=6`, { cache: 'no-store' });
        const j: { ok: boolean; users?: SearchUser[] } = await res.json();
        if (!cancelled && j?.ok && Array.isArray(j.users)) {
          setSuggestions(j.users.filter((u) => !u.viewerFollows));
        } else if (!cancelled) {
          setSuggestions([]);
        }
      } finally {
        if (!cancelled) setLoadingSug(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Trending laden
  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/search');
        const j = await res.json();
        if (j?.ok && Array.isArray(j.trending) && j.trending.length) {
          setTrending(j.trending.slice(0, 10));
          return;
        }
      } catch {}
      setTrending([]);
    })();
  }, []);

  // Recent-Interaktionen
  function applyRecent(r: string) {
    setQ(r);
    const next = [r, ...recent.filter((x) => x !== r)].slice(0, 10);
    saveRecent(next);
  }
  function removeRecent(r: string) {
    saveRecent(recent.filter((x) => x !== r));
  }

  // ---- Ergebnis-States
  const [topUsers, setTopUsers] = React.useState<SearchUser[]>([]);
  const [topPosts, setTopPosts] = React.useState<PostItem[]>([]);
  const [latestPosts, setLatestPosts] = React.useState<PostItem[]>([]);
  const [people, setPeople] = React.useState<SearchUser[]>([]);
  const [loading, setLoading] = React.useState(false);

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

  // Daten laden für Tabs
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
            fetch(`/api/search/users?q=${encodeURIComponent(query)}&sort=followers&limit=5`, { cache: 'no-store' }),
            fetch(`/api/search/posts?q=${encodeURIComponent(query)}&sort=top&limit=20`, { cache: 'no-store' }),
          ]);
          const [uj, pj]: [{ users?: SearchUser[] }, { posts?: PostItem[] }] = await Promise.all([
            uRes.json(),
            pRes.json(),
          ]);
          setTopUsers(uj?.users ?? []);
          setTopPosts(pj?.posts ?? []);
        } else if (tab === 'latest') {
          const pRes = await fetch(
            `/api/search/posts?q=${encodeURIComponent(query)}&sort=latest&limit=20`,
            { cache: 'no-store' }
          );
          const pj: { posts?: PostItem[] } = await pRes.json();
          setLatestPosts(pj?.posts ?? []);
        } else if (tab === 'people') {
          const uRes = await fetch(
            `/api/search/users?q=${encodeURIComponent(query)}&sort=followers&limit=20`,
            { cache: 'no-store' }
          );
          const uj: { users?: SearchUser[] } = await uRes.json();
          setPeople(uj?.users ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [sp]);

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
      {/* Search bar */}
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
              placeholder={t('placeholder')}
              className="w-full pl-10 pr-3 h-11 rounded-full bg-white/5 border border-white/10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
          </label>
        </div>
      </div>

      {/* Start view */}
      {!qParam ? (
        <div className="p-4 grid gap-6">
          {/* Recent */}
          {recent.length > 0 && (
            <section className="rounded-app border border-sub shadow-app">
              <header className="px-4 py-3 border-b border-white/10 font-semibold">{t('recent.title')}</header>
              <ul>
                {recent.map((r) => (
                  <li key={r} className="flex items-center justify-between px-4 py-3 hover:bg-white/5">
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
                      aria-label={t('recent.removeAria', { query: r })}
                      title={t('recent.remove')}
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
            <header className="px-4 py-3 border-b border-white/10 font-semibold">{t('trending.title')}</header>

            {trending.length === 0 ? (
              <div className="px-4 py-6 text-sm opacity-70">{t('trending.empty')}</div>
            ) : (
              <ul>
                {trending.slice(0, 4).map((tItem, i) => (
                  <li key={tItem.tag} className="px-4 py-3 hover:bg-white/5">
                    <div className="text-sm opacity-70">#{i + 1} · {t('trending.topic')}</div>
                    <div className="font-medium">{tItem.tag}</div>
                    <div className="text-sm opacity-70">{Intl.NumberFormat().format(tItem.posts)} {t('trending.posts')}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Suggestions */}
          <section className="px-4 pt-4">
            <div className="rounded-app border border-sub shadow-app p-3">
              <div className="px-1 pb-2 font-semibold">{t('suggestions.title')}</div>

              {loadingSug && (
                <ul className="divide-y divide-white/10">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-center justify-between px-1 py-2">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-white/10 animate-pulse" />
                        <div>
                          <div className="h-3 w-28 bg-white/10 rounded animate-pulse" />
                          <div className="h-3 w-20 bg-white/10 rounded mt-2 animate-pulse" />
                        </div>
                      </div>
                      <div className="h-8 w-24 rounded-full border border-white/15" />
                    </li>
                  ))}
                </ul>
              )}

              {!loadingSug && (
                <ul className="divide-y divide-white/10">
                  {suggestions.map((u) => (
                    <SuggestionItem
                      key={u.handle}
                      user={u}
                      onRemove={() =>
                        setSuggestions((prev) => prev.filter((x) => x.handle !== u.handle))
                      }
                    />
                  ))}
                  {suggestions.length === 0 && (
                    <li className="px-1 py-4 text-sm opacity-70">{t('suggestions.empty')}</li>
                  )}
                </ul>
              )}
            </div>
          </section>
        </div>
      ) : (
        // Results view
        <>
          <div className="px-4 pt-3 flex gap-2 border-b border-white/10">
            <TabLink id="top" label={t('tabs.top')} />
            <TabLink id="latest" label={t('tabs.latest')} />
            <TabLink id="people" label={t('tabs.people')} />
          </div>

          <div className="p-4 grid gap-6">
            {loading && <div className="opacity-70">{t('loading')}</div>}

            {tabParam === 'top' && !loading && (
              <>
                {/* Users */}
                {topUsers.length > 0 && (
                  <section className="rounded-app border border-sub shadow-app">
                    <header className="px-4 py-3 border-b border-white/10 font-semibold">{t('people.title')}</header>
                    <ul className="divide-y divide-white/10">
                      {topUsers.map((u) => {
                        const followers = u.followersCount ?? u.followers;
                        const avatar = u.avatarUrl ?? u.avatar ?? AVATAR_PH;
                        const name = u.displayName ?? u.name ?? u.handle;
                        return (
                          <li key={u.handle} className="flex items-center justify-between px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <Image
                                src={avatar || AVATAR_PH}
                                alt=""
                                width={40}
                                height={40}
                                className="rounded-full object-cover border border-white/15"
                              />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{name}</div>
                                <div className="text-sm opacity-70 truncate">@{u.handle}</div>
                                {typeof followers === 'number' && (
                                  <div className="text-xs opacity-60">
                                    {Intl.NumberFormat().format(followers)} {t('people.followers')}
                                  </div>
                                )}
                              </div>
                            </div>
                            <FollowForm userId={u.id} handle={u.handle} initialFollowing={!!u.viewerFollows} />
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}

                {/* Posts */}
                <section className="rounded-app border border-sub shadow-app">
                  <header className="px-4 py-3 border-b border-white/10 font-semibold">{t('posts.title')}</header>
                  <ul className="divide-y divide-white/10">
                    {topPosts.map((p) => (
                      <PostRow key={p.id} post={p} />
                    ))}
                    {topPosts.length === 0 && (
                      <li className="px-4 py-6 text-sm opacity-70">{t('posts.empty')}</li>
                    )}
                  </ul>
                </section>
              </>
            )}

            {tabParam === 'latest' && !loading && (
              <section className="rounded-app border border-sub shadow-app">
                <header className="px-4 py-3 border-b border-white/10 font-semibold">{t('posts.latestTitle')}</header>
                <ul className="divide-y divide-white/10">
                  {latestPosts.map((p) => (
                    <PostRow key={p.id} post={p} />
                  ))}
                  {latestPosts.length === 0 && (
                    <li className="px-4 py-6 text-sm opacity-70">{t('posts.empty')}</li>
                  )}
                </ul>
              </section>
            )}

            {tabParam === 'people' && !loading && (
              <section className="rounded-app border border-sub shadow-app">
                <header className="px-4 py-3 border-b border-white/10 font-semibold">{t('people.title')}</header>
                <ul className="divide-y divide-white/10">
                  {people.map((u) => {
                    const avatar = u.avatarUrl ?? u.avatar ?? AVATAR_PH;
                    const name = u.displayName ?? u.name ?? u.handle;
                    return (
                      <li key={u.handle} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <Image
                            src={avatar}
                            alt=""
                            width={40}
                            height={40}
                            className="rounded-full object-cover border border-white/15"
                          />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{name}</div>
                            <div className="text-sm opacity-70 truncate">@{u.handle}</div>
                          </div>
                        </div>
                        <FollowForm userId={u.id} handle={u.handle} initialFollowing={!!u.viewerFollows} />
                      </li>
                    );
                  })}
                  {people.length === 0 && (
                    <li className="px-4 py-6 text-sm opacity-70">{t('people.empty')}</li>
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

/* ---------- Suggestion item ---------- */
function SuggestionItem({
  user,
  onRemove,
}: {
  user: SearchUser;
  onRemove: () => void;
}) {
  const [following, setFollowing] = React.useState<boolean>(!!user.viewerFollows);
  const [fading, setFading] = React.useState(false);
  const removeTimerRef = React.useRef<number | null>(null);
  const fadeTimerRef = React.useRef<number | null>(null);

  const btnCls = following
    ? 'px-4 py-1.5 rounded-full border border-white/25 hover:bg-white/5'
    : 'px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95';

  const scheduleFadeAndRemove = React.useCallback(() => {
    removeTimerRef.current = window.setTimeout(() => {
      setFading(true);
      fadeTimerRef.current = window.setTimeout(() => {
        onRemove();
      }, 320);
    }, 900);
  }, [onRemove]);

  const clearTimers = React.useCallback(() => {
    if (removeTimerRef.current) {
      window.clearTimeout(removeTimerRef.current);
      removeTimerRef.current = null;
    }
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => clearTimers();
  }, [clearTimers]);

  const name = user.displayName ?? user.name ?? user.handle;
  const avatar = user.avatarUrl ?? user.avatar ?? undefined;

  return (
    <li
      className={`flex items-center justify-between px-1 py-2 transition-all duration-300 ${
        fading ? 'opacity-0 translate-y-1 pointer-events-none' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar size={40} name={name} src={avatar} />
        <div className="min-w-0">
          <div className="font-medium truncate">{name}</div>
          <div className="text-sm opacity-70 truncate">@{user.handle}</div>
        </div>
      </div>

      <form
        action={following ? unfollowAction : followAction}
        onSubmit={() => {
          const next = !following;
          setFollowing(next);

          if (next) {
            clearTimers();
            scheduleFadeAndRemove();
          } else {
            clearTimers();
            setFading(false);
          }
        }}
      >
        {user.id ? <input type="hidden" name="userId" value={user.id} /> : null}
        <input type="hidden" name="handle" value={user.handle} />
        <button type="submit" className={btnCls}>
          {following ? 'Unfollow' : 'Follow'}
        </button>
      </form>
    </li>
  );
}

/* ---------- FollowForm ---------- */
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

  const cls = following
    ? 'px-4 py-1.5 rounded-full border border-white/25 hover:bg-white/5'
    : 'px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95';

  return (
    <form
      action={following ? unfollowAction : followAction}
      onSubmit={() => setFollowing((v) => !v)}
    >
      {userId ? <input type="hidden" name="userId" value={userId} /> : null}
      <input type="hidden" name="handle" value={handle} />
      <button type="submit" className={cls}>
        {following ? 'Unfollow' : 'Follow'}
      </button>
    </form>
  );
}

/* ---------- UI Bits ---------- */
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
            <span className="opacity-50">· {new Date(post.createdAt).toLocaleDateString()}</span>
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
