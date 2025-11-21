//src/components/FollowTabsInline.tsx
'use client';

type Tab = 'followers' | 'following' | 'vFollowing' | 'vFollowers';

export default function FollowTabsInline({
  active,
  setActive,
  counts,
}: {
  active: Tab;
  setActive: (t: Tab) => void;
  counts?: Partial<Record<Tab, number>>;
}) {
  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'followers',  label: 'Followers' },
    { key: 'vFollowers', label: 'Verified Followers' },
    { key: 'following',  label: 'Following' },
    { key: 'vFollowing', label: 'Verified Following' },
  ];

  return (
    <div className="px-3 sm:px-4 pb-2">
      {/* ⬇️ horizontal scroll auf kleinen Screens */}
      <div className="w-full overflow-x-auto no-scrollbar">
        <div className="inline-flex min-w-max rounded-full border border-white/12 bg-white/[.04] p-1 backdrop-blur">
          {tabs.map((t) => {
            const isActive = active === t.key;
            const c = counts?.[t.key];
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={`flex-none sm:flex-1 px-3 sm:px-4 py-1.5 text-sm rounded-full transition
                  ${
                    isActive
                      ? 'bg-[var(--purple)] text-white shadow-[0_6px_20px_-10px_rgba(139,92,246,.9)]'
                      : 'text-white/80 hover:bg-white/[.08]'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  {t.label}
                  {typeof c === 'number' && (
                    <span
                      className={`text-[11px] tabular-nums ${
                        isActive ? 'text-white/95' : 'text-white/60'
                      }`}
                    >
                      {c.toLocaleString()}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
