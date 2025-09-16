// src/components/ProfileTabsContent.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import PostCard, { type FeedPost } from '@/components/PostCard';

const AVATAR_PH = '/images/avatar-placeholder.png';

type Tab = 'posts' | 'gallery' | 'leaderboard';

type Props = {
  handle: string;
  /** Uncontrolled Startwert (falls activeTab nicht gesetzt ist) */
  initialTab?: Tab;
  /** Controlled: aktiver Tab von außen (Header) */
  activeTab?: Tab;
  /** Tabs oben anzeigen? (default: true) */
  showTabs?: boolean;
  /** Vom Profil durchgereicht: aktuell gepinnte Post-ID */
  pinnedPostId?: string | null;
};

type ApiUserLite = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | undefined;
  role?: 'DOMME' | 'SUBMISSIVE' | null;
};

type ApiPost = {
  id: string;
  createdAt: string; // ISO
  text: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  nsfw: boolean;
  /** Autor des Feed-Items (bei Repost = Reposter). Kann im Fehlerfall null sein → defensiv mappen. */
  author: (ApiUserLite & { avatarUrl: string | undefined }) | null;
  /** Original bei Repost (optional) */
  repostOf: null | {
    id: string;
    createdAt: string;
    text: string | null;
    mediaUrl: string | null;
    mediaAlt: string | null;
    author: ApiUserLite;
  };
  /** Original bei Quote (optional) */
  quoteOf: null | {
    id: string;
    createdAt: string;
    text: string | null;
    mediaUrl: string | null;
    mediaAlt: string | null;
    author: ApiUserLite;
  };
};

type LeaderTop = {
  user: { id: string; handle: string; displayName: string; avatarUrl: string | null };
  totalCents: number;
  count: number;
};

type LeaderRow = {
  id: string;
  at: string;
  amountCents: number;
  user: { id: string; handle: string; displayName: string; avatarUrl: string | null };
};

/** Mappt ein ApiPost in das Feed-Shape, das PostCard erwartet */
function mapToFeedPost(p: ApiPost): FeedPost {
  // Fallback für defekten/fehlenden Author (sollte normal nicht vorkommen)
  const safeAuthor: ApiUserLite = p.author ?? {
    id: 'unknown',
    handle: 'unknown',
    displayName: 'Unknown',
    avatarUrl: undefined,
    role: null,
  };

  const isRepost = !!p.repostOf;
  const isQuote = !!p.quoteOf;

  // Original-Inhalt (bei Repost/Quote) – sonst der Post selbst
  const original = isRepost ? p.repostOf! : isQuote ? p.quoteOf! : null;

  const contentAuthor: ApiUserLite = original ? original.author : safeAuthor;

  return {
    id: p.id, // Feed-Item-ID (bei Repost/Quote = ID der Aktion)
    createdAtISO: p.createdAt,
    content: {
      id: original ? original.id : p.id,
      text: (original ? original.text : p.text) ?? '',
      mediaUrl: (original ? original.mediaUrl : p.mediaUrl) ?? undefined,
      mediaAlt: (original ? original.mediaAlt : p.mediaAlt) ?? undefined,
      createdAt: original ? original.createdAt : p.createdAt,
      author: {
        id: contentAuthor.id,
        handle: contentAuthor.handle,
        displayName: contentAuthor.displayName,
        avatarUrl: contentAuthor.avatarUrl ?? undefined,
        role: contentAuthor.role ?? null,
      },
      quote: isQuote
        ? {
            id: p.quoteOf!.id,
            text: p.quoteOf!.text ?? '',
            mediaUrl: p.quoteOf!.mediaUrl ?? undefined,
            mediaAlt: p.quoteOf!.mediaAlt ?? undefined,
            createdAt: p.quoteOf!.createdAt,
            author: {
              id: p.quoteOf!.author.id,
              handle: p.quoteOf!.author.handle,
              displayName: p.quoteOf!.author.displayName,
              role: p.quoteOf!.author.role ?? null,
              avatarUrl: p.quoteOf!.author.avatarUrl ?? undefined,
            },
          }
        : undefined,
    },
    reposter: isRepost
      ? { id: safeAuthor.id, handle: safeAuthor.handle, displayName: safeAuthor.displayName }
      : null,
    stats: undefined,
    viewer: undefined,
    initiallyBookmarked: false,
  };
}

export default function ProfileTabsContent({
  handle,
  initialTab = 'posts',
  activeTab,
  showTabs = true,
  pinnedPostId,
}: Props) {
  // interner State nur, wenn nicht controlled
  const [internalTab, setInternalTab] = React.useState<Tab>(initialTab);
  const tab: Tab = activeTab ?? internalTab;

  const [posts, setPosts] = React.useState<ApiPost[]>([]);
  const [loadingPosts, setLoadingPosts] = React.useState(true);
  const [errPosts, setErrPosts] = React.useState<string | null>(null);

  const [top, setTop] = React.useState<LeaderTop[]>([]);
  const [rows, setRows] = React.useState<LeaderRow[]>([]);
  const [loadingLead, setLoadingLead] = React.useState(false);
  const [errLead, setErrLead] = React.useState<string | null>(null);

  // Posts laden
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPosts(true);
        setErrPosts(null);
        const res = await fetch(`/api/user/${handle}/posts`, { cache: 'no-store' });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Failed to load posts');
        if (!cancelled) setPosts(json.items as ApiPost[]);
      } catch (e) {
        if (!cancelled) setErrPosts(e instanceof Error ? e.message : 'Failed to load posts');
      } finally {
        if (!cancelled) setLoadingPosts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle]);

  // Leaderboard laden (wenn Tab aktiv ist)
  React.useEffect(() => {
    if (tab !== 'leaderboard') return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingLead(true);
        setErrLead(null);
        const res = await fetch(`/api/user/${handle}/posts/leaderboard`, { cache: 'no-store' });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Failed to load leaderboard');
        if (!cancelled) {
          setTop(json.top3 as LeaderTop[]);
          setRows(json.rows as LeaderRow[]);
        }
      } catch (e) {
        if (!cancelled) setErrLead(e instanceof Error ? e.message : 'Failed to load leaderboard');
      } finally {
        if (!cancelled) setLoadingLead(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, tab]);

  // Galerie zeigt nur Posts mit eigenem Media (Reposts mit fremdem Media bleiben draußen)
  const gallery = React.useMemo(() => posts.filter((p) => !!p.mediaUrl), [posts]);

  return (
    <div className="mt-4">
      {/* Tabs hier nur anzeigen, wenn explizit gewünscht */}
      {showTabs && (
        <nav className="border-t border-white/10">
          <ul className="grid grid-cols-3 text-center text-[14px] font-medium">
            <Tab label="Posts"       active={tab === 'posts'}       onClick={() => setInternalTab('posts')} />
            <Tab label="Galerie"     active={tab === 'gallery'}     onClick={() => setInternalTab('gallery')} />
            <Tab label="Leaderboard" active={tab === 'leaderboard'} onClick={() => setInternalTab('leaderboard')} />
          </ul>
        </nav>
      )}

      {/* Inhalte */}
      <div className="mt-3 space-y-3">
        {tab === 'posts' && (
          <>
            {loadingPosts && <div className="text-sm text-muted">Loading…</div>}
            {errPosts && <div className="text-sm text-red-500">{errPosts}</div>}
            {!loadingPosts && !errPosts && posts.length === 0 && (
              <div className="text-sm text-muted">No posts yet.</div>
            )}
            {!loadingPosts &&
              !errPosts &&
              posts.map((p) => (
                <PostCard key={p.id} post={mapToFeedPost(p)} pinnedPostId={pinnedPostId} />
              ))}
          </>
        )}

        {tab === 'gallery' && (
          <>
            {loadingPosts && <div className="text-sm text-muted">Loading…</div>}
            {errPosts && <div className="text-sm text-red-500">{errPosts}</div>}
            {!loadingPosts && !errPosts && gallery.length === 0 && (
              <div className="text-sm text-muted">No media posts yet.</div>
            )}
            {!loadingPosts &&
              !errPosts &&
              gallery.map((p) => (
                <PostCard key={p.id} post={mapToFeedPost(p)} pinnedPostId={pinnedPostId} />
              ))}
          </>
        )}

        {tab === 'leaderboard' && (
          <div className="space-y-4">
            {loadingLead && <div className="text-sm text-muted">Loading…</div>}
            {errLead && <div className="text-sm text-red-500">{errLead}</div>}

            {/* Top 3 */}
            {!loadingLead && !errLead && (
              <>
                {(() => {
                  const podium: (LeaderTop | null)[] = [top[0] ?? null, top[1] ?? null, top[2] ?? null];
                  return (
                    <div className="grid grid-cols-3 gap-3">
                      {podium.map((t, i) => (
                        <div key={i} className="rounded-app border border-sub bg-card p-3 text-center">
                          <div className="text-2xl" aria-hidden="true">
                            {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                          </div>
                          <div className="mt-1 font-semibold truncate">{t?.user.displayName ?? '—'}</div>
                          <div className="text-[12px] text-muted truncate">{t ? `@${t.user.handle}` : '@—'}</div>
                          <div className="mt-1 text-sm">
                            ${((t?.totalCents ?? 0) / 100).toFixed(2)} · {t?.count ?? 0} tips
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </>
            )}

            {/* Tabelle */}
            {!loadingLead && !errLead && (
              <div className="rounded-app border border-sub overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[.04]">
                    <tr>
                      <th className="text-left px-3 py-2">Time</th>
                      <th className="text-left px-3 py-2">User</th>
                      <th className="text-right px-3 py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length > 0 ? (
                      rows.map((r) => (
                        <tr key={r.id} className="border-t border-white/10">
                          <td className="px-3 py-2 text-muted whitespace-nowrap">
                            {new Date(r.at).toLocaleString()}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="relative size-7 rounded-full overflow-hidden bg-white/10">
                                <Image src={r.user.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" />
                              </div>
                              <div className="truncate">
                                <div className="truncate">{r.user.displayName}</div>
                                <div className="text-[11px] text-muted truncate">@{r.user.handle}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">${(r.amountCents / 100).toFixed(2)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-t border-white/10">
                        <td className="px-3 py-3 text-center text-muted" colSpan={3}>
                          No Tribute yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full px-4 py-3 transition-colors ${
          active ? 'text-[var(--purple)]' : 'text-white'
        } hover:bg-white/[.04]`}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </button>
    </li>
  );
}
