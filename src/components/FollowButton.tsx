'use client';
import * as React from 'react';

export default function FollowButton({
  targetUserId,
  initialFollowing = false,
  onChange,
}: {
  targetUserId: string;
  initialFollowing?: boolean;
  onChange?: (next: boolean) => void; // optional callback für Parent
}) {
  const [following, setFollowing] = React.useState<boolean>(!!initialFollowing);
  const [loading, setLoading] = React.useState(false);

  async function doFollow() {
    const res = await fetch('/api/follow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ userId: targetUserId }),
    });
    if (!res.ok) throw new Error('follow failed');
  }

  async function doUnfollow() {
    const res = await fetch(`/api/follow?userId=${encodeURIComponent(targetUserId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error('unfollow failed');
  }

  async function toggle() {
    if (loading) return;
    setLoading(true);

    // Optimistisch toggeln, bei Fehler zurückrollen
    const prev = following;
    const next = !prev;
    setFollowing(next);
    onChange?.(next);

    try {
      if (next) await doFollow();
      else await doUnfollow();
    } catch {
      // rollback
      setFollowing(prev);
      onChange?.(prev);
    } finally {
      setLoading(false);
    }
  }

  const cls = following
    ? 'px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/5'
    : 'px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95';

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={following}
      className={cls}
    >
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
