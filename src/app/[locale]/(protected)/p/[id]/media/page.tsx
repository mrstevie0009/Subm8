// src/app/[locale]/(protected)/p/[id]/media/page.tsx
'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import VideoPlayer from '@/components/VideoPlayer';
import { toast } from '@/lib/toast';
import PostDetailHeader from '@/components/PostDetailHeader';
import Image from 'next/image';
import PostActionsBar from '@/components/PostActionsBar';

// ——— Helpers (wie in PostCard.tsx) ———
type ContentMedia = { url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif' };

function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.(mp4|webm|ogg|ogv|mov|m4v|mkv)$/i.test(clean);
}
function isGifUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split('?')[0].toLowerCase();
  return /\.gif$/i.test(clean);
}
const kindFromUrl = (url: string): 'image' | 'video' | 'gif' =>
  isVideoUrl(url) ? 'video' : isGifUrl(url) ? 'gif' : 'image';

type MediaContainer = {
  media?: ContentMedia[] | null;
  uploaded?: ContentMedia[] | null;
  mediaUrls?: string[] | null;
  attachments?: Array<{ url: string; alt?: string | null; kind?: 'image' | 'video' | 'gif' }> | null;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
};

function normalizeMediaFields(src: MediaContainer): ContentMedia[] {
  const out: ContentMedia[] = [];
  const pushArr = (arr?: ContentMedia[] | null) => {
    if (!Array.isArray(arr)) return;
    for (const m of arr) {
      if (m?.url) out.push({ url: m.url, alt: m.alt ?? null, kind: m.kind ?? kindFromUrl(m.url) });
    }
  };
  pushArr(src.media);
  pushArr(src.uploaded);
  if (Array.isArray(src.attachments)) {
    for (const m of src.attachments) if (m?.url) out.push({ url: m.url, alt: m.alt ?? null, kind: m.kind ?? kindFromUrl(m.url) });
  }
  if (Array.isArray(src.mediaUrls)) {
    for (const url of src.mediaUrls) if (url) out.push({ url, alt: null, kind: kindFromUrl(url) });
  }
  if (src.mediaUrl) {
    out.push({ url: src.mediaUrl, alt: src.mediaAlt ?? null, kind: kindFromUrl(src.mediaUrl) });
  }
  const seen = new Set<string>();
  return out.filter(m => (seen.has(m.url) ? false : (seen.add(m.url), true)));
}

// ——— kleine Type-Guards, um ohne `any` zu parsen ———
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function getProp<T = unknown>(obj: unknown, key: string): T | undefined {
  if (!isObj(obj)) return undefined;
  const val = (obj as Record<string, unknown>)[key];
  return val as T | undefined;
}
function pickPreviewPayload(input: unknown): MediaContainer {
  const tryPaths = [
    ['content'],
    ['item', 'content'],
    ['post', 'content'],
    ['data', 'content'],
    ['item'],
    ['post'],
    ['data'],
  ];

  for (const path of tryPaths) {
    let cur: unknown = input;
    let ok = true;
    for (const k of path) {
      cur = getProp(cur, k);
      if (cur === undefined) { ok = false; break; }
    }
    if (ok && isObj(cur)) {
      return cur as MediaContainer;
    }
  }
  return isObj(input) ? (input as MediaContainer) : {};
}

// ——— Gate für Unverified ———
function BlurredGate({ onStartVeriff }: { onStartVeriff: () => void | Promise<void> }) {
  const tVerify = useTranslations('verify');
  return (
    <div className="min-h-[70vh] grid place-items-center p-6">
      <div className="text-center max-w-[520px] rounded-2xl border border-white/15 bg-black/70 backdrop-blur p-6">
        <div className="text-base font-semibold">{tVerify('overlay.heading')}</div>
        <div className="mt-2 text-sm text-white/80">{tVerify('overlay.body')}</div>
        <button
          type="button"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--purple)] px-4 py-2 text-white hover:opacity-95"
          onClick={() => void onStartVeriff()}
        >
          {tVerify('overlay.cta')}
        </button>
        <div className="mt-2 text-[11px] text-white/60">{tVerify('overlay.note')}</div>
      </div>
    </div>
  );
}

export default function PostMediaPage() {
  const router = useRouter();
  const params = useParams() as { locale: string; id: string };
  const { locale, id } = params;
  const search = useSearchParams();
  const startIdx = Math.max(0, parseInt(search.get('i') || '0', 10) || 0);
  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;

  const [snapStats, setSnapStats] = React.useState<{ likes?: number; comments?: number; reposts?: number }>();
  const [snapViewer, setSnapViewer] = React.useState<{ liked?: boolean; bookmarked?: boolean; reposted?: boolean }>();

  const [items, setItems] = React.useState<ContentMedia[] | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    try {
        const raw = sessionStorage.getItem(`ps:snap:${id}`);
        if (raw) {
        const s = JSON.parse(raw) as {
            likes?: number; comments?: number; reposts?: number;
            liked?: boolean; bookmarked?: boolean; hasReposted?: boolean;
        };
        setSnapStats({ likes: s.likes, comments: s.comments, reposts: s.reposts });
        setSnapViewer({ liked: s.liked, bookmarked: s.bookmarked, reposted: s.hasReposted });
        }
    } catch {}
    }, [id]);

  // Prefill aus sessionStorage (vom Feed/Detail vorher gesetzt)
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`pm:${id}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { v?: number; at?: number; items?: ContentMedia[] };
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        setItems(parsed.items);
      }
    } catch {}
  }, [id]);

  // Medien laden – aber nur, wenn noch nichts im State vorhanden ist
  React.useEffect(() => {
    if (Array.isArray(items) && items.length > 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/posts/preview/${encodeURIComponent(id)}`, { cache: 'no-store' });
        const j: unknown = await res.json().catch(() => null);
        if (!res.ok || !j) throw new Error('Bad response');

        const media = normalizeMediaFields(pickPreviewPayload(j));
        if (!cancelled) {
          if (!Array.isArray(media) || media.length === 0) {
            setItems([]);
            toast.error('Keine Medien im Post gefunden (API-Antwort ohne media-Felder).', 'Keine Medien');
            return;
          }
          setItems(media);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          toast.error('Konnte Medien nicht laden.', 'Fehler');
        }
      }
    })();
    return () => { cancelled = true; };
    // bewusst KEIN `items` in deps
  }, [id, items]); 

  // Beim ersten Render nach Load ggf. zum i-th Element scrollen
  React.useEffect(() => {
    if (!items || !containerRef.current) return;
    const idx = Math.min(Math.max(0, startIdx), Math.max(0, items.length - 1));
    const el = containerRef.current.children[idx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [items, startIdx]);

  const startAgeVerification = React.useCallback(async () => {
    try {
      const back = `/${locale}/p/${id}/media?i=${startIdx}`;
      if (!session) {
        router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }
      const res = await fetch(`/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`, { method: 'POST' });
      const j: unknown = await res.json().catch(() => null);
      const url = isObj(j) ? (j['url'] as string | undefined) : undefined;
      if (!res.ok || !url) throw new Error('veriff start failed');
      router.push(url);
    } catch {
      toast.error('Die Verifikation konnte nicht gestartet werden.', 'Fehler');
    }
  }, [id, locale, router, session, startIdx]);

  // UI
  return (
    <div className="min-h-[100svh] bg-black text-white flex flex-col">
    {/* Immer sichtbarer (fixed) Header */}
    <PostDetailHeader fixed />

    {/* Spacer in gleicher Höhe wie der Header (≈ 48px) */}
    <div aria-hidden className="h-12" />

    {!ageOk ? (
      <BlurredGate onStartVeriff={startAgeVerification} />
    ) : !items ? (
      <div className="flex-1 grid place-items-center text-white/70">Lade Medien…</div>
    ) : items.length === 0 ? (
      <div className="flex-1 grid place-items-center text-white/70">Keine Medien gefunden.</div>
    ) : (
      <div
        ref={containerRef}
        className="space-y-6 px-2 pb-10 pt-2 snap-y snap-mandatory"
        style={{ overscrollBehaviorY: 'contain', WebkitOverflowScrolling: 'touch' }}
      >
        {items.map((m) => (
          <figure
            key={m.url}
            className="grid place-items-center rounded-xl border border-white/10 bg-black/20 overflow-hidden snap-start md:snap-center"
            style={{
              minHeight: 'min(88svh, 720px)',
              scrollSnapStop: 'always',     // stoppt zuverlässig auf jedem Item
              scrollMarginTop: '56px',      // ≈ Headerhöhe (48px) + etwas Puffer
            }}
          >
            {m.kind === 'video' ? (
              <VideoPlayer
                src={m.url}
                className="max-h-[88svh] w-auto"
                autoPlay
                muted
                loop
              />
            ) : (
              <Image
                src={m.url}
                alt={m.alt ?? ''}
                width={1080}
                height={1920}
                className="max-h-[88svh] w-auto object-contain"
                unoptimized
              />
            )}
          </figure>
        ))}
        <PostActionsBar
            postId={id}
            stats={snapStats} 
            viewer={snapViewer}
        />
      </div>
    )}
  </div>
);
}
