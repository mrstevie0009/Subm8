// src/components/CommunityJoinButton.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  slug: string;
  initialJoined: boolean;
  initialMembers: number;
};

export default function CommunityJoinButton({ slug, initialJoined, initialMembers }: Props) {
  const [joined, setJoined] = React.useState(initialJoined);
  const [members, setMembers] = React.useState(initialMembers);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/join`, {
        method: joined ? 'DELETE' : 'POST',
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        // optional: toast
        return;
      }
      setJoined(!joined);
      if (typeof json.members === 'number') setMembers(json.members);
      router.refresh(); // aktuelle Seite neu laden (Posts, Header-Zähler aktualisieren)
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button
        onClick={toggle}
        disabled={loading}
        className={`px-3 py-1.5 rounded-full ${
          joined ? 'border border-white/20 hover:bg-white/5' : 'bg-[var(--purple)] hover:opacity-95'
        }`}
      >
        {joined ? 'Leave' : 'Join'}
      </button>
      <div className="text-xs opacity-70 mt-1">{members.toLocaleString()} members</div>
    </div>
  );
}
