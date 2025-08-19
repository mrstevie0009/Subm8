'use client';

import * as React from 'react';
import Image from 'next/image';

type Tab = 'posts' | 'gallery' | 'leaderboard';

export default function ProfileTabsContent({
  handle,
  activeTab,
}: {
  handle: string;
  activeTab: Tab;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [posts, setPosts] = React.useState<
    { id: string; content: string | null; imageUrl: string | null; createdAt: string }[]
  >([]);

  const [leaderboard, setLeaderboard] = React.useState<
    {
      sender: { id: string; username: string; displayName: string; avatarUrl?: string };
      totalCents: number;
      lastAt: string;
    }[]
  >([]);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      if (activeTab === 'posts' || activeTab === 'gallery') {
        const onlyImages = activeTab === 'gallery' ? '1' : '0';
        const res = await fetch(`/api/users/${handle}/posts?onlyImages=${onlyImages}`, {
          cache: 'no-store',
        });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Failed loading posts');
        setPosts(json.items);
      } else {
        const res = await fetch(`/api/users/${handle}/leaderboard`, { cache: 'no-store' });
        const json = await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Failed loading leaderboard');
        setLeaderboard(json.items);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  }, [handle, activeTab]);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <div className="py-8 text-sm text-muted">Loading…</div>;
  if (error)   return <div className="py-4 text-sm text-red-500">{error}</div>;

  if (activeTab === 'posts') {
    if (posts.length === 0) return <Empty label="No posts yet" />;
    return (
      <ul className="space-y-3">
        {posts.map(p => (
          <li key={p.id} className="rounded-app border border-sub bg-card p-3">
            {p.imageUrl ? (
              <div className="mb-2 relative w-full overflow-hidden rounded-lg border border-white/10" style={{ aspectRatio: '16/9' }}>
                <Image
                  src={p.imageUrl}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(min-width: 768px) 720px, 100vw"
                />
              </div>
            ) : null}
            {p.content ? <div className="whitespace-pre-wrap">{p.content}</div> : null}
            <div className="mt-1 text-[11px] text-muted">
              {new Date(p.createdAt).toLocaleString()}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  if (activeTab === 'gallery') {
    if (posts.length === 0) return <Empty label="No images yet" />;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {posts.map(p => (
          <div key={p.id} className="relative w-full overflow-hidden rounded-lg border border-white/10" style={{ aspectRatio: '1/1' }}>
            <Image
              src={p.imageUrl!}
              alt=""
              fill
              className="object-cover"
              sizes="(min-width: 768px) 240px, 45vw"
            />
          </div>
        ))}
      </div>
    );
  }

  // leaderboard
  if (leaderboard.length === 0) return <Empty label="No tributes received yet" />;

  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <div className="space-y-6">
      {/* Top 3 */}
      <div className="grid grid-cols-3 gap-3">
        {top3.map((row, idx) => (
          <div key={row.sender.id} className="text-center rounded-app border border-sub bg-card p-3">
            <Trophy rank={idx + 1} />
            <div className="mt-2 font-medium truncate">{row.sender.displayName}</div>
            <div className="text-[12px] text-muted truncate">@{row.sender.username}</div>
            <div className="mt-1 text-sm">
              ${(row.totalCents / 100).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      {/* Tabelle */}
      <div className="rounded-app border border-sub overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[.04] text-muted">
            <tr>
              <th className="text-left px-3 py-2">Time</th>
              <th className="text-left px-3 py-2">User</th>
              <th className="text-right px-3 py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map(row => (
              <tr key={row.sender.id} className="border-t border-white/10">
                <td className="px-3 py-2 text-[12px] text-muted">
                  {new Date(row.lastAt).toLocaleString()}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <MiniAvatar src={row.sender.avatarUrl} />
                    <div className="min-w-0">
                      <div className="truncate">{row.sender.displayName}</div>
                      <div className="text-[12px] text-muted truncate">@{row.sender.username}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  ${(row.totalCents / 100).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="py-12 text-center text-muted">{label}</div>
  );
}

function MiniAvatar({ src }: { src?: string }) {
  return (
    <span className="relative inline-block size-7 rounded-full overflow-hidden bg-white/10 border border-white/15">
      {src ? (
        <Image src={src} alt="" fill className="object-cover" sizes="28px" />
      ) : null}
    </span>
  );
}

function Trophy({ rank }: { rank: 1 | 2 | 3 }) {
  const color =
    rank === 1 ? '#f5c542' : rank === 2 ? '#c0c7cf' : '#cd7f32'; // gold/silver/bronze
  return (
    <svg viewBox="0 0 24 24" className="mx-auto" style={{ width: 28, height: 28 }}>
      <path d="M8 21h8M12 17v4" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 3h12v5a6 6 0 0 1-12 0V3Z" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M18 5h3a3 3 0 0 1-3 3M6 5H3a3 3 0 0 0 3 3" fill="none" stroke={color} strokeWidth="1.6" />
    </svg>
  );
}
