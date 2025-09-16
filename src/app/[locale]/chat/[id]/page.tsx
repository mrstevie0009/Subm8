// src/app/[locale]/chat/[id]/page.tsx
'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import Image from 'next/image';
import ChatHeader from '@/components/ChatHeader';
import ChatComposer from '@/components/ChatComposer';
import TipModal from '@/components/TipModal';
import TipRequestAcceptModal from '@/components/TipRequestAcceptModal';
import OwnershipRequestAcceptModal from '@/components/OwnershipRequestAcceptModal';
import type {
  OwnershipReqPayload as AcceptOwnReqPayload, // ← das ist der exakte Modal-Typ
} from '@/components/OwnershipRequestAcceptModal';
import type { ChatMessage } from '@/types/chat';
import RichText from '@/components/RichText';

type DbRole = 'DOMME' | 'SUBMISSIVE';

type ThreadOk = {
  ok: true;
  me: { id: string; role: DbRole; avatarUrl?: string | null };
  other: {
    id: string;
    handle: string;
    displayName: string;
    avatarUrl: string | null;
    role: DbRole;
  };
  messages: {
    id: string;
    at: string;
    authorId: string;
    text?: string | null;
    mediaUrl?: string | null;
    mediaType?: string | null;
    read: boolean;
  }[];
  viewerHasBlocked: boolean;
  isBlockedByOther: boolean;
};
type ThreadErr = { ok: false; error: string };
type ThreadResponse = ThreadOk | ThreadErr;

type UiMessage = ChatMessage & {
  mediaUrl?: string;
  mediaType?: string;
};

const AVATAR_PH = '/images/avatar-placeholder.png';

/* ------------ Envelope helpers ------------ */
const TIPREQ_PREFIX = 'TIPREQ::';
type TipRequestPayload = { id?: string; amountCents: number; currency: string; note?: string };
function parseTipRequest(text?: string | null): TipRequestPayload | null {
  if (!text || !text.startsWith(TIPREQ_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(TIPREQ_PREFIX.length));
    if (typeof obj?.amountCents === 'number' && obj?.currency) return obj as TipRequestPayload;
  } catch {}
  return null;
}
const TIPPAID_PREFIX = 'TIPPAID::';
type TipPaidPayload = { id?: string; amountCents: number; currency: string; note?: string };
function parseTipPaid(text?: string | null): TipPaidPayload | null {
  if (!text || !text.startsWith(TIPPAID_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(TIPPAID_PREFIX.length));
    if (typeof obj?.amountCents === 'number' && obj?.currency) return obj as TipPaidPayload;
  } catch {}
  return null;
}
const OWNREQ_PREFIX = 'OWNREQ::';
const OWNACC_PREFIX = 'OWNACC::';

/** Benutze exakt den Typ aus dem Modal, um Inkompatibilitäten zu vermeiden */
type OwnershipReqPayload = AcceptOwnReqPayload;

function parseOwnReq(text?: string | null): OwnershipReqPayload | null {
  if (!text || !text.startsWith(OWNREQ_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(OWNREQ_PREFIX.length)) as OwnershipReqPayload;
    if (obj && typeof obj === 'object') return obj;
  } catch {}
  return null;
}
function parseOwnAcc(text?: string | null): { ok: true } | null {
  if (!text || !text.startsWith(OWNACC_PREFIX)) return null;
  return { ok: true };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Legacy-Shape-Erkennung nur für Bequemen Zugriff */
type LegacyDataUrls = { avatarDataUrl?: string; bannerDataUrl?: string; bio?: string };
function isLegacyDataUrls(p: OwnershipReqPayload): p is LegacyDataUrls {
  return isRecord(p) && (
    'avatarDataUrl' in p ||
    'bannerDataUrl' in p ||
    'bio' in p
  );
}

function fmtCurrency(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format((cents || 0) / 100);
}

/* ---------- Media-Type Guards (MIME-first) ---------- */
function getExt(url?: string) {
  if (!url) return '';
  const clean = url.split('?')[0];
  const parts = clean.split('.');
  return (parts.pop() || '').toLowerCase();
}
const VIDEO_EXT = new Set(['mp4', 'webm', 'ogg', 'ogv', 'mov', 'm4v', 'mkv']);
const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'oga', 'm4a', 'webm']);

const isVideo = (url?: string, mime?: string) => {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('video/')) return true;
  if (m.startsWith('audio/')) return false;
  return VIDEO_EXT.has(getExt(url));
};
const isImage = (url?: string, mime?: string) => {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('image/')) return true;
  return IMAGE_EXT.has(getExt(url));
};
const isAudio = (url?: string, mime?: string) => {
  const m = (mime || '').toLowerCase();
  if (m.startsWith('audio/')) return true;
  if (m.startsWith('video/')) return false;
  return AUDIO_EXT.has(getExt(url));
};

/* ---------- kleine Hilfen ---------- */
function fmtTime(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

/* ---------- Waveform (Peaks) + AudioBubble ---------- */
function usePeaks(src: string, bars = 56) {
  const [peaks, setPeaks] = React.useState<number[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const resp = await fetch(src);
        const buf = await resp.arrayBuffer();
        const AudioCtx = window.AudioContext;
        const ctx = new AudioCtx();
        const audio = await ctx.decodeAudioData(buf.slice(0));
        const ch = audio.getChannelData(0);
        const block = Math.floor(ch.length / bars) || 1;

        const p: number[] = [];
        let globalMax = 0;
        for (let i = 0; i < bars; i++) {
          let max = 0;
          const start = i * block;
          const end = Math.min(ch.length, start + block);
          for (let j = start; j < end; j++) {
            const v = Math.abs(ch[j]);
            if (v > max) max = v;
          }
          p.push(max);
          if (max > globalMax) globalMax = max;
        }
        const norm = globalMax > 0 ? p.map((v) => v / globalMax) : p;
        if (!cancelled) setPeaks(norm);
        ctx.close().catch(() => {});
      } catch {
        if (!cancelled) setPeaks(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, bars]);

  return peaks;
}

function AudioBubble({
  src,
  mine,
  avatarUrl,
}: {
  src: string;
  mine: boolean;
  avatarUrl?: string | null;
}) {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [dur, setDur] = React.useState(0);
  const [t, setT] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  const peaks = usePeaks(src, 56);

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDur(a.duration || 0);
    const onTime = () => setT(a.currentTime || 0);
    const onEnd = () => setPlaying(false);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) {
      void a.play();
      setPlaying(true);
    } else {
      a.pause();
      setPlaying(false);
    }
  };

  const progress = dur > 0 ? t / dur : 0;
  const activeIdx = peaks ? Math.floor(progress * peaks.length) : 0;

  const onWavePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const newT = ratio * dur;
    a.currentTime = newT;
    setT(newT);
  };

  const bubbleBase = mine ? 'bg-[var(--purple)] text-white' : 'bg-white/[.07] text-white border border-white/10';

  return (
    <div className="flex items-center gap-3 w-full max-w-full">
      <div className="relative shrink-0 w-10 h-10 rounded-full overflow-hidden border border-white/10">
        <Image src={avatarUrl ?? AVATAR_PH} alt="" fill sizes="40px" className="object-cover" priority={false} />
      </div>

      <div className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${bubbleBase} w-0 flex-1 min-w-0`}>
        <button
          type="button"
          onClick={toggle}
          className="grid place-items-center rounded-full w-8 h-8 bg-black/15 hover:bg-black/25 shrink-0"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
              <rect x="6" y="5" width="5" height="14" rx="1.2" />
              <rect x="13" y="5" width="5" height="14" rx="1.2" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        <div
          role="slider"
          aria-valuemin={0}
          aria-valuemax={dur || 0}
          aria-valuenow={t}
          className="h-8 flex-1 min-w-[120px] max-w-full flex items-end gap-[1px] overflow-hidden cursor-pointer select-none"
          onPointerDown={onWavePointer}
        >
          {peaks ? (
            peaks.map((p, i) => {
              const h = 6 + Math.round(p * 18);
              const on = i <= activeIdx;
              return (
                <div
                  key={i}
                  className="rounded-[2px]"
                  style={{
                    width: 2,
                    height: h,
                    background: on ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.55)',
                  }}
                />
              );
            })
          ) : (
            <div className="w-full h-[6px] rounded-full bg-white/40" />
          )}
        </div>

        <div className="text-[12px] opacity-90 tabular-nums w-[68px] text-right shrink-0">
          {fmtTime(t)} / {fmtTime(dur)}
        </div>

        <audio ref={audioRef} preload="metadata" src={src} />
      </div>
    </div>
  );
}

/* ---------- Post-Link Preview helpers ---------- */
function parsePostLink(text?: string | null): { id: string; url: string } | null {
  if (!text) return null;
  const s = text.trim();
  if (!s) return null;
  const m = s.match(/(https?:\/\/[^\s]+|\/[^\s]+)/);
  if (!m) return null;
  const raw = m[1];
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, base);
    const parts = u.pathname.split('/').filter(Boolean);
    const pIdx = parts.indexOf('p');
    if (pIdx >= 0 && parts[pIdx + 1]) {
      return { id: parts[pIdx + 1], url: u.toString() };
    }
  } catch {}
  return null;
}

type PostPreviewDto = {
  id: string;
  text: string;
  createdAt: string;
  mediaUrl?: string | null;
  mediaAlt?: string | null;
  author: { displayName: string; handle: string; avatarUrl?: string | null };
};

function PostLinkPreview({ postId, locale }: { postId: string; locale: string }) {
  const [data, setData] = React.useState<PostPreviewDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/posts/preview/${encodeURIComponent(postId)}`, { cache: 'no-store' });
        const j: { ok: boolean; post?: PostPreviewDto } = await r.json();
        if (!cancelled && j?.ok && j.post) setData(j.post);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const containerCls =
    'max-w-[75vw] md:max-w-[560px] rounded-2xl overflow-hidden border bg-white/[.06] border-white/12 hover:bg-white/[.1] cursor-pointer';

  const go = () => {
    window.location.href = `/${locale}/p/${postId}`;
  };

  if (loading || !data) {
    return (
      <div className={containerCls}>
        <div className="p-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
            <div className="mt-2 h-3 w-24 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-44 bg-white/5" />
      </div>
    );
  }

  const media = data.mediaUrl
    ? isVideo(data.mediaUrl)
      ? (
          <video
            src={data.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="block w-full max-h-[360px] object-contain bg-black"
          />
        )
      : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.mediaUrl}
            alt={data.mediaAlt ?? ''}
            className="block w-full max-h-[360px] object-cover"
            loading="lazy"
            decoding="async"
          />
        )
    : null;

  return (
    <div
      className={containerCls}
      onClick={go}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') go();
      }}
      title={new Date(data.createdAt).toLocaleString()}
    >
      <div className="p-3 flex items-start gap-3">
        <div className="relative w-9 h-9 rounded-full overflow-hidden bg-white/10 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.author.avatarUrl || AVATAR_PH} alt="" className="w-full h-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] leading-tight font-semibold truncate">{data.author.displayName}</div>
          <div className="text-[12px] text-white/70 truncate">
            @{data.author.handle} · {new Date(data.createdAt).toLocaleDateString()}
          </div>
          <div className="mt-1 text-[13px] text-white/90 whitespace-pre-wrap break-words line-clamp-6">{data.text}</div>
        </div>
      </div>

      {media}
    </div>
  );
}

/* ---------- Profile-Link Preview helpers ---------- */
function parseProfileLink(text?: string | null): { handle: string; url: string } | null {
  if (!text) return null;
  const s = text.trim();
  if (!s) return null;

  const m = s.match(/(https?:\/\/[^\s]+|\/[^\s]+)/);
  if (!m) return null;
  const raw = m[1];

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, base);
    const parts = u.pathname.split('/').filter(Boolean);
    const uIdx = parts.indexOf('u');
    if (uIdx >= 0 && parts[uIdx + 1]) {
      return { handle: parts[uIdx + 1], url: u.toString() };
    }
  } catch {}
  return null;
}

type ProfilePreviewDto = {
  handle: string;
  displayName: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
};

function ProfileLinkPreview({ handle, locale }: { handle: string; locale: string }) {
  const [data, setData] = React.useState<ProfilePreviewDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/profile/preview/${encodeURIComponent(handle)}`, { cache: 'no-store' });
        const j: { ok: boolean; profile?: ProfilePreviewDto } = await r.json();
        if (!cancelled && j?.ok && j.profile) setData(j.profile);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [handle]);

  const go = () => { window.location.href = `/${locale}/u/${handle}`; };
  const containerCls =
    'max-w-[75vw] md:max-w-[560px] rounded-2xl overflow-hidden border bg-white/[.06] border-white/12 hover:bg-white/[.1] cursor-pointer';

  if (loading || !data) {
    return (
      <div className={containerCls}>
        <div className="h-28 bg-white/5" />
        <div className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
            <div className="mt-2 h-3 w-24 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={containerCls} onClick={go} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go(); }}>
      <div className="relative h-[160px] bg-white/[.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={data.bannerUrl || '/images/banner-placeholder.png'} alt="" className="w-full h-full object-cover" />
        <div className="absolute left-3 bottom-3 flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-full overflow-hidden border border-white/25">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.avatarUrl || '/images/avatar-placeholder.png'} alt="" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="text-[15px] font-semibold leading-tight">{data.displayName}</div>
            <div className="text-[12px] text-white/70">@{data.handle}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------- Page ------------------------- */
export default function ChatThreadPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const locale = useLocale();

  const [meId, setMeId] = React.useState<string | null>(null);
  const [meRole, setMeRole] = React.useState<'domme' | 'submissive' | null>(null);
  const [meAvatarUrl, setMeAvatarUrl] = React.useState<string | null>(null);

  const [other, setOther] = React.useState<{
    id: string;
    username: string;
    displayName: string;
    avatarUrl?: string;
    role: 'domme' | 'submissive';
    dmOpen: boolean;
  } | null>(null);

  const [viewerHasBlocked, setViewerHasBlocked] = React.useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = React.useState(false);

  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [tipOpen, setTipOpen] = React.useState(false);
  const [accept, setAccept] = React.useState<{
    amountCents: number;
    currency: string;
    toUserId: string;
    toDisplayName: string;
    toAvatarUrl?: string;
  } | null>(null);
  const [ownToAccept, setOwnToAccept] = React.useState<OwnershipReqPayload | null>(null);

  const mapRole = React.useCallback((r: DbRole): 'domme' | 'submissive' => (r === 'DOMME' ? 'domme' : 'submissive'), []);

  const load = React.useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/chat/${id}`, { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Unexpected response (${res.status}). ${txt ? txt.slice(0, 140) : 'Empty body'}`);
      }

      const json: ThreadResponse = await res.json();
      if (!json.ok) throw new Error(json.error || 'Failed to load');

      setMeId(json.me.id);
      setMeRole(mapRole(json.me.role));
      setMeAvatarUrl((json as ThreadOk).me.avatarUrl ?? null);

      setViewerHasBlocked(json.viewerHasBlocked ?? false);
      setIsBlockedByOther(json.isBlockedByOther ?? false);

      const disabled = (json.viewerHasBlocked ?? false) || (json.isBlockedByOther ?? false);

      setOther({
        id: (json as ThreadOk).other.id,
        username: (json as ThreadOk).other.handle,
        displayName: (json as ThreadOk).other.displayName,
        avatarUrl: (json as ThreadOk).other.avatarUrl ?? undefined,
        role: mapRole((json as ThreadOk).other.role),
        dmOpen: !disabled,
      });

      const mapped: UiMessage[] = (json as ThreadOk).messages.map((m) => ({
        id: m.id,
        convoId: String(id),
        senderId: m.authorId,
        text: m.text ?? (m.mediaUrl ? '' : ''),
        createdAt: m.at,
        seen: m.read,
        mediaUrl: m.mediaUrl ?? undefined,
        mediaType: m.mediaType ?? undefined,
      }));
      setMessages(mapped);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [id, mapRole]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    const t = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [load]);

  const sendMessage = React.useCallback(
    async ({ text, file }: { text: string; file?: File }) => {
      if (viewerHasBlocked || isBlockedByOther) return;
      if (file) {
        const fd = new FormData();
        fd.append('text', text);
        fd.append('file', file);
        await fetch(`/api/chat/${id}`, { method: 'POST', body: fd });
      } else {
        await fetch(`/api/chat/${id}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ text }),
        });
      }
      await load();
    },
    [id, load, viewerHasBlocked, isBlockedByOther]
  );

  // --------- Einmaliges Senden von ?text= beim ersten Laden (z.B. nach /chat/new?to&text) ---------
  const didInjectRef = React.useRef(false);
  React.useEffect(() => {
    if (didInjectRef.current) return;
    const initial = searchParams.get('text');
    if (!initial) return;
    if (viewerHasBlocked || isBlockedByOther) return;
    didInjectRef.current = true;
    (async () => {
      await sendMessage({ text: initial });
      try {
        const u = new URL(window.location.href);
        u.searchParams.delete('text');
        window.history.replaceState({}, '', u.toString());
      } catch {}
    })();
  }, [searchParams, viewerHasBlocked, isBlockedByOther, sendMessage]);

  const disabled = viewerHasBlocked || isBlockedByOther;
  const disabledNotice = disabled
    ? isBlockedByOther
      ? 'Du kannst dieser Person keine Direktnachrichten mehr senden.'
      : 'Du hast diese Person blockiert. Senden ist deaktiviert.'
    : undefined;

  if (!loading && error) {
    return (
      <main className="mx-auto px-3 py-6" style={{ maxWidth: 760 }}>
        {error}
      </main>
    );
  }

  return (
    <>
      {other && (
        <ChatHeader
          other={{
            id: other.id,
            username: other.username,
            displayName: other.displayName,
            avatarUrl: other.avatarUrl,
            role: other.role,
            dmOpen: other.dmOpen,
          }}
          viewerHasBlocked={viewerHasBlocked}
          isBlockedByOther={isBlockedByOther}
        />
      )}

      <main className="px-3">
        <div
          className="mx-auto w-full max-w-[760px]"
          style={{
            paddingTop: 'calc(var(--header-h, 56px) + var(--chat-header-h, 48px) + 8px)',
            paddingBottom: 'calc(var(--bottomnav-h, 72px) + 72px)',
          }}
        >
          {loading ? (
            <div className="py-8 text-sm text-muted">Loading…</div>
          ) : (
            <div className="space-y-2 pb-24">
              {messages.map((m) => {
                const mine = meId ? m.senderId === meId : false;

                // --- Special bubbles ---
                const req = parseTipRequest(m.text);
                if (req) {
                  const isViewerSub = meRole === 'submissive';
                  const canAct = !mine && isViewerSub && !!other;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">TIP REQUEST</div>
                        <div className="text-[15px] font-semibold">{fmtCurrency(req.amountCents, req.currency)}</div>
                        {req.note && <div className="mt-1 text-[13px] text-white/80 whitespace-pre-wrap">{req.note}</div>}
                        {canAct && (
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-[var(--purple)]/90 text-white hover:opacity-95"
                              onClick={() => {
                                setAccept({
                                  amountCents: req.amountCents,
                                  currency: req.currency,
                                  toUserId: m.senderId,
                                  toDisplayName: other!.displayName,
                                  toAvatarUrl: other!.avatarUrl,
                                });
                              }}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
                              onClick={() => void sendMessage({ text: '❌ Declined tip request' })}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const paid = parseTipPaid(m.text);
                if (paid) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/70 mb-1">
                          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
                          </svg>
                          <span>TIP PAID</span>
                          {paid.id && <span className="text-white/50 normal-case ml-1">#{paid.id.slice(0, 6)}</span>}
                        </div>
                        <div className="text-[15px] font-semibold">{fmtCurrency(paid.amountCents, paid.currency)}</div>
                        {paid.note && <div className="mt-1 text-[13px] text-white/80 whitespace-pre-wrap">{paid.note}</div>}
                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const ownReq = parseOwnReq(m.text);
                if (ownReq) {
                  const canAct = !mine && meRole === 'submissive';

                  const hasAvatar =
                    Boolean((ownReq as { avatar?: true }).avatar) ||
                    (isLegacyDataUrls(ownReq) && Boolean(ownReq.avatarDataUrl));

                  const hasBanner =
                    Boolean((ownReq as { banner?: true }).banner) ||
                    (isLegacyDataUrls(ownReq) && Boolean(ownReq.bannerDataUrl));

                  const hasBio =
                    (isLegacyDataUrls(ownReq) && typeof ownReq.bio === 'string' && ownReq.bio.trim().length > 0) ||
                    Boolean((ownReq as { bio?: string }).bio && String((ownReq as { bio?: string }).bio).trim().length > 0);

                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">OWNERSHIP REQUEST</div>
                        <ul className="text-[13px] text-white/80 space-y-1 mb-2">
                          {hasAvatar && <li>• Avatar</li>}
                          {hasBanner && <li>• Banner</li>}
                          {hasBio && <li>• Bio</li>}
                        </ul>
                        {canAct && (
                          <div className="mt-1 flex items-center gap-2">
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg bg-[var(--purple)]/90 text-white hover:opacity-95"
                              onClick={() => setOwnToAccept(ownReq)}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
                              onClick={() => void sendMessage({ text: '❌ Declined ownership request' })}
                            >
                              Decline
                            </button>
                          </div>
                        )}
                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                const ownAcc = parseOwnAcc(m.text);
                if (ownAcc) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/70 mb-1">
                          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M8.5 12.5l2.5 2.5 4.5-5" />
                          </svg>
                          <span>OWNERSHIP ACCEPTED</span>
                        </div>
                        <div className="text-[13px] text-white/80">Changes were applied to the sub’s profile.</div>
                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Medien
                if (m.mediaUrl && (isImage(m.mediaUrl, m.mediaType) || isVideo(m.mediaUrl, m.mediaType))) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        {isVideo(m.mediaUrl, m.mediaType) ? (
                          <video
                            src={m.mediaUrl}
                            controls
                            playsInline
                            className="block max-w-[75vw] md:max-w-[560px] h-auto max-h-[60vh] rounded-xl border border-white/10 object-contain"
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.mediaUrl}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="block max-w-[75vw] md:max-w-[560px] h-auto max-h-[60vh] rounded-xl border border-white/10 object-contain"
                          />
                        )}
                        {m.text && (
                          <div className={`mt-1 text-[13px] ${mine ? 'text-white/90' : 'text-white/80'}`}>
                            <RichText text={m.text} locale={locale} validateMentions variant={mine ? 'chat' : 'default'} />
                          </div>
                        )}
                        <div className="text-[11px] mt-1 text-white/60 text-right">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Audio
                if (m.mediaUrl && isAudio(m.mediaUrl, m.mediaType)) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className="w-full max-w-[75vw] md:max-w-[560px]">
                        <AudioBubble src={m.mediaUrl} mine={mine} avatarUrl={mine ? meAvatarUrl : other?.avatarUrl} />
                        {m.text && (
                          <div className={`mt-1 ${mine ? 'text-white' : 'text-white/90'}`}>
                            <RichText text={m.text} locale={locale} validateMentions variant={mine ? 'chat' : 'default'} />
                          </div>
                        )}
                        <div className="text-[11px] mt-1 text-white/60 text-right">
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Post-Link Preview  —> jetzt MIT Zeitstempel darunter
                const link = parsePostLink(m.text);
                if (link && (!m.text || m.text.trim() === link.url.trim())) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <PostLinkPreview postId={link.id} locale={locale} />
                        <div
                          className="text-[11px] mt-1 text-white/60 text-right"
                          title={new Date(m.createdAt).toLocaleString()}
                        >
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Profile-Link Preview  —> jetzt MIT Zeitstempel darunter
                const pLink = parseProfileLink(m.text);
                if (pLink && (!m.text || m.text.trim() === pLink.url.trim())) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <ProfileLinkPreview handle={pLink.handle} locale={locale} />
                        <div
                          className="text-[11px] mt-1 text-white/60 text-right"
                          title={new Date(m.createdAt).toLocaleString()}
                        >
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // reiner Text
                const mineBubble = mine ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white' : 'bg-white/[.07] border-white/10';
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3 py-2 border break-words ${mineBubble}`}
                      title={new Date(m.createdAt).toLocaleString()}
                    >
                      {m.text && (
                        <RichText
                          text={m.text}
                          locale={locale}
                          validateMentions
                          className="break-words"
                          variant={mine ? 'chat' : 'default'}
                        />
                      )}
                      <div className={`text-[11px] mt-1 opacity-80 ${mine ? 'text-white/80' : 'text-white/70'}`}>
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Composer */}
      <ChatComposer
        viewerRole={meRole ?? 'submissive'}
        disabled={disabled}
        disabledNotice={disabledNotice}
        selfUserId={meId ?? ''}
        targetHandle={other?.username ?? ''}
        onSend={(text) => sendMessage({ text })}
        onTip={() => setTipOpen(true)}
        onUpload={(file) => sendMessage({ text: '', file })}
        onCreateTipRequest={(p: { amountCents: number; currency?: string; note?: string }) => {
          const { amountCents, currency = 'EUR', note } = p;
          const payload = { amountCents, currency, note: note?.trim() || undefined };
          void sendMessage({ text: `TIPREQ::${JSON.stringify(payload)}` });
        }}
      />

      {/* Modals */}
      {other && (
        <TipModal
          open={tipOpen}
          onClose={() => setTipOpen(false)}
          toUserId={other.id}
          toDisplayName={other.displayName}
          toRole={other.role}
          toAvatarUrl={other.avatarUrl}
          conversationId={String(id)}
          onSuccess={({ paymentId, amountCents, currency, note }) => {
            const payload: TipPaidPayload = { id: paymentId, amountCents, currency, note: note?.trim() || undefined };
            void sendMessage({ text: `${TIPPAID_PREFIX}${JSON.stringify(payload)}` });
            setTipOpen(false);
          }}
        />
      )}

      {accept && other && (
        <TipRequestAcceptModal
          open={!!accept}
          onClose={() => setAccept(null)}
          amountCents={accept.amountCents}
          currency={accept.currency}
          toUserId={accept.toUserId}
          toDisplayName={accept.toDisplayName}
          toAvatarUrl={accept.toAvatarUrl}
          conversationId={String(id)}
          onSuccess={({ amountCents, currency, paymentId }) => {
            const payload: TipPaidPayload = { id: paymentId, amountCents, currency };
            void sendMessage({ text: `${TIPPAID_PREFIX}${JSON.stringify(payload)}` });
            setAccept(null);
          }}
        />
      )}

      {ownToAccept && (
        <OwnershipRequestAcceptModal
          open={!!ownToAccept}
          onClose={() => setOwnToAccept(null)}
          payload={ownToAccept} // ← exakt der Modal-Typ
          selfUserId={meId ?? undefined}
          onSuccess={async () => {
            await sendMessage({ text: `${OWNACC_PREFIX}{}` });
            setOwnToAccept(null);
            await load();
          }}
        />
      )}
    </>
  );
}
