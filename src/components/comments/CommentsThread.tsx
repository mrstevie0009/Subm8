'use client';

import * as React from 'react';
import Image from 'next/image';
import { addCommentAction } from '@/app/actions/comments';

const AVATAR_PH = '/images/avatar-placeholder.png';

type TreeComment = {
  id: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    role: 'DOMME' | 'SUBMISSIVE';
  };
  counts: { likes: number; replies: number };
  viewer: { liked: boolean };
  children: TreeComment[];
};

function Counter({ value = 0, active }: { value?: number; active?: boolean }) {
  return (
    <span className="text-sm" style={{ color: active ? 'var(--purple)' : 'var(--muted)' }}>
      {value ?? 0}
    </span>
  );
}

export default function CommentsThread({ postId }: { postId: string }) {
  const [tree, setTree] = React.useState<TreeComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const load = React.useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        const url = new URL(`/api/post/${postId}/comments`, window.location.origin);
        if (!reset && nextCursor) url.searchParams.set('after', nextCursor);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || 'Failed to load comments');
        setTree((prev) => (reset ? json.items : [...prev, ...json.items]));
        setNextCursor(json.nextCursor ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load comments');
      } finally {
        setLoading(false);
      }
    },
    [postId, nextCursor],
  );

  React.useEffect(() => {
    setTree([]);
    setNextCursor(null);
    setErr(null);
    load(true);
  }, [postId, load]);

  if (err) return <div className="text-sm text-red-400">{err}</div>;

  return (
    <div className="mt-2">
      <Composer postId={postId} parentId={null} onDone={() => load(true)} />

      {tree.length === 0 && !loading && (
        <div className="text-sm text-muted mt-2">No comments yet.</div>
      )}

      <ul className="mt-3 space-y-3">
        {tree.map((n) => (
          <CommentNode key={n.id} node={n} postId={postId} depth={0} onChanged={() => load(true)} />
        ))}
      </ul>

      {nextCursor && (
        <button
          className="mt-3 px-3 h-9 rounded-lg border border-white/15 hover:bg-white/5"
          disabled={loading}
          onClick={() => load(false)}
        >
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

function CommentNode({
  node,
  postId,
  depth,
  onChanged,
}: {
  node: TreeComment;
  postId: string;
  depth: number;
  onChanged: () => void;
}) {
  const [showReply, setShowReply] = React.useState(false);
  const [liked, setLiked] = React.useState(node.viewer.liked);   // <— initial vom Server
  const [likeCount, setLikeCount] = React.useState(node.counts.likes);

  React.useEffect(() => {
    // falls der Knoten neu geladen wurde
    setLiked(node.viewer.liked);
    setLikeCount(node.counts.likes);
  }, [node.viewer.liked, node.counts.likes]);

  async function toggleLike() {
    const res = await fetch(`/api/comments/${node.id}/like`, { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      setLiked(json.liked);
      setLikeCount((c) => (json.liked ? c + 1 : Math.max(0, c - 1)));
    }
  }

  return (
    <li>
      <div className="rounded-app border border-sub bg-card p-3">
        <div className="flex items-start gap-3">
          <div className="shrink-0 flex flex-col items-center">
            <div className="relative size-9 rounded-full overflow-hidden bg-white/10">
              <Image src={node.author.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" />
            </div>
            <RolePill role={node.author.role} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm">
              <span className="font-semibold">{node.author.displayName}</span>{' '}
              <span className="text-muted">@{node.author.handle}</span>{' '}
              <span className="text-muted">· {timeAgoShort(node.createdAt)}</span>
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words">{node.text}</div>

            <div className="mt-2 flex items-center gap-4 text-sm">
              <button className="text-muted hover:text-white" onClick={() => setShowReply((s) => !s)}>
                Reply
              </button>

              {/* Like exakt wie PostCard */}
              <button
                type="button"
                data-no-nav
                onClick={toggleLike}
                className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                aria-pressed={liked || undefined}
                title="Like"
              >
                <span
                  className="inline-grid place-items-center"
                  style={{ width: 'clamp(18px,1.8vw,26px)', height: 'clamp(18px,1.8vw,26px)' }}
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-full h-full"
                    style={{ color: liked ? 'var(--purple)' : 'rgba(255,255,255,.95)' }}
                  >
                    <path d="M20.8 8.8a5.5 5.5 0 0 0-9.4-3.9l-.9.9-.9-.9a5.5 5.5 0 0 0-7.8 7.8l.9.9L10.5 21l8.7-7.4.9-.9a5.5 5.5 0 0 0 0-3.9z" />
                  </svg>
                </span>
                <Counter value={likeCount} active={liked} />
                <span className="sr-only">{liked ? 'Unlike' : 'Like'}</span>
              </button>
            </div>

            {showReply && (
              <div className="mt-2">
                <Composer
                  postId={postId}
                  parentId={node.id}
                  onDone={() => {
                    setShowReply(false);
                    onChanged();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="ml-6 mt-2 pl-4 border-l border-white/15">
          <ul className="space-y-3">
            {node.children.map((ch) => (
              <CommentNode key={ch.id} node={ch} postId={postId} depth={depth + 1} onChanged={onChanged} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function Composer({
  postId,
  parentId,
  onDone,
}: {
  postId: string;
  parentId: string | null;
  onDone: () => void;
}) {
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('postId', postId);
    fd.set('text', t);
    if (parentId) fd.set('parentId', parentId);
    const res = await addCommentAction(fd);
    setBusy(false);
    if (res.ok) {
      setText('');
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-2 shadow-sm">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={parentId ? 'Write a reply…' : 'Write a comment…'}
          className="flex-1 min-h-[60px] max-h-[180px] resize-y rounded-lg bg-transparent p-2 text-sm outline-none
                     placeholder:text-white/40 focus:ring-2 focus:ring-subm8-purple/40 border border-white/10"
        />
        <button
          type="submit"
          disabled={busy || !text.trim()}
          className="h-9 px-4 rounded-lg bg-subm8-purple text-white font-medium shadow
                     hover:brightness-110 active:translate-y-px disabled:opacity-50
                     transition-colors"
        >
          Send
        </button>
      </div>
    </form>
  );
}

function RolePill({ role }: { role: 'DOMME' | 'SUBMISSIVE' }) {
  const isDomme = role === 'DOMME';
  if (isDomme) {
    return (
      <span
        className="mt-1 text-[11px] leading-none px-2 py-1 rounded-full"
        style={{
          color: 'var(--purple)',
          background: 'rgba(139,92,246,.15)',
          border: '1px solid rgba(139,92,246,.25)',
        }}
      >
        Domme
      </span>
    );
  }
  return (
    <span className="mt-1 text-[11px] leading-none px-2 py-1 rounded-full border border-sky-500/25 bg-sky-600/15 text-sky-300">
      Sub
    </span>
  );
}

function timeAgoShort(iso: string) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}
