'use client';

import * as React from 'react';

type Noti =
  | { id: string; kind: 'follow'; user: string; time: string }
  | { id: string; kind: 'mention'; user: string; text: string; time: string }
  | { id: string; kind: 'like'; user: string; text: string; time: string };

export default function NotificationsPage() {
  const [tab, setTab] = React.useState<'all' | 'mentions'>('all');

  const data: Noti[] = [
    { id: '1', kind: 'follow', user: 'mistress_aria', time: '2m' },
    { id: '2', kind: 'like', user: 'rope_nerd', text: 'Loved your post', time: '1h' },
    { id: '3', kind: 'mention', user: 'user1001', text: '@you check this out', time: '3h' },
  ];

  const list = tab === 'all' ? data : data.filter((n) => n.kind === 'mention');

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header with tabs */}
      <div className="sticky top-[calc(var(--header-h))] z-10 bg-black/80 backdrop-blur border-b border-white/10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="text-lg font-semibold">Notifications</div>
          <button className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5">
            Mark all as read
          </button>
        </div>

        <div className="grid grid-cols-2">
          {(['all', 'mentions'] as const).map((k) => {
            const active = tab === k;
            return (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`py-3 font-medium ${active ? 'text-white' : 'text-white/70'} relative`}
              >
                {k === 'all' ? 'All' : 'Mentions'}
                {active && (
                  <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-[var(--purple)]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <ul>
        {list.map((n) => (
          <li key={n.id} className="px-4 py-3 hover:bg-white/5 border-b border-white/10">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                {n.kind === 'follow' && <BellIcon tone="purple" />}
                {n.kind === 'mention' && <AtIcon tone="neutral" />}
                {n.kind === 'like' && <HeartIcon tone="purple" />}
              </div>

              <div className="flex-1 min-w-0">
                {n.kind === 'follow' && (
                  <div className="leading-tight">
                    <b>@{n.user}</b> followed you · <span className="text-sm opacity-70">{n.time}</span>
                  </div>
                )}

                {n.kind === 'mention' && (
                  <div className="leading-tight">
                    <b>@{n.user}</b> mentioned you: <span className="opacity-90">{n.text}</span>{' '}
                    · <span className="text-sm opacity-70">{n.time}</span>
                  </div>
                )}

                {n.kind === 'like' && (
                  <div className="leading-tight">
                    <b>@{n.user}</b> liked your post: <span className="opacity-90">{n.text}</span>{' '}
                    · <span className="text-sm opacity-70">{n.time}</span>
                  </div>
                )}
              </div>

              {n.kind === 'follow' ? (
                <button className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95">
                  Follow back
                </button>
              ) : (
                <button className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5">
                  View
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BellIcon({ tone = 'neutral' }: { tone?: 'neutral' | 'purple' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={tone === 'purple' ? 'text-[var(--purple)]' : 'text-white/80'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 9a6 6 0 1 1 12 0c0 4 2 5 2 6H4c0-1 2-2 2-6Z" />
      <path d="M9 19a3 3 0 0 0 6 0" />
    </svg>
  );
}
function AtIcon({ tone = 'neutral' }: { tone?: 'neutral' | 'purple' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={tone === 'purple' ? 'text-[var(--purple)]' : 'text-white/80'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M16 15v-6a4 4 0 1 0-1 7" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
function HeartIcon({ tone = 'purple' }: { tone?: 'neutral' | 'purple' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      className={tone === 'purple' ? 'text-[var(--purple)]' : 'text-white/80'}
      fill="currentColor"
    >
      <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
    </svg>
  );
}
