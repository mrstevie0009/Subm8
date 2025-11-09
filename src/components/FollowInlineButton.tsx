// src/components/FollowInlineButton.tsx
'use client';

import * as React from 'react';
import { followAction, unfollowAction } from '@/app/actions/follow';

export default function FollowInlineButton({
  targetUserId,
  initialFollowing = false,
}: {
  targetUserId: string;
  initialFollowing?: boolean;
}) {
  const [following, setFollowing] = React.useState<boolean>(initialFollowing);
  const [pending, startTransition] = React.useTransition();

  const cls = following
    ? 'px-4 py-1.5 rounded-full border border-white/25 hover:bg-white/5'
    : 'px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95';

  return (
    <form
      action={following ? unfollowAction : followAction}
      onSubmit={() => startTransition(() => setFollowing((v) => !v))}
    >
      <input type="hidden" name="userId" value={targetUserId} />
      <button type="submit" disabled={pending} className={cls}>
        {following ? 'Unfollow' : 'Follow'}
      </button>
    </form>
  );
}
