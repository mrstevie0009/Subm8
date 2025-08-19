'use client';
import * as React from 'react';

export default function FollowButton({
  targetUserId,
  initialFollowing = false,
}: {
  targetUserId: string;
  initialFollowing?: boolean;
}) {
  const [following, setFollowing] = React.useState(initialFollowing);
  const [loading, setLoading] = React.useState(false);

  async function toggle() {
    try {
      setLoading(true);
      if (following) {
        await fetch(`/api/follow?targetUserId=${targetUserId}`, { method: 'DELETE' });
        setFollowing(false);
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targetUserId }),
        });
        setFollowing(true);
      }
    } finally {
      setLoading(false);
    }
  }

  const cls = following
    ? 'px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/5'
    : 'px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95';

  return (
    <button onClick={toggle} disabled={loading} className={cls}>
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
