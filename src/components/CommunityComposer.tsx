// src/components/CommunityComposer.tsx
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

type Props = { slug: string };

export default function CommunityComposer({ slug }: Props) {
  const [text, setText] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const router = useRouter();

  const canPost = text.trim().length > 0 && text.trim().length <= 4000;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canPost || loading) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/communities/${encodeURIComponent(slug)}/posts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        setErr(json?.error || `HTTP ${res.status}`);
        return;
      }
      setText('');
      router.refresh(); // Posts neu laden
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to post');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Was gibt’s Neues in der Community?"
        className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
        maxLength={4000}
      />
      {err && <div className="text-sm text-red-400">{err}</div>}
      <div className="flex items-center justify-between">
        <div className="text-xs opacity-70">{text.trim().length}/4000</div>
        <button
          type="submit"
          disabled={!canPost || loading}
          className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white disabled:opacity-50"
        >
          {loading ? 'Poste…' : 'Posten'}
        </button>
      </div>
    </form>
  );
}
