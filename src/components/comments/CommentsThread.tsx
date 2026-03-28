// src/components/comments/CommentsThread.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { addCommentAction } from '@/app/actions/comments';
import { useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';
import { UserBadges } from '@/components/UserBadges';

const isPremiumActive = (iso?: string | null) =>
  !!iso && new Date(iso).getTime() > Date.now();

type DbRole = 'DOMME' | 'SUBMISSIVE';
const toDbRole = (r: DbRole | string): DbRole =>
  String(r).toUpperCase() === 'DOMME' ? 'DOMME' : 'SUBMISSIVE';

const AVATAR_PH = '/images/avatar-placeholder.png';

/* ---------------- GIF Picker (Tenor) ---------------- */
const TENOR_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? 'LIVDSRZULELA'; // Demo-Key
const TENOR_BASE = 'https://g.tenor.com/v1';

type TenorMedia = {
  gif?: { url?: string };
  mediumgif?: { url?: string };
  tinygif?: { url?: string };
  nanogif?: { url?: string };
};
type TenorItem = { id?: string; media?: TenorMedia[] };
type TenorResp = { results?: TenorItem[] };

function GifPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (gifUrl: string) => void;
}) {
  const t = useTranslations('comments');
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<{ id: string; url: string }[]>([]);

  const pickUrlFromItem = (it: TenorItem): string | null => {
    const m = it.media?.[0];
    return m?.gif?.url || m?.mediumgif?.url || m?.tinygif?.url || m?.nanogif?.url || null;
  };

  const run = React.useCallback(
    async (query?: string) => {
      setErr(null);
      setLoading(true);
      try {
        const endpoint =
          query && query.trim()
            ? `${TENOR_BASE}/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=24&media_filter=minimal`
            : `${TENOR_BASE}/trending?key=${TENOR_KEY}&limit=24&media_filter=minimal`;
        const r = await fetch(endpoint);
        const j = (await r.json()) as TenorResp;
        const list =
          (j.results ?? [])
            .map((it) => {
              const url = pickUrlFromItem(it);
              return url ? { id: it.id ?? crypto.randomUUID(), url } : null;
            })
            .filter(Boolean) as { id: string; url: string }[];
        setItems(list);
      } catch {
        setErr(t('errorGifs'));
      } finally {
        setLoading(false);
      }
    },
    [t]
  );

  React.useEffect(() => {
    if (open) run();
  }, [open, run]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2147483602]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(920px,95vw)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#111] p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && run(q)}
            placeholder={t('searchGifs')}
            className="flex-1 h-10 rounded-xl bg-white/[.06] border border-white/10 px-3 outline-none"
          />
          <button
            type="button"
            onClick={() => run(q)}
            className="h-10 px-4 rounded-xl bg-[var(--purple)] text-white hover:opacity-95"
          >
            {t('search')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 rounded-xl border border-white/15 hover:bg-white/10"
          >
            {t('close')}
          </button>
        </div>

        <div className="mt-3">
          {err && <div className="text-red-300 text-sm mb-2">{err}</div>}
          {loading ? (
            <div className="text-sm text-white/80 py-8 text-center">{t('loading')}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto max-h-[65vh] pr-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-white/25"
                  onClick={() => onPick(it.url)}
                  title={t('pick')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.url} alt="" loading="lazy" decoding="async" className="block w-full h-44 object-cover" />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Types ---------------- */
type TreeComment = {
  id: string;
  text: string;
  createdAt: string;
  parentId: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  author: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    role: 'DOMME' | 'SUBMISSIVE';
    premiumUntil?: string | null;
    isFirstAdopter?: boolean; 
  };
  counts: { likes: number; replies: number };
  viewer: { liked: boolean };
  children: TreeComment[];
};

// Tie-Breaker: likes desc, createdAt desc (neuste zuerst)
function byLikesThenDate(a: TreeComment, b: TreeComment) {
  const likeDiff = (b.counts?.likes ?? 0) - (a.counts?.likes ?? 0);
  if (likeDiff !== 0) return likeDiff;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

// Rekursive Sortierung
function sortTreeByLikes(nodes: TreeComment[]): TreeComment[] {
  // tiefe Kopie nur insoweit nötig, dass children neu sortiert werden
  return nodes
    .map(n => ({ ...n, children: sortTreeByLikes(n.children ?? []) }))
    .sort(byLikesThenDate);
}

// (Optional, falls Pagination Duplikate liefert)
function dedupeById<T extends { id: string }>(arr: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of arr) {
    if (!seen.has(it.id)) {
      seen.add(it.id);
      out.push(it);
    }
  }
  return out;
}

function isVideoUrl(url: string | null | undefined) {
  if (!url) return false;
  return /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
}


function Counter({ value = 0, active }: { value?: number; active?: boolean }) {
  return (
    <span className="text-sm" style={{ color: active ? 'var(--purple)' : 'var(--muted)' }}>
      {value ?? 0}
    </span>
  );
}

export default function CommentsThread({ postId }: { postId: string }) {
  const t = useTranslations('comments');

  const [tree, setTree] = React.useState<TreeComment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const load = React.useCallback(
    async (reset = false) => {
      if (!reset && !nextCursor) return;

      try {
        setLoading(true);
        const url = new URL(`/api/post/${postId}/comments`, window.location.origin);
        if (!reset && nextCursor) url.searchParams.set('after', nextCursor);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || t('errorLoading'));

        setTree((prev) => {
          const merged = reset ? json.items : [...prev, ...json.items];
          const deduped = dedupeById<TreeComment>(merged);
          return sortTreeByLikes(deduped);
        });
        setNextCursor(json.nextCursor ?? null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : t('errorLoading'));
      } finally {
        setLoading(false);
      }
    },
    [postId, nextCursor, t]
  );

   React.useEffect(() => {
    setTree([]);
    setNextCursor(null);
    setErr(null);
    load(true);
  }, [postId, load]);

  
  React.useEffect(() => {
    if (!nextCursor) return;             
    const el = sentinelRef.current;
    if (!el) return;

    let loadingMore = false;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (loadingMore) return;         

        loadingMore = true;
        void load(false).finally(() => {
          loadingMore = false;
        });
      },
      {
        root: null,
        rootMargin: '200px 0px 200px 0px',  
        threshold: 0.1,
      }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, load]);

  if (err) return <div className="text-sm text-red-400">{err}</div>;

  return (
    <div className="mt-2">
      <Composer postId={postId} parentId={null} onDone={() => load(true)} />

      {tree.length === 0 && !loading && <div className="text-sm text-muted mt-2">{t('noComments')}</div>}

      <ul className="mt-3 space-y-3">
        {tree.map((n) => (
          <CommentNode
            key={n.id}
            node={n}
            postId={postId}
            depth={0}
            onChanged={() => load(true)}
          />
        ))}
      </ul>

      <div ref={sentinelRef} className="h-1" aria-hidden />
   
      {loading && nextCursor && (
        <div className="mt-3 text-sm text-muted">{t('loading')}</div>
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
  const t = useTranslations('comments');
  const tTime = useTranslations('post');
  const b = useTranslations('common');
  const [showReply, setShowReply] = React.useState(false);
  const [liked, setLiked] = React.useState(Boolean(node.viewer?.liked));
  const [likeCount, setLikeCount] = React.useState(node.counts.likes);

  React.useEffect(() => {
    setLiked(Boolean(node.viewer?.liked));
    setLikeCount(node.counts.likes);
  }, [node.viewer?.liked, node.counts.likes]);

  async function toggleLike() {
    const res = await fetch(`/api/comments/${node.id}/like`, { method: 'POST' });
    const json = await res.json();
    if (json.ok) {
      setLiked(json.liked);
      setLikeCount(c => (json.liked ? c + 1 : Math.max(0, c - 1)));
      onChanged(); // ⬅️ resort via Reload
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
            <div className="text-sm flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold">{node.author.displayName}</span>

              {/* ⬇️ Badge direkt neben dem Namen */}
              <UserBadges
                role={toDbRole(node.author.role)}
                isPremium={isPremiumActive(node.author.premiumUntil)}
                isFirstAdopter={!!node.author.isFirstAdopter}
                size={16}
                className="-ml-0.5"
                premiumLabel={b('badges.verified')}
                firstAdopterLabel={b('badges.firstAdopter')}
              />

              <span className="text-muted">@{node.author.handle}</span>{' '}
              <span className="text-muted">· {timeAgoShort(node.createdAt, tTime)}</span>
            </div>

            {node.text && <div className="mt-1 whitespace-pre-wrap break-words">{node.text}</div>}

            {node.mediaUrl && (
              <figure className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/20 flex justify-center">
                {isVideoUrl(node.mediaUrl) ? (
                  <video
                    src={node.mediaUrl}
                    controls
                    className="
                      block h-auto w-auto object-contain
                      max-w-[min(100%,560px)] sm:max-w-[min(100%,680px)]
                      max-h-[36vh] sm:max-h-[42vh]
                    "
                  />
                ) : (
                  <Image
                    src={node.mediaUrl}
                    alt={node.mediaAlt ?? ''}
                    width={800}
                    height={600}
                    sizes="(max-width: 768px) 100vw, 720px"
                    className="
                      block h-auto w-auto object-contain
                      max-w-[min(100%,560px)] sm:max-w-[min(100%,680px)]
                      max-h-[36vh] sm-max-h-[42vh]
                    "
                  />
                )}
              </figure>
            )}

            <div className="mt-2 flex items-center gap-4 text-sm">
              <button className="text-muted hover:text-white" onClick={() => setShowReply((s) => !s)}>
                {t('reply')}
              </button>

              <button
                type="button"
                data-no-nav
                onClick={toggleLike}
                className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-white/5"
                aria-pressed={liked || undefined}
                title={t('like')}
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
                <span className="sr-only">{liked ? t('unlike') : t('like')}</span>
              </button>
            </div>
          </div>
        </div>

        {showReply && (
          <div className="mt-3">
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
  const t = useTranslations('comments');
  const tt = useTranslations('home.toast');
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [gifOpen, setGifOpen] = React.useState(false);
  const submittedRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function onPick(f?: File | null) {
    const img = f ?? null;
    if (!img) return;
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    const url = URL.createObjectURL(img);
    setFile(img);
    setPreview(url);
  }

  async function onPickGifByUrl(url: string) {
    try {
      const r = await fetch(url, { mode: 'cors' });
      const blob = await r.blob();
      const file = new File([blob], `gif_${Date.now()}.gif`, { type: blob.type || 'image/gif' });
      onPick(file);
      setGifOpen(false);
    } catch {}
  }

  function clearFile() {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    submittedRef.current = true;

    const tText = text.trim();
    if (!tText && !file) return;
    setBusy(true);
    const fd = new FormData();
    fd.set('postId', postId);
    fd.set('text', tText);
    if (parentId) fd.set('parentId', parentId);
    if (file) fd.set('media', file);

    const res = await addCommentAction(fd);
    setBusy(false);


    if (res.ok) {
    // ✅ Erfolg – 2s Toast (anpassbar über durationMs)
    toast.show({
      title: tt('comment.sent'),
      variant: 'success',
      durationMs: 2000, // 2 Sekunden
    });

    setText('');
    clearFile();
    onDone();
  } else if (submittedRef.current) {
    // ❌ Fehler nur nach echtem Submit anzeigen
    toast.error(tt('comment.failedTitle'), tt('generic.tryAgain'));
  }

  submittedRef.current = false; // Reset
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/5 p-2 shadow-sm">
      {preview && (
        <figure className="relative mb-2 overflow-hidden rounded-xl border border-white/10 bg-black/20 flex justify-center">
          <Image
            src={preview}
            alt=""
            width={900}
            height={600}
            unoptimized
            sizes="100vw"
            className="
              block h-auto w-auto object-contain
              max-w-[min(100%,520px)] sm:max-w-[min(100%,620px)]
              max-h-[32vh] sm:max-h-[38vh]
            "
          />
          <button
            type="button"
            onClick={clearFile}
            className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/70 border border-white/20 hover:bg-black/80 text-[13px]"
            title={t('remove')}
          >
            {t('remove')}
          </button>
        </figure>
      )}

      <div className="flex gap-2 items-stretch">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={parentId ? t('replyPlaceholder') : t('placeholder')}
          className="flex-1 min-h-[60px] max-h-[180px] resize-y rounded-lg bg-transparent p-2 text-sm outline-none
                     placeholder:text-white/40 focus:ring-2 focus:ring-subm8-purple/40 border border-white/10"
        />

        <div className="flex flex-col items-center justify-center gap-2 pr-[2px]">
          <button
            type="button"
            onClick={() => setGifOpen(true)}
            className="inline-grid place-items-center size-9 rounded-md border border-white/15 hover:bg-white/5"
            title={t('addGif')}
          >
            <GifIcon />
          </button>

          <label
            className="inline-grid place-items-center size-9 rounded-md border border-white/15 hover:bg-white/5 cursor-pointer"
            title={t('attachImage')}
          >
            <input
              type="file"
              accept="image/*,video/*"
              className="sr-only"
              onChange={(e) => onPick(e.currentTarget.files?.[0] ?? null)}
            />
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
              <path d="M7.5 14.5 10.5 11l3 3 2.5-2.5 3 3" />
              <circle cx="9" cy="9" r="1.5" />
            </svg>
          </label>

          <button
            type="submit"
            disabled={busy || (!text.trim() && !file)}
            className="inline-grid place-items-center size-9 rounded-md bg-[var(--purple)] text-white shadow
                       hover:brightness-110 active:translate-y-px disabled:opacity-50"
            title={t('send')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
            </svg>
          </button>
        </div>
      </div>

      <GifPickerModal open={gifOpen} onClose={() => setGifOpen(false)} onPick={(url) => void onPickGifByUrl(url)} />
    </form>
  );
}

function RolePill({ role }: { role: 'DOMME' | 'SUBMISSIVE' }) {
  const tPost = useTranslations('post');
  const isDomme = role === 'DOMME';
  return isDomme ? (
    <span
      className="mt-1 text-[11px] leading-none px-2 py-1 rounded-full"
      style={{
        color: 'var(--purple)',
        background: 'rgba(139,92,246,.15)',
        border: '1px solid rgba(139,92,246,.25)',
      }}
    >
      {tPost('role.domme')}
    </span>
  ) : (
    <span className="mt-1 text-[11px] leading-none px-2 py-1 rounded-full border border-sky-500/25 bg-sky-600/15 text-sky-300">
      {tPost('role.submissive')}
    </span>
  );
}

/* Lokalisierte Kurzzeit-Angabe über common.time */
function timeAgoShort(iso: string, tTime: ReturnType<typeof useTranslations>) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return tTime('time.now');
  if (m < 60) return tTime('time.m', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return tTime('time.h', { count: h });
  const d = Math.floor(h / 24);
  return tTime('time.d', { count: d });
}

/* --------- Icon --------- */
function GifIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <text x="12" y="16" textAnchor="middle" fontFamily="ui-sans-serif,system-ui" fontSize="9" fill="currentColor">
        GIF
      </text>
    </svg>
  );
}
