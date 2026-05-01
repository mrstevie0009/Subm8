// src/components/ClientThread.tsx
'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import ChatHeader from '@/components/chat/ChatHeader';
import ChatComposer from '@/components/chat/ChatComposer';
import type { ReplyTargetLite } from '@/components/chat/ChatComposer';
import TipModal from '@/components/TipModal';
import TipRequestAcceptModal from '@/components/TipRequestAcceptModal';
import OwnershipRequestAcceptModal from '@/components/OwnershipRequestAcceptModal';
import AutoDrainRequestAcceptModal from '@/components/AutoDrainRequestAcceptModal';
import type {
  OwnershipReqPayload as AcceptOwnReqPayload,
} from '@/components/OwnershipRequestAcceptModal';
import type { ChatMessage } from '@/types/chat';
import RichText from '@/components/RichText';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/toast';
import type { ThreadResponse, ThreadOk } from '@/types/chat';

type DbRole = 'DOMME' | 'SUBMISSIVE';

type UiMessage = ChatMessage & {
  mediaUrl?: string;
  mediaType?: string;
  optimistic?: boolean;
  pending?: boolean;
  failed?: boolean;
};

type Meta =
  | { ok:true; id:string; type:'DM'|'GROUP'; member:true; role?: 'ADMIN'|'MEMBER'; title:string|null }
  | { ok:false; type:'DM'|'GROUP'; member:false; error:string };

function extractError(x: unknown): string | null {
  if (x && typeof x === 'object' && 'error' in x) {
    const v = (x as { error?: unknown }).error;
    return typeof v === 'string' ? v : null;
  }
  return null;
}

function isOptimistic(m: UiMessage): m is UiMessage & { optimistic: true } {
  return m.optimistic === true;
}

function useChatMetaBaseUrl(id: string) {
  const [kind, setKind] = React.useState<'dm'|'group'|null>(null);
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [metaErr, setMetaErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMetaErr(null);
        const r = await fetch(`/api/chat/meta/${id}`, { cache: 'no-store' });
        const j = (await r.json()) as Meta;
        if (cancelled) return;
        setMeta(j);
        if (!r.ok) {
          setKind(j && ('type' in j) ? (j.type === 'GROUP' ? 'group' : 'dm') : null);
          setMetaErr(extractError(j) || `HTTP ${r.status}`);
          return;
        }
        setKind(j.type === 'GROUP' ? 'group' : 'dm');
      } catch (e: unknown) {
        if (!cancelled) setMetaErr(e instanceof Error ? e.message : 'Meta failed');
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  const baseUrl = React.useMemo(() => {
    if (!kind) return null;
    return kind === 'group' ? `/api/chat/group/${id}` : `/api/chat/${id}`;
  }, [kind, id]);

  return { kind, baseUrl, meta, metaErr };
}

/* ========= (1) STABIL: shallowEqualMsg + stableMergeMessages im Modul-Scope ========= */
function shallowEqualMsg(a: UiMessage, b: UiMessage) {
  return (
    a.id === b.id &&
    a.senderId === b.senderId &&
    a.createdAt === b.createdAt &&
    a.text === b.text &&
    a.mediaUrl === b.mediaUrl &&
    a.mediaType === b.mediaType &&
    a.seen === b.seen
  );
}

function stableMergeMessages(prev: UiMessage[], next: UiMessage[]) {
  if (prev.length === next.length) {
    let allSame = true;
    for (let i = 0; i < prev.length; i++) {
      if (!shallowEqualMsg(prev[i], next[i])) { allSame = false; break; }
    }
    if (allSame) return prev; // nichts ändern → kein Re-Render
  }
  const prevById = new Map(prev.map(m => [m.id, m]));
  return next.map(n => {
    const p = prevById.get(n.id);
    return p && shallowEqualMsg(p, n) ? p : n;
  });
}

function appendUnique(prev: UiMessage[], incoming: UiMessage[]) {
  const have = new Set(prev.map(x => x.id));
  const onlyNew = incoming.filter(x => !have.has(x.id));
  if (onlyNew.length === 0) return prev;
  const next = [...prev, ...onlyNew];
  return stableMergeMessages(prev, next);
}

function prependUnique(prev: UiMessage[], incoming: UiMessage[]) {
  const have = new Set(prev.map(x => x.id));
  const onlyNew = incoming.filter(x => !have.has(x.id));
  if (onlyNew.length === 0) return prev;
  const next = [...onlyNew, ...prev];
  return stableMergeMessages(prev, next);
}

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

/* ----- Autodrain envelopes ----- */
const ADREQ_PREFIX = 'ADREQ::';
type AutoDrainReqPayload = {
  amountCents: number;
  currency: string;
  cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
};
function parseAutoDrainReq(text?: string | null): AutoDrainReqPayload | null {
  if (!text || !text.startsWith(ADREQ_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(ADREQ_PREFIX.length));
    if (
      typeof obj?.amountCents === 'number' &&
      typeof obj?.currency === 'string' &&
      (obj?.cadence === 'DAILY' || obj?.cadence === 'WEEKLY' || obj?.cadence === 'MONTHLY')
    ) {
      return obj as AutoDrainReqPayload;
    }
  } catch {}
  return null;
}
const ADACC_PREFIX = 'ADACC::';
type AutoDrainAccPayload = {
  id?: string;
  amountCents: number;
  currency: string;
  cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
};
function parseAutoDrainAcc(text?: string | null): AutoDrainAccPayload | null {
  if (!text || !text.startsWith(ADACC_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(ADACC_PREFIX.length));
    if (
      typeof obj?.amountCents === 'number' &&
      typeof obj?.currency === 'string' &&
      (obj?.cadence === 'DAILY' || obj?.cadence === 'WEEKLY' || obj?.cadence === 'MONTHLY')
    ) {
      return obj as AutoDrainAccPayload;
    }
  } catch {}
  return null;
}

/* ----- Ownership envelopes ----- */
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

/** Legacy-Shape-Erkennung nur für bequemen Zugriff */
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

/* ---------- Media-Type Guards ---------- */
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

// --- Chat-Media Blur Gate (stabil mit Aspect Ratio) ---
function ChatBlurredMediaGate({
  mediaUrl,
  onStartVeriff,
  title = 'Altersnachweis erforderlich',
  subtitle = 'Verifiziere einmalig dein Alter, um Medieninhalte zu sehen.',
  cta = 'Jetzt verifizieren',
}: {
  mediaUrl?: string | null;
  onStartVeriff: () => void | Promise<void>;
  title?: string;
  subtitle?: string;
  cta?: string;
}) {
  const t = useTranslations('chat.chatThread');
  const isImg = mediaUrl ? (() => {
    const u = mediaUrl.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|webp|gif)$/i.test(u);
  })() : false;

  const wrapperStyle: React.CSSProperties = { width: 'min(75vw, 560px)' };

  return (
    <div
      className="relative inline-block rounded-xl border border-white/10 overflow-hidden"
      data-no-nav
      style={wrapperStyle}
    >
      <div className="bg-black/20">
        {isImg && mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt=""
            className="block w-full h-auto max-h-[60vh] object-cover"
            style={{ filter: 'blur(22px) saturate(.6) brightness(.7)' }}
            aria-hidden
          />
        ) : (
          <div
            className="w-full"
            style={{
              aspectRatio: '16 / 9',
              filter: 'blur(12px)',
              background: 'rgba(255,255,255,.04)',
            }}
            aria-hidden
          />
        )}
      </div>

      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div className="pointer-events-auto text-center px-4">
          <div className="inline-flex flex-col items-center gap-3 rounded-2xl border border-white/15 bg-black/70 backdrop-blur-md px-5 py-4">
            <div className="text-base font-semibold">{title}</div>
            <div className="text-sm text-white/80 max-w-[38ch]">{subtitle}</div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void onStartVeriff(); }}
              className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[var(--purple)] px-4 py-2 text-white hover:opacity-95"
            >
              {cta}
            </button>
            <div className="text-[11px] text-white/60">
              {t('verify.redirectNote')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
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
  const t = useTranslations('chat.chatThread');
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [dur, setDur] = React.useState(0);
  const [tNow, setTNow] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);

  const peaks = usePeaks(src, 56);

  React.useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDur(a.duration || 0);
    const onTime = () => setTNow(a.currentTime || 0);
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

  const progress = dur > 0 ? tNow / dur : 0;
  const activeIdx = peaks ? Math.floor(progress * peaks.length) : 0;

  const onWavePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !dur) return;
    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const newT = ratio * dur;
    a.currentTime = newT;
    setTNow(newT);
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
          aria-label={playing ? t('audio.pause') : t('audio.play')}
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
          aria-valuenow={tNow}
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
          {fmtTime(tNow)} / {fmtTime(dur)}
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

/* ---------- Community-Link Preview helpers (NEW) ---------- */
function parseCommunityLink(text?: string | null): { slug: string; url: string } | null {
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

    const cIdx = parts.indexOf('c');
    const commIdx = parts.indexOf('communities');

    let slug = '';
    if (cIdx >= 0 && parts[cIdx + 1]) slug = parts[cIdx + 1];
    else if (commIdx >= 0 && parts[commIdx + 1]) slug = parts[commIdx + 1];

    if (slug) return { slug, url: u.toString() };
  } catch {}
  return null;
}

type CommunityPreviewDto = {
  slug: string;
  name: string;
  memberCount?: number;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  description?: string | null;
};

function CommunityLinkPreview({ slug, locale }: { slug: string; locale: string }) {
  const t = useTranslations('chat.chatThread');
  const [data, setData] = React.useState<CommunityPreviewDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/communities/preview/${encodeURIComponent(slug)}`, { cache: 'no-store' });
        const j: { ok: boolean; community?: CommunityPreviewDto } = await r.json();
        if (!cancelled && j?.ok && j.community) setData(j.community);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);

  const go = () => {
    window.location.href = `/${locale}/c/${slug}`;
  };

  const containerCls =
    'max-w-[75vw] md:max-w-[560px] rounded-2xl overflow-hidden border bg-white/[.06] border-white/12 hover:bg-white/[.1] cursor-pointer';

  if (loading || !data) {
    return (
      <div className={containerCls}>
        <div className="h-28 bg-white/5" />
        <div className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
            <div className="mt-2 h-3 w-28 bg-white/10 rounded animate-pulse" />
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
            <div className="text-[15px] font-semibold leading-tight">{data.name}</div>
            <div className="text-[12px] text-white/70">
              @{data.slug}
              {typeof data.memberCount === 'number' ? ` · ${t('community.members', { count: data.memberCount })}` : ''}
            </div>
          </div>
        </div>
      </div>
      {data.description && (
        <div className="px-3 py-2 text-[13px] text-white/80 line-clamp-3">{data.description}</div>
      )}
    </div>
  );
}

/* ---------- Invite-Link Preview helpers ---------- */
function parseInviteLink(text?: string | null): { code: string; url: string } | null {
  if (!text) return null;
  const m = text.match(/(https?:\/\/[^\s]+|\/[^\s]+)/);
  if (!m) return null;
  const raw = m[1];

  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = raw.startsWith('http') ? new URL(raw) : new URL(raw, base);
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] === 'invite' && parts[1]) {
      return { code: parts[1], url: u.toString() };
    }
  } catch {}
  return null;
}

type InvitePreviewDto = {
  code: string;
  href: string;
  community: {
    slug: string;
    name: string;
    memberCount?: number;
    bannerUrl?: string | null;
    avatarUrl?: string | null;
    description?: string | null;
  };
  expiresAt?: string | null;
  remainingUses?: number | null;
};

function InviteLinkPreview({ code, href }: { code: string; href: string }) {
  const t = useTranslations('chat.chatThread');
  const [data, setData] = React.useState<InvitePreviewDto | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch(`/api/invites/preview/${encodeURIComponent(code)}`, { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!cancelled && j?.ok && j.invite) setData(j.invite);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  const go = React.useCallback(async () => {
    if (data?.community?.slug) {
      try {
        await fetch(
          `/api/communities/${encodeURIComponent(data.community.slug)}/join?invite=${encodeURIComponent(code)}`,
          { method: 'POST' }
        );
      } catch {}
      const seg = window.location.pathname.split('/').filter(Boolean)[0] || '';
      const prefix = seg && !['invite', 'c', 'communities', 'p', 'u'].includes(seg) ? `/${seg}` : '';
      window.location.href = `${prefix}/communities/${data.community.slug}`;
    } else {
      window.location.href = href;
    }
  }, [code, data, href]);

  const containerCls =
    'max-w-[75vw] md:max-w-[560px] rounded-2xl overflow-hidden border bg-white/[.06] border-white/12 hover:bg-white/[.1] cursor-pointer';

  if (loading || !data) {
    return (
      <div className={containerCls}>
        <div className="h-28 bg-white/5" />
        <div className="p-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 animate-pulse" />
          <div className="flex-1">
            <div className="h-3 w-48 bg-white/10 rounded animate-pulse" />
            <div className="mt-2 h-3 w-28 bg-white/10 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={containerCls}
      onClick={go}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') go(); }}
    >
      <div className="h-[160px] bg-white/[.03]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={data.community.bannerUrl || '/images/banner-placeholder.png'}
          alt=""
          className="w-full h-full object-cover"
        />
      </div>

      <div className="px-3 py-2">
        <div className="text-[15px] font-semibold leading-tight">
          {data.community.name}
        </div>
        <div className="text-[12px] text-white/70">
          @{data.community.slug}
          {typeof data.community.memberCount === 'number'
            ? ` · ${t('community.members', { count: data.community.memberCount })}`
            : ''}
        </div>

        {data.community.description && (
          <div className="mt-1 text-[13px] text-white/80 line-clamp-3">
            {data.community.description}
          </div>
        )}

        {(data.expiresAt || typeof data.remainingUses === 'number') && (
          <div className="mt-2 flex items-center gap-3 text-[12px] text-white/60">
            {data.expiresAt && (
              <span>{t('invite.expires', { date: new Date(data.expiresAt).toLocaleDateString() })}</span>
            )}
            {typeof data.remainingUses === 'number' && (
              <span>{t('invite.usesLeft', { count: data.remainingUses })}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------- Reply & Reaction (NEW) -------------------- */
/** Reply envelope: REPLY::{"to":"<messageId>","text":"..."} */
const REPLY_PREFIX = 'REPLY::';
type ReplyPayload = { to: string; text: string };
function parseReply(text?: string | null): ReplyPayload | null {
  if (!text || !text.startsWith(REPLY_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(REPLY_PREFIX.length));
    if (obj && typeof obj.to === 'string' && typeof obj.text === 'string') return obj as ReplyPayload;
  } catch {}
  return null;
}

/** Reaction envelope: REACT::{"to":"<messageId>","emoji":"❤️","op":"add"|"remove"} (op optional, default add) */
const REACT_PREFIX = 'REACT::';
type ReactionPayload = { to: string; emoji: string; op?: 'add'|'remove' };
function parseReaction(text?: string | null): ReactionPayload | null {
  if (!text || !text.startsWith(REACT_PREFIX)) return null;
  try {
    const obj = JSON.parse(text.slice(REACT_PREFIX.length));
    if (obj && typeof obj.to === 'string' && typeof obj.emoji === 'string') return obj as ReactionPayload;
  } catch {}
  return null;
}

/** kompakte Vorschau für referenzierte Nachricht */
function QuotedPreview({
  target,
  mine,
  locale,
}: {
  target: UiMessage | undefined;
  mine: boolean;
  locale: string;
}) {
  const t = useTranslations('chat.chatThread');
  return (
    <div className={`mb-1 rounded-lg border px-2 py-1 ${mine ? 'border-white/25 bg-white/10' : 'border-white/12 bg-white/06'}`}>
      {target ? (
        <>
          <div className="text-[11px] text-white/70">
            {new Date(target.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          {target.mediaUrl ? (
            <div className="text-[12px] text-white/80 italic">
              {isImage(target.mediaUrl, target.mediaType)
                ? t('media.image')
                : isVideo(target.mediaUrl, target.mediaType)
                  ? t('media.video')
                  : isAudio(target.mediaUrl, target.mediaType)
                    ? t('media.audio')
                    : t('media.attachment')}
            </div>
          ) : (
            <div className="text-[12px] text-white/90 line-clamp-3 break-words">
              <RichText text={target.text || ''} locale={locale} validateMentions variant="default" />
            </div>
          )}
        </>
      ) : (
        <div className="text-[12px] text-white/70 italic">{t('quoted.notFound')}</div>
      )}
    </div>
  );
}

function TypingDots({ mine = false }: { mine?: boolean }) {
  return (
    <div className={`inline-flex items-center gap-2 rounded-2xl px-3 py-2 border ${
      mine ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white'
           : 'bg-white/[.07] border-white/10 text-white/90'
    }`}>
      <span className="text-[13px]">typing</span>
      <span className="relative inline-flex w-10 h-4">
        {[0,1,2].map(i => (
          <span
            key={i}
            className="absolute left-0 top-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: 6, height: 6,
              transform: `translateX(${i*10}px) translateY(-50%)`,
              background: 'currentColor',
              opacity: 0.85,
              animation: `ctyp ${900 + i*120}ms infinite ease-in-out`,
            }}
          />
        ))}
        <style jsx>{`
          @keyframes ctyp {
            0%, 80%, 100% { transform: translateY(-50%) scale(0.6); opacity: .6; }
            40% { transform: translateY(-50%) scale(1); opacity: 1; }
          }
        `}</style>
      </span>
    </div>
  );
}


/* ------------ Long-Press + ContextMenu helper ------------ */
function useLongPress(
  onLongPress: (e: React.PointerEvent | React.MouseEvent) => void,
  { delay = 420 }: { delay?: number } = {},
) {
  const timerRef = React.useRef<number | null>(null);

  const clear = React.useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const didLongPressRef = React.useRef<boolean>(false);

  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    didLongPressRef.current = false;   // reset
    clear();
    timerRef.current = window.setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress(e);
      timerRef.current = null;
    }, delay);
  }, [delay, onLongPress, clear]);

  const onPointerUp = React.useCallback(() => {
    // ⬇️ WICHTIG:
    // Wenn der LongPress bereits ausgelöst wurde -> NICHT closen!
    if (!didLongPressRef.current) clear();
  }, [clear]);

  const cancelers = {
    onPointerUp,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };

  const onContextMenu = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    onLongPress(e);
  }, [onLongPress]);

  return { onPointerDown, onContextMenu, ...cancelers };
}

/* ---------- Popover + Types ---------- */
const DEFAULT_REACTIONS = ['❤️','😂','🔥','👍','👎','😮','😢'];

type ActionSheetState = {
  open: boolean;
  x: number; y: number;
  msgId: string;
  mine: boolean;
};

function ActionsPopover({ state, onClose, onReply, onReact }: {
  state: ActionSheetState;
  onClose: () => void;
  onReply: (msgId: string) => void;
  onReact: (msgId: string, emoji: string) => void;
}) {
  const t = useTranslations('chat.chatThread');
  const popRef = React.useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [showPicker, setShowPicker] = React.useState(false);

  React.useLayoutEffect(() => {
    if (!state.open || !popRef.current) return;

    // Größe der Popover-Box holen
    const rect = popRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Wunsch-Position: bevorzugt ÜBER dem Finger/Klick (12px Abstand).
    let left = state.x - rect.width / 2;
    let top = state.y - rect.height - 12;

    // Wenn oben nicht genug Platz, unter den Klick (auch 12px Abstand)
    if (top < 8) top = state.y + 12;

    // Clamps an die Ränder (8px Padding zum Rand)
    left = Math.max(8, Math.min(left, vw - rect.width - 8));
    top  = Math.max(8, Math.min(top,  vh - rect.height - 8));

    setPos({ left, top });
  }, [state.open, state.x, state.y]);

  if (!state.open) return null;
  return (
    <div
      className="fixed inset-0 z-[80]"
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose(); }}
    >
      <div
        ref={popRef}
        className="absolute rounded-xl border border-white/12 bg-black/80 backdrop-blur-md p-2 shadow-xl
                   max-w-[calc(100vw-16px)]"
        style={{ left: pos.left, top: pos.top }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1 flex-wrap">
          {DEFAULT_REACTIONS.map((emo) => (
            <button
              key={emo}
              type="button"
              className="px-2 py-1 text-lg rounded-lg hover:bg-white/10"
              onClick={() => { onReact(state.msgId, emo); onClose(); }}
            >
              {emo}
            </button>
          ))}
          <button
            type="button"
            className="ml-1 px-2 py-1 text-sm rounded-lg border border-white/15 hover:bg-white/10 navigator.vibrate?.(10)"
            onClick={() => setShowPicker(true)}
            aria-label={t('actions.moreEmojis')}
            title={t('actions.moreEmojis')}
          >
            …
          </button>
        </div>

        <div className="mt-2 border-t border-white/10 pt-2 flex gap-2">
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg bg-[var(--purple)]/90 text-white hover:opacity-95"
            onClick={() => { onReply(state.msgId); onClose(); }}
          >
            {t('actions.reply')}
          </button>
        </div>
        <EmojiPickerSheet
        open={showPicker}
        onClose={() => setShowPicker(false)}
        onPick={(e) => { onReact(state.msgId, e); setShowPicker(false); onClose(); }}
      />
      </div>
    </div>
  );
}

const EMOJI_ALL = [
  // häufige Reactions + viele Alternativen
  '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎',
  '👍','👎','👏','🙌','🙏','🤝','💪','🫶','👌','👀',
  '😂','🤣','😅','😊','😉','😍','🥰','😘','🤗','😮','😯','😲','🤯',
  '😐','😑','😶','🙄','😴','🥱','🤤','😔','😕','😢','😭','😡','🤬','😤',
  '🔥','💯','✨','🎉','🥳','💥','🌟','🫠','🤡','🤪','😈','👻','💀','⚡',
];

function EmojiPickerSheet({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  const t = useTranslations('chat.chatThread');
  const [q, setQ] = React.useState('');
  const [recent, setRecent] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    try {
      const raw = localStorage.getItem('rx.recent');
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, [open]);

  const saveRecent = (e: string) => {
    try {
      const next = [e, ...recent.filter((x) => x !== e)].slice(0, 18);
      setRecent(next);
      localStorage.setItem('rx.recent', JSON.stringify(next));
    } catch {}
  };

  const pick = (e: string) => { saveRecent(e); onPick(e); };

  const list = React.useMemo(() => {
    const term = q.trim();
    if (!term) return EMOJI_ALL;
    // „Suche“ ist simpel: enthält alle Codepoints, die als Text vorkommen
    return EMOJI_ALL.filter(e => e.includes(term));
  }, [q]);

  React.useEffect(() => {
    const onEsc = (ev: KeyboardEvent) => ev.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2147483640]"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Bottom Sheet */}
      <div
        className="absolute inset-x-0 bottom-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto w-[min(720px,100vw)] rounded-t-2xl border border-white/12 border-b-0 bg-[#0b0b0d] p-3 shadow-2xl">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/15" />

          {/* Suche */}
          <div className="flex items-center gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('emoji.searchPlaceholder')}
              className="flex-1 h-10 rounded-xl bg-white/[.06] border border-white/10 px-3 outline-none"
            />
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-3 rounded-xl border border-white/15 hover:bg-white/10"
            >
              {t('emoji.close')}
            </button>
          </div>

          {/* Kürzlich benutzt */}
          {recent.length > 0 && (
            <>
              <div className="mt-3 mb-1 text-[12px] text-white/70">{t('emoji.recent')}</div>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((e) => (
                  <button
                    key={e}
                    className="h-10 w-10 grid place-items-center rounded-lg hover:bg-white/10 text-xl"
                    onClick={() => pick(e)}
                    title={e}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Grid */}
          <div className="mt-3 mb-1 text-[12px] text-white/70">{t('emoji.sheetTitle')}</div>
          <div
            className="grid max-h-[48vh] overflow-y-auto pr-1
                       grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-1.5"
          >
            {list.map((e) => (
              <button
                key={`${e}-${Math.random()}`}
                className="h-10 w-10 grid place-items-center rounded-lg hover:bg-white/10 text-xl"
                onClick={() => pick(e)}
                title={e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ------------------------- Page ------------------------- */
export default function ChatThreadPage() {
  
  const t = useTranslations('chat.chatThread');
  const tVerify = useTranslations('verify');
  const { id } = useParams<{ id: string }>();
  const { kind, baseUrl, meta } = useChatMetaBaseUrl(String(id));
  const searchParams = useSearchParams();
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;
  const [replyTarget, setReplyTarget] = React.useState<ReplyTargetLite | null>(null);

  const startAgeVerification = React.useCallback(async () => {
    try {
      const back = `/${locale}/chat/${id}`;
      if (!session) {
        router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }
      const res = await fetch(
        `/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`,
        { method: 'POST' }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.url) throw new Error(j?.details || j?.error || `HTTP ${res.status}`);
      router.push(j.url as string);
    } catch {
      toast.error('Die Verifikation konnte nicht gestartet werden.', 'Fehler');
    }
  }, [id, locale, router, session]);

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
    // 🟣 neu:
    isFirstAdopter?: boolean;
    premiumUntil?: string | null;
  } | null>(null);

  const [viewerHasBlocked, setViewerHasBlocked] = React.useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = React.useState(false);

  const [messages, setMessages] = React.useState<UiMessage[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const [otherTyping, setOtherTyping] = React.useState(false);

  const [olderCursor, setOlderCursor] = React.useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = React.useState(false);
  const [hasMoreOlder, setHasMoreOlder] = React.useState(true);

  const [newestCursor, setNewestCursor] = React.useState<string | null>(null);

  const [tipOpen, setTipOpen] = React.useState(false);
  const [accept, setAccept] = React.useState<{
    amountCents: number;
    currency: string;
    toUserId: string;
    toDisplayName: string;
    toAvatarUrl?: string;
  } | null>(null);

  const [adAccept, setAdAccept] = React.useState<{
    amountCents: number;
    currency: string;
    cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    toUserId: string;
    toDisplayName: string;
    toAvatarUrl?: string;
  } | null>(null);

    React.useEffect(() => {
    if (kind === 'group') {
        const ev = new CustomEvent('chat:thread-opened', {
        detail: { conversationId: String(id), userId: null },
        });
        window.dispatchEvent(ev);
        return;
    }
    if (other) {
        const ev = new CustomEvent('chat:thread-opened', {
        detail: { conversationId: String(id), userId: other.id },
        });
        window.dispatchEvent(ev);
    }
    }, [id, kind, other]);

  const didMarkReadRef = React.useRef(false);
  React.useEffect(() => {
    if (didMarkReadRef.current || !baseUrl) return;
    if (kind === 'dm') {
    if (!other) return;
    didMarkReadRef.current = true;
    void fetch(`${baseUrl}/read`, { method: 'POST' });
    } else {
    // group: kein read-tracking → nichts tun
    didMarkReadRef.current = true;
    }
    }, [baseUrl, kind, other]);

  const [ownToAccept, setOwnToAccept] = React.useState<OwnershipReqPayload | null>(null);

  const mapRole = React.useCallback((r: DbRole): 'domme' | 'submissive' => (r === 'DOMME' ? 'domme' : 'submissive'), []);

  /* ========= (3) Anti-Race: letzte Request-ID merken ========= */
  const latestReqRef = React.useRef(0);

  /* ========= (2) load nur von stabilen Dingen abhängig ========= */
  const load = React.useCallback(async () => {
    if (!baseUrl) return;
    const myReq = ++latestReqRef.current; // start: meine Request-Nummer
    try {
      setError(null);
      const res = await fetch(`${baseUrl}`, { cache: 'no-store' });
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Unexpected response (${res.status}). ${txt ? txt.slice(0, 140) : 'Empty body'}`);
      }

      const json: ThreadResponse = await res.json();
      if (myReq !== latestReqRef.current) return; // älterer Response -> ignorieren
      if (!json.ok) throw new Error(json.error || 'Failed to load');

      setOtherTyping(prev =>
        prev === (json.ok ? (json.otherTyping ?? false) : false)
          ? prev
          : (json.ok ? (json.otherTyping ?? false) : false)
      );

      /* ========= (5) State-Updates nur bei Änderungen ========= */
      setMeId(prev => (prev === json.me.id ? prev : json.me.id));
      setMeRole((p) => {
        const roleRaw = (json)?.me?.role as DbRole | undefined; // Group: evtl. undefined
        const next = roleRaw ? mapRole(roleRaw) : (p ?? 'submissive'); // Fallback: behalte p oder 'submissive'
        return p === next ? p : next;
        });
      setMeAvatarUrl(prev => {
        const next = (json as ThreadOk).me.avatarUrl ?? null;
        return prev === next ? prev : next;
      });
      setViewerHasBlocked(json.viewerHasBlocked ?? false);
      setIsBlockedByOther(json.isBlockedByOther ?? false);

      const disabled = (json.viewerHasBlocked ?? false) || (json.isBlockedByOther ?? false);

      if (kind === 'dm') {
        setOther(prev => {
            const o = (json as ThreadOk).other;
            if (!o) return prev ?? null; // defensiv für Edge-Cases
            const next = {
            id: o.id,
            username: o.handle,
            displayName: o.displayName,
            avatarUrl: o.avatarUrl ?? undefined,
            role: mapRole(o.role),
            dmOpen: !disabled,
            isFirstAdopter: !!o.isFirstAdopter,
            premiumUntil: o.premiumUntil ?? null,
            };
            return (prev &&
            prev.id === next.id &&
            prev.username === next.username &&
            prev.displayName === next.displayName &&
            prev.avatarUrl === next.avatarUrl &&
            prev.role === next.role &&
            prev.dmOpen === next.dmOpen &&
            prev.isFirstAdopter === next.isFirstAdopter &&
            prev.premiumUntil === next.premiumUntil)
            ? prev
            : next;
        });
        } else {
        // GROUP: niemals auf json.other zugreifen
        setOther(null);
        }

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

      setMessages(prev => stableMergeMessages(prev, mapped));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (myReq === latestReqRef.current) setLoading(false); // nur mein jüngster Request darf loading schließen
    }
  }, [id, baseUrl, kind, mapRole]);

        const composerReady  = (kind === 'group' ? !!meId : !!other); // Composer darf senden, sobald Identität klar ist
        const placeholderOther = {
          id: 'loading',
          username: '...',
          displayName: '…',
          avatarUrl: undefined as string | undefined,
          role: 'submissive' as const,
          dmOpen: false,
          // 🟣 neu:
          isFirstAdopter: false,
          premiumUntil: null,
        };

  // NEW: super-schnelle Erstladung
  const loadFastFirstPaint = React.useCallback(async () => {
    if (!baseUrl) return;
    const myReq = ++latestReqRef.current;
    try {
      const res = await fetch(`${baseUrl}?latest=1&take=30`, { cache: 'no-store' });
      const json: ThreadResponse & { cursors?: { older: string | null; newest: string | null } } = await res.json();
      if (myReq !== latestReqRef.current) return;
      if (!json.ok) throw new Error(json.error || 'Failed to load');

      setOtherTyping(prev =>
        prev === (json.ok ? (json.otherTyping ?? false) : false)
          ? prev
          : (json.ok ? (json.otherTyping ?? false) : false)
      );

      // dieselben State-Updates wie in load(), nur ohne Reads/Extras
      setMeId((p) => (p === json.me.id ? p : json.me.id));
      setMeRole((p) => {
        const roleRaw = (json)?.me?.role as DbRole | undefined; // kann fehlen
        const next = roleRaw ? mapRole(roleRaw) : (p ?? 'submissive');
        return p === next ? p : next;
        });
      setMeAvatarUrl((p) => {
        const next = (json as ThreadOk).me.avatarUrl ?? null;
        return p === next ? p : next;
      });
      setViewerHasBlocked(json.viewerHasBlocked ?? false);
      setIsBlockedByOther(json.isBlockedByOther ?? false);
      if (kind === 'dm') {
        setOther(prev => {
            const o = (json as ThreadOk).other;
            if (!o) return prev ?? null;
            const next = {
            id: o.id,
            username: o.handle,
            displayName: o.displayName,
            avatarUrl: o.avatarUrl ?? undefined,
            role: mapRole(o.role),
            dmOpen: !(json.viewerHasBlocked || json.isBlockedByOther),
            isFirstAdopter: !!o.isFirstAdopter,
            premiumUntil: o.premiumUntil ?? null,
            };
            return (prev &&
            prev.id === next.id &&
            prev.username === next.username &&
            prev.displayName === next.displayName &&
            prev.avatarUrl === next.avatarUrl &&
            prev.role === next.role &&
            prev.dmOpen === next.dmOpen &&
            prev.isFirstAdopter === next.isFirstAdopter &&
            prev.premiumUntil === next.premiumUntil)
            ? prev
            : next;
        });
        } else {
        setOther(null);
        }
      const mapped: UiMessage[] = (json as ThreadOk).messages.map((m) => ({
        id: m.id, convoId: String(id), senderId: m.authorId,
        text: m.text ?? (m.mediaUrl ? '' : ''), createdAt: m.at, seen: m.read,
        mediaUrl: m.mediaUrl ?? undefined, mediaType: m.mediaType ?? undefined,
      }));
      setMessages((prev) => stableMergeMessages(prev, mapped));

      setOlderCursor(json.cursors?.older ?? null);
      setNewestCursor(
        json.cursors?.newest ??
        (mapped.length
          ? `${new Date(mapped[mapped.length - 1].createdAt).getTime()}_${mapped[mapped.length - 1].id}`
          : null)
      );
      setHasMoreOlder(Boolean(json.cursors?.older));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      if (myReq === latestReqRef.current) setLoading(false);
      void load();
    }
  }, [id, baseUrl, kind, load, mapRole]);

  const beginReplyTo = React.useCallback((msgId: string) => {
    const target = messages.find(x => x.id === msgId);
    if (!target) {
      setReplyTarget(null);
      return;
    }
    const authorName =
      target.senderId === meId ? t('you') : (other?.displayName ?? 'User');
    const previewText = target.mediaUrl ? undefined : (target.text ?? '');
    setReplyTarget({ id: msgId, authorName, text: previewText });
  }, [messages, meId, other, t]);

  React.useEffect(() => {
    if (kind === 'group') {
        const ev = new CustomEvent('chat:thread-opened', {
        detail: { conversationId: String(id), userId: null },
        });
        window.dispatchEvent(ev);
        return;
    }
    if (other) {
        const ev = new CustomEvent('chat:thread-opened', {
        detail: { conversationId: String(id), userId: other.id },
        });
        window.dispatchEvent(ev);
    }
    }, [id, kind, other]);

  const [stickBottom, setStickBottom] = React.useState(true);
  const scrollToBottom = React.useCallback((behavior: ScrollBehavior = 'auto') => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);
    
  const loadNewerSince = React.useCallback(async () => {
    if (!baseUrl || !newestCursor) return;
    try {
      const r = await fetch(`${baseUrl}?since=${encodeURIComponent(newestCursor)}&take=50`, { cache: 'no-store' });
      const j: ThreadResponse = await r.json();
      if (!j.ok) throw new Error(j.error || 'poll failed');

      const mapped: UiMessage[] = (j as ThreadOk).messages.map((m) => ({
        id: m.id, convoId: String(id), senderId: m.authorId,
        text: m.text ?? (m.mediaUrl ? '' : ''), createdAt: m.at, seen: m.read,
        mediaUrl: m.mediaUrl ?? undefined, mediaType: m.mediaType ?? undefined,
      }));
      if (!mapped.length) return;

      setMessages(prev => appendUnique(prev, mapped));

      const last = mapped[mapped.length - 1];
      setNewestCursor(`${new Date(last.createdAt).getTime()}_${last.id}`);

      if (stickBottom) scrollToBottom('smooth');
    } catch {}
  }, [baseUrl, id, newestCursor, stickBottom, scrollToBottom]);

  /* ========= (4) Polling stabil halten + Visibility beachten ========= */
  React.useEffect(() => {
    if (!baseUrl) return; 
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadFastFirstPaint(); // macht initial latest=1 und setzt newestCursor
    })();
    // ▼▼▼ NEU: Polling nur "since"
    const tick = () => { if (!document.hidden) void loadNewerSince(); };
    const tmr = setInterval(tick, 4000);
    return () => {
      cancelled = true;
      clearInterval(tmr);
    };
  }, [baseUrl, loadFastFirstPaint, loadNewerSince]);

  const scrollerRef = React.useRef<HTMLDivElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);


  // Beim ersten Render nach dem Laden ganz nach unten
  React.useLayoutEffect(() => {
    if (!loading) scrollToBottom('auto');
  }, [loading, scrollToBottom]);

  // Bei neuen Nachrichten nur nach unten scrollen, wenn der User „unten“ ist
  const prevLenRef = React.useRef(0);
  React.useLayoutEffect(() => {
    const len = messages.length;
    if (len !== prevLenRef.current) {
      if (stickBottom) scrollToBottom('smooth');
      prevLenRef.current = len;
    }
  }, [messages.length, stickBottom, scrollToBottom]);

  React.useEffect(() => {
    if (!listRef.current) return;
    const ro = new ResizeObserver(() => {
      if (stickBottom) scrollToBottom('auto');
    });
    ro.observe(listRef.current);
    return () => ro.disconnect();
  }, [stickBottom, scrollToBottom]);

  const sendMessage = React.useCallback(
    async ({ text, file }: { text: string; file?: File }) => {
      if (viewerHasBlocked || isBlockedByOther || !baseUrl || !meId) return;

      const trimmedText = text.trim();
      if (!trimmedText && !file) return;

      // ✅ Optimistische Nachricht erstellen
      const optimisticId = `opt-${Date.now()}-${Math.random()}`;
      const optimisticMsg: UiMessage = {
        id: optimisticId,
        convoId: String(id),
        senderId: meId,
        text: trimmedText,
        createdAt: new Date().toISOString(),
        seen: false,
        mediaUrl: file ? URL.createObjectURL(file) : undefined,
        mediaType: file?.type,
        optimistic: true,
        pending: true,
      };

      // ✅ Sofort zur UI hinzufügen
      setMessages(prev => [...prev, optimisticMsg]);

      // Scroll to bottom
      requestAnimationFrame(() => {
        scrollToBottom('smooth');
      });

      try {
        // Netzwerk-Request
        if (file) {
          const pre = await fetch(`/api/chat/upload-urls`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              conversationId: String(id),
              files: [{ name: file.name, type: file.type || 'application/octet-stream' }],
            }),
          });
          if (!pre.ok) throw new Error('Failed to presign');
          const pj = await pre.json();
          const item = pj?.items?.[0];
          if (!item?.uploadUrl || !item?.key) throw new Error('Invalid presign');

          const put = await fetch(item.uploadUrl, {
            method: 'PUT',
            headers: { 'content-type': file.type || 'application/octet-stream' },
            body: file,
          });
          if (!put.ok) throw new Error('Upload failed');

          await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              text: trimmedText,
              mediaKey: item.key,
              mediaType: file.type || 'application/octet-stream',
            }),
          });
        } else {
          await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: trimmedText }),
          });
        }

        // ✅ Erfolg: Als gesendet markieren
        setMessages(prev =>
          prev.map(m =>
            m.id === optimisticId
              ? { ...m, pending: false }
              : m
          )
        );

        // Echte Nachricht vom Server holen
        await load();

        // ✅ Optimistische Nachricht entfernen (Ersetzung durch echte)
        setMessages(prev => prev.filter(m => m.id !== optimisticId));

      } catch (err) {
        // ✅ Fehler: Als fehlgeschlagen markieren
        console.error('Failed to send message:', err);
        setMessages(prev =>
          prev.map(m =>
            m.id === optimisticId
              ? { ...m, pending: false, failed: true }
              : m
          )
        );
      }
    },
    [baseUrl, load, viewerHasBlocked, isBlockedByOther, scrollToBottom, meId, id]
  );

  const raf = () => new Promise<void>(r => requestAnimationFrame(() => r()));
  const pinAndSend = React.useCallback(async (text: string) => {
    setStickBottom(true);
    await raf();          
    await raf();
    scrollToBottom('auto');
    await sendMessage({ text });         
  }, [sendMessage, scrollToBottom]);


  const [actionSheet, setActionSheet] = React.useState<ActionSheetState>({
    open: false, x: 0, y: 0, msgId: '', mine: false,
  });



  

  const isNearBottom = React.useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return true;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    return dist < 80; // px
  }, []);

  const loadOlder = React.useCallback(async () => {
    if (!baseUrl || loadingOlder || !hasMoreOlder || !olderCursor) return;
    setLoadingOlder(true);
    const el = scrollerRef.current;
    const prevH = el ? el.scrollHeight : 0;

    try {
      const r = await fetch(`${baseUrl}?before=${encodeURIComponent(olderCursor)}&take=30`, { cache: 'no-store' });
      const j: ThreadResponse & { cursors?: { older: string | null } } = await r.json();
      if (!j.ok) throw new Error(j.error || 'load older failed');

      const mapped: UiMessage[] = (j as ThreadOk).messages.map((m) => ({
        id: m.id, convoId: String(id), senderId: m.authorId,
        text: m.text ?? (m.mediaUrl ? '' : ''), createdAt: m.at, seen: m.read,
        mediaUrl: m.mediaUrl ?? undefined, mediaType: m.mediaType ?? undefined,
      }));

      // Prepend und stabil mergen
      setMessages(prev => prependUnique(prev, mapped));

      setOlderCursor(j.cursors?.older ?? null);
      setHasMoreOlder(Boolean(j.cursors?.older));

      // Scroll-Offset kompensieren
      requestAnimationFrame(() => {
        const nowH = el ? el.scrollHeight : 0;
        if (el) el.scrollTop += (nowH - prevH);
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [baseUrl, id, loadingOlder, hasMoreOlder, olderCursor]);

  const onScrollList = React.useCallback(() => {
    const nearBottom = isNearBottom();
    setStickBottom(nearBottom);

    const el = scrollerRef.current;
    if (!el) return;
    if (el.scrollTop <= 80) {
      void loadOlder();
    }
  }, [isNearBottom, loadOlder]);

  // welche Reaktion habe ICH aktuell auf msgId?
  const getMyReactionFor = React.useCallback((msgId: string): string | null => {
    if (!meId) return null;
    let current: string | null = null;
    for (const m of messages) {
      const rx = parseReaction(m.text);
      if (!rx) continue;
      if (rx.to !== msgId) continue;
      if (m.senderId !== meId) continue;

      const op = rx.op === 'remove' ? 'remove' : 'add';
      if (op === 'add') {
        current = rx.emoji;           // letzte gesetzte Emoji-Marke
      } else if (op === 'remove' && current === rx.emoji) {
        current = null;               // abgewählt
      }
    }
    return current;
  }, [messages, meId]);


  const handleReact = React.useCallback(async (msgId: string, emoji: string) => {
    try {
      const mine = getMyReactionFor(msgId);

      if (mine === emoji) {
        // gleiches Emoji erneut -> entfernen (toggle off)
        await sendMessage({
          text: `${REACT_PREFIX}${JSON.stringify({ to: msgId, emoji, op: 'remove' })}`,
        });
      } else {
        // anderes Emoji gewählt:
        if (mine) {
          // erst altes entfernen
          await sendMessage({
            text: `${REACT_PREFIX}${JSON.stringify({ to: msgId, emoji: mine, op: 'remove' })}`,
          });
        }
        // dann neues hinzufügen
        await sendMessage({
          text: `${REACT_PREFIX}${JSON.stringify({ to: msgId, emoji, op: 'add' })}`,
        });
      }

      navigator.vibrate?.(10);
      await load();
    } catch {
      // optional: toast.error('Reaktion fehlgeschlagen');
    }
  }, [getMyReactionFor, sendMessage, load]);



  const openActionsAt = React.useCallback((
    e: React.PointerEvent | React.MouseEvent,
    msgId: string,
    mine: boolean
  ) => {
    const pt = 'clientX' in e ? { x: e.clientX, y: e.clientY } : { x: 0, y: 0 };
    setActionSheet({ open: true, x: pt.x, y: pt.y, msgId, mine });
  }, []);

  // --------- Einmaliges Senden von ?text= beim ersten Laden ---------
  const didInjectRef = React.useRef(false);
  React.useEffect(() => {
    if (didInjectRef.current) return;
    if (!baseUrl) return;
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
  }, [baseUrl, searchParams, viewerHasBlocked, isBlockedByOther, sendMessage]);

  const disabled = viewerHasBlocked || isBlockedByOther;
  const disabledNotice = disabled
    ? isBlockedByOther
      ? t('disabled.byOther')
      : t('disabled.youBlocked')
    : undefined;

  const cadenceLabel = (c: AutoDrainReqPayload['cadence']) =>
    c === 'DAILY' ? t('envelopes.autodrainRequest.cadence.daily')
      : c === 'WEEKLY' ? t('envelopes.autodrainRequest.cadence.weekly')
      : t('envelopes.autodrainRequest.cadence.monthly');

  /* ---- Reactions aggregieren (aus REACT:: Envelopes) ---- */
  type ReactionSummary = Record<string, { count: number; by: Set<string> }>;
  const reactionsByMsg = React.useMemo(() => {
    const map = new Map<string, ReactionSummary>();
    for (const m of messages) {
      const rx = parseReaction(m.text);
      if (!rx) continue;
      const key = rx.to;
      if (!map.has(key)) map.set(key, {});
      const summary = map.get(key)!;
      const emoji = rx.emoji;
      if (!summary[emoji]) summary[emoji] = { count: 0, by: new Set() };
      const entry = summary[emoji];
      const actor = m.senderId;
      const op = rx.op === 'remove' ? 'remove' : 'add';
      if (op === 'add') {
        if (!entry.by.has(actor)) {
          entry.by.add(actor);
          entry.count = entry.by.size;
        }
      } else {
        if (entry.by.has(actor)) {
          entry.by.delete(actor);
          entry.count = entry.by.size;
        }
      }
    }
    return map;
  }, [messages]);

  // kompakter Schlüssel damit MessageItem rerendert, wenn sich Reaktionen ändern
  const reactionDigestByMsg = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const [msgId, summary] of reactionsByMsg.entries()) {
      // sortiert für stabile Reihenfolge
      const parts = Object.entries(summary)
        .filter(([, v]) => v.count > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([emoji, v]) => `${emoji}:${v.count}`)
        .join('|');
      map.set(msgId, parts); // z.B. "❤️:2|😂:1"
    }
    return map;
  }, [reactionsByMsg]);


  if (!loading && error) {
    return (
      <main className="mx-auto px-3 py-6" style={{ maxWidth: 760 }}>
        {error}
      </main>
    );
  }

  /* ---- Message Item ---- */
  const MessageItem = React.memo(function MessageItem({
    m,
    rxKey,
  }: {
    m: UiMessage;
    rxKey: string;
  }) {
    const mine = meId ? m.senderId === meId : false;
    React.useDebugValue(rxKey);

    const longPress = useLongPress(
      (e) => openActionsAt(e, m.id, mine),
      { delay: 420 }
    );

    // --- REACTION EVENT: nicht rendern (nur fürs Zählen nutzen) ---
    if (parseReaction(m.text)) return null;

    // Corner-Badges
    function ReactionsCorner({
      mine,
      summary,
    }: {
      mine: boolean;
      summary?: Record<string, { count: number; by: Set<string> }>;
    }) {
      if (!summary) return null;
      const items = Object.entries(summary).filter(([, v]) => v.count > 0);
      if (!items.length) return null;

      return (
        <div
          className={[
            'absolute -bottom-1 flex gap-1',
            mine ? 'left-2' : 'right-2',
          ].join(' ')}
        >
          {items.map(([emoji, v]) => (
            <div
              key={emoji}
              className="px-1.5 py-[2px] text-[11px] rounded-full border border-white/15 bg-white/10 backdrop-blur"
            >
              {emoji} {v.count}
            </div>
          ))}
        </div>
      );
    }

    /* ---------------- REPLY ---------------- */
    const reply = parseReply(m.text);
    if (reply) {
      const target = messages.find((x) => x.id === reply.to);
      const bubbleCls = mine
        ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white'
        : 'bg-white/[.07] border-white/10';
      const reactions = reactionsByMsg.get(m.id);
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="relative max-w-[75%] w-fit pb-5">
            <div
              className={`inline-block rounded-2xl px-3 py-2 border break-words ${bubbleCls}`}
              title={new Date(m.createdAt).toLocaleString()}
              {...longPress}
              onClick={(e) => {
                const el = e.target as HTMLElement;
                if (el.closest('a,button,video,audio,img')) e.stopPropagation();
              }}
            >
              <QuotedPreview target={target} mine={mine} locale={locale} />
              <RichText
                text={reply.text}
                locale={locale}
                validateMentions
                className="break-words"
                variant={mine ? 'chat' : 'default'}
              />
              <div className={`text-[11px] mt-1 opacity-80 ${mine ? 'text-white/80' : 'text-white/70'}`}>
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <ReactionsCorner mine={mine} summary={reactions} />
          </div>
        </div>
      );
    }

    /* --------------- OWNERSHIP REQUEST --------------- */
    const ownReq = parseOwnReq(m.text);
    if (ownReq) {
      const canAct = !mine && meRole === 'submissive';
      const bubble = 'bg-white/[.07] border-white/10';
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[75%] rounded-2xl px-3 py-2 border ${bubble}`}
            {...longPress}
            onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('a,button,video,audio,img')) e.stopPropagation();
            }}
          >
            <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">
              {t('envelopes.ownershipRequest.title', { default: 'Ownership-Anfrage' })}
            </div>

            {isLegacyDataUrls(ownReq) && ownReq.bio && (
              <div className="text-[13px] text-white/80 whitespace-pre-wrap mb-1">{ownReq.bio}</div>
            )}
            {isLegacyDataUrls(ownReq) && (ownReq.avatarDataUrl || ownReq.bannerDataUrl) && (
              <div className="text-[12px] text-white/60 italic">
                {ownReq.avatarDataUrl ? t('envelopes.ownershipRequest.legacy.avatarPreview') + ' ' : ''}
                {ownReq.bannerDataUrl ? t('envelopes.ownershipRequest.legacy.bannerPreview') : ''}
              </div>
            )}

            {canAct && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-[var(--purple)]/90 text-white hover:opacity-95"
                  onClick={() => setOwnToAccept(ownReq)}
                >
                  {t('actions.accept')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
                  onClick={() =>
                    void sendMessage({
                      text: t('envelopes.ownershipRequest.declinedMsg', { default: 'Abgelehnt.' }),
                    })
                  }
                >
                  {t('actions.decline')}
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

    /* --------------- OWNERSHIP ACCEPTED --------------- */
    const ownAcc = parseOwnAcc(m.text);
    if (ownAcc) {
      return (
        <div className="flex justify-center">
          <div className="text-[12px] text-white/70 px-3 py-1">
            {t('envelopes.ownershipAccepted.title', { default: 'Ownership akzeptiert.' })}
          </div>
        </div>
      );
    }

    /* ---------------- TIP REQUEST ---------------- */
    const req = parseTipRequest(m.text);
    if (req) {
        const isViewerSub = meRole === 'submissive';
        const canAct = kind === 'dm' && !mine && isViewerSub && !!other;
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div
            className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10"
            {...longPress}
            onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('a,button,video,audio,img')) e.stopPropagation();
            }}
          >
            <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">
              {t('envelopes.tipRequest.title')}
            </div>
            <div className="text-[15px] font-semibold">{fmtCurrency(req.amountCents, req.currency)}</div>
            {req.note && <div className="mt-1 text-[13px] text-white/80 whitespace-pre-wrap">{req.note}</div>}
            {canAct && other && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-[var(--purple)]/90 text-white hover:opacity-95"
                  onClick={() => {
                    setAccept({
                      amountCents: req.amountCents,
                      currency: req.currency,
                      toUserId: m.senderId,
                      toDisplayName: other.displayName,
                      toAvatarUrl: other.avatarUrl,
                    });
                  }}
                >
                  {t('actions.accept')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
                  onClick={() => void sendMessage({ text: t('envelopes.tipRequest.declinedMsg') })}
                >
                  {t('actions.decline')}
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

    /* ---------------- AUTODRAIN REQUEST ---------------- */
    const ad = parseAutoDrainReq(m.text);
    if (ad) {
      const canAct = kind === 'dm' && !mine && meRole === 'submissive' && !!other;
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div
            className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10"
            {...longPress}
            onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('a,button,video,audio,img')) e.stopPropagation();
            }}
          >
            <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">
              {t('envelopes.autodrainRequest.title')}
            </div>
            <div className="text-[15px] font-semibold">{fmtCurrency(ad.amountCents, ad.currency)}</div>
            <div className="text-[13px] text-white/80 mt-0.5">
              {t('envelopes.autodrainRequest.recurrenceLabel', { cadence: cadenceLabel(ad.cadence) })}
            </div>
            {canAct && other && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg bg-[var(--purple)]/90 text-white hover:opacity-95"
                  onClick={() =>
                    setAdAccept({
                      amountCents: ad.amountCents,
                      currency: ad.currency,
                      cadence: ad.cadence,
                      toUserId: m.senderId,
                      toDisplayName: other.displayName,
                      toAvatarUrl: other.avatarUrl,
                    })
                  }
                >
                  {t('actions.accept')}
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10"
                  onClick={() => void sendMessage({ text: t('envelopes.autodrainRequest.declinedMsg') })}
                >
                  {t('actions.decline')}
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

    /* ---------------- AUTODRAIN ACCEPTED ---------------- */
    const adAcc = parseAutoDrainAcc(m.text);
    if (adAcc) {
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/70 mb-1">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 12.5l2.5 2.5 4.5-5" />
              </svg>
              <span>{t('envelopes.autodrainEnabled.title')}</span>
              {adAcc.id && <span className="text-white/50 normal-case ml-1">#{String(adAcc.id).slice(0, 6)}</span>}
            </div>
            <div className="text-[15px] font-semibold">{fmtCurrency(adAcc.amountCents, adAcc.currency)}</div>
            <div className="mt-1 text-[13px] text-white/80">
              {t('envelopes.autodrainRequest.recurrenceLabel', { cadence: cadenceLabel(adAcc.cadence) })}
            </div>
            <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      );
    }

    /* ---------------- TIP PAID ---------------- */
    const paid = parseTipPaid(m.text);
    if (paid) {
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/70 mb-1">
              <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="9" />
                <path d="M8.5 12.5l2.5 2.5 4.5-5" />
              </svg>
              <span>{t('envelopes.tipPaid.title')}</span>
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

    /* ---------------- MEDIA (Image/Video) ---------------- */
    if (m.mediaUrl && (isImage(m.mediaUrl, m.mediaType) || isVideo(m.mediaUrl, m.mediaType))) {
      const reactions = reactionsByMsg.get(m.id);
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="relative inline-block pb-5" {...longPress}>
            {!ageOk ? (
              <ChatBlurredMediaGate
                mediaUrl={isImage(m.mediaUrl, m.mediaType) ? m.mediaUrl : undefined}
                onStartVeriff={startAgeVerification}
                title={tVerify('modal.title')}
                subtitle={tVerify('modal.message')}
                cta={tVerify('modal.confirm')}
              />
            ) : isVideo(m.mediaUrl, m.mediaType) ? (
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

            <ReactionsCorner mine={mine} summary={reactions} />
          </div>
        </div>
      );
    }

    /* ---------------- AUDIO ---------------- */
    if (m.mediaUrl && isAudio(m.mediaUrl, m.mediaType)) {
      const reactions = reactionsByMsg.get(m.id);
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="relative inline-block pb-5 w-full max-w-[75vw] md:max-w-[560px]" {...longPress}>
            <AudioBubble src={m.mediaUrl} mine={mine} avatarUrl={mine ? meAvatarUrl : other?.avatarUrl} />
            {m.text && (
              <div className={`mt-1 ${mine ? 'text-white' : 'text-white/90'}`}>
                <RichText text={m.text} locale={locale} validateMentions variant={mine ? 'chat' : 'default'} />
              </div>
            )}

            <div className="text-[11px] mt-1 text-white/60 text-right">
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>

            <ReactionsCorner mine={mine} summary={reactions} />
          </div>
        </div>
      );
    }

    /* ---------------- INVITE LINK PREVIEW ---------------- */
    const inv = parseInviteLink(m.text);
    if (inv) {
      const note = (m.text || '').replace(inv.url, '').trim();
      const reactions = reactionsByMsg.get(m.id);
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="relative inline-block pb-5" {...longPress}>
            <InviteLinkPreview code={inv.code} href={inv.url} />
            {note && (
              <div className={`mt-1 text-[13px] ${mine ? 'text-white/90' : 'text-white/80'}`}>
                <RichText text={note} locale={locale} validateMentions variant={mine ? 'chat' : 'default'} />
              </div>
            )}
            <div className="text-[11px] mt-1 text-white/60 text-right" title={new Date(m.createdAt).toLocaleString()}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <ReactionsCorner mine={mine} summary={reactions} />
          </div>
        </div>
      );
    }

    /* ---------------- POST LINK PREVIEW ---------------- */
    const link = parsePostLink(m.text);
    if (link && (!m.text || m.text.trim() === link.url.trim())) {
      const reactions = reactionsByMsg.get(m.id);
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="relative inline-block pb-5" {...longPress}>
            <PostLinkPreview postId={link.id} locale={locale} />
            <div className="text-[11px] mt-1 text-white/60 text-right" title={new Date(m.createdAt).toLocaleString()}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <ReactionsCorner mine={mine} summary={reactions} />
          </div>
        </div>
      );
    }

    /* ---------------- PROFILE LINK PREVIEW ---------------- */
    const pLink = parseProfileLink(m.text);
    if (pLink && (!m.text || m.text.trim() === pLink.url.trim())) {
      const reactions = reactionsByMsg.get(m.id);
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="relative inline-block pb-5" {...longPress}>
            <ProfileLinkPreview handle={pLink.handle} locale={locale} />
            <div className="text-[11px] mt-1 text-white/60 text-right" title={new Date(m.createdAt).toLocaleString()}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <ReactionsCorner mine={mine} summary={reactions} />
          </div>
        </div>
      );
    }

    /* ---------------- COMMUNITY LINK PREVIEW ---------------- */
    const cLink = parseCommunityLink(m.text);
    if (cLink && (!m.text || m.text.trim() === cLink.url.trim())) {
      const reactions = reactionsByMsg.get(m.id);
      return (
        <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
          <div className="relative inline-block pb-5" {...longPress}>
            <CommunityLinkPreview slug={cLink.slug} locale={locale} />
            <div className="text-[11px] mt-1 text-white/60 text-right" title={new Date(m.createdAt).toLocaleString()}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <ReactionsCorner mine={mine} summary={reactions} />
          </div>
        </div>
      );
    }

    /* ---------------- TEXT ---------------- */
    const mineBubble = mine
      ? 'bg-[var(--purple)]/90 border-[var(--purple)]/40 text-white'
      : 'bg-white/[.07] border-white/10';
    const reactions = reactionsByMsg.get(m.id);
    return (
      <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
        <div className="relative max-w-[75%] w-fit pb-5">
          <div
            className={`inline-block rounded-2xl px-3 py-2 border break-words ${mineBubble}`}
            title={new Date(m.createdAt).toLocaleString()}
            {...longPress}
            onClick={(e) => {
              const el = e.target as HTMLElement;
              if (el.closest('a,button,video,audio,img')) e.stopPropagation();
            }}
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
            {/* ✅ ERSETZE DIESE ZEILE: */}
            <div className={`text-[11px] mt-1 opacity-80 flex items-center gap-1 ${mine ? 'text-white/80' : 'text-white/70'}`}>
              {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              
              {/* ✅ NEU: Status-Indikatoren */}
              {mine && isOptimistic(m) && m.pending && (
                <span className="text-white/50" title="Wird gesendet...">⏳</span>
              )}
              {mine && isOptimistic(m) && m.failed && (
                <span className="text-red-400" title="Senden fehlgeschlagen">❌</span>
              )}
              {mine && isOptimistic(m) && !m.pending && !m.failed && (
                <span className="text-white/70" title="Gesendet">✓</span>
              )}
              {mine && !isOptimistic(m) && (
                <span className="text-white/70" title="Zugestellt">✓✓</span>
              )}
            </div>
          </div>
          <ReactionsCorner mine={mine} summary={reactions} />
        </div>
      </div>
    );
  },(prev, next) => {
      return prev.m === next.m && prev.rxKey === next.rxKey;
    });

  return (
    <>
      <ChatHeader
        other={kind === 'dm'
            ? (other ?? placeholderOther)
            : {
                id: String(id),
                username: '',
                displayName: meta?.ok ? (meta.title ?? 'Group') : 'Group',
                avatarUrl: undefined,
                role: 'submissive',
                dmOpen: false,
                isFirstAdopter: false,
                premiumUntil: null,
            }
        }
        viewerHasBlocked={viewerHasBlocked}
        isBlockedByOther={isBlockedByOther}
        loading={loading || (kind === 'dm' && !other)}
        />

      <main
        className="px-3"
        style={{ paddingTop: 'var(--chat-header-h, 64px)' }} // 👈 Platz für den fixen Header
      >
        <div className="mx-auto w-full max-w-[760px]">
          {/* Eigener Scroll-Container: füllt die Resthöhe zwischen Header & Bottomnav */}
          <div
            ref={scrollerRef}
            onScroll={onScrollList}
            className="overflow-y-auto overflow-x-hidden no-scrollbar"
            style={{
               height: 'calc(100vh - var(--chat-header-h, 48px) - var(--bottomnav-h, 72px) - 72px)',
                 scrollbarGutter: 'stable',     // reserviert Platz, falls OS doch eine Leiste einblendet
                 overscrollBehavior: 'contain', // verhindert „Gummiband“-Scroll der Seite
              paddingTop: 8,
              paddingBottom: 'calc(72px + var(--kb, 0px))',
            }}
          >
            {loading ? (
                <div className="space-y-2 pb-6">
                    {[1,2,3,4,5].map(i => (
                    <div key={i} className={`flex ${i % 2 ? 'justify-start' : 'justify-end'}`}>
                        <div className="max-w-[75%] w-fit">
                        <div className="rounded-2xl px-3 py-2 border border-white/10 bg-white/[.06]">
                            <div className="h-3 w-40 bg-white/10 rounded animate-pulse" />
                            <div className="mt-2 h-3 w-28 bg-white/10 rounded animate-pulse" />
                        </div>
                        </div>
                    </div>
                    ))}
                </div>
                ) : (
                <div ref={listRef} className="space-y-2 pb-6">
                  {loadingOlder && (
                    <div className="flex justify-center py-2 text-[12px] text-white/70">
                      {t('loadingOlder', { default: 'Older messages are being loaded…' })}
                    </div>
                  )}
                  {messages.map((m) => (
                    <MessageItem key={m.id} m={m} rxKey={reactionDigestByMsg.get(m.id) ?? ''} />
                  ))}
                  {otherTyping && other && (
                    <div className="flex justify-start">
                      <div className="max-w-[75%] w-fit">
                        <TypingDots mine={false} />
                      </div>
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </main>

      {/* Composer */}
      <ChatComposer
      // mode kannst du gleich drin lassen, dazu gleich mehr
      mode="dm"
      onTypingPing={async (active) => {
        if (!baseUrl) return;
        try {
          await fetch(`${baseUrl}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ typing: !!active }),
          });
        } catch {}
      }}
      viewerRole={meRole ?? 'submissive'}
      disabled={disabled || !composerReady}
      disabledNotice={disabled ? disabledNotice : (!composerReady ? t('loading') : undefined)}
      selfUserId={meId ?? ''}

      // ⬇️ HIER: immer ein string, nie undefined
      targetHandle={kind === 'dm' ? (other?.username ?? '') : ''}

      onSend={async (text) => {
        if (!composerReady) return;
        await pinAndSend(text);
      }}
      onTip={() => (composerReady ? setTipOpen(true) : undefined)}
      onUpload={(file, caption) =>
        composerReady ? sendMessage({ text: caption || '', file }) : undefined
      }
      replyTo={replyTarget}
      onCancelReply={() => setReplyTarget(null)}
      onCreateReply={async (p) => {
        if (!composerReady) return;
        setStickBottom(true);
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        );
        scrollToBottom('auto');
        await sendMessage({
          text: `${REPLY_PREFIX}${JSON.stringify({ to: p.to, text: p.text })}`,
        });
        setReplyTarget(null);
      }}
      onCreateTipRequest={async (p) => {
        if (!composerReady) return;
        const { amountCents, currency = 'EUR', note } = p;
        const payload = { amountCents, currency, note: note?.trim() || undefined };
        await sendMessage({ text: `${TIPREQ_PREFIX}${JSON.stringify(payload)}` });
      }}
      onCreateAutoDrainRequest={async (p) => {
        if (!composerReady) return;
        const { amountCents, currency = 'EUR', cadence } = p;
        const payload = { amountCents, currency, cadence };
        await sendMessage({ text: `${ADREQ_PREFIX}${JSON.stringify(payload)}` });
      }}
    />

      {/* Modals */}
      {kind === 'dm' && other && (
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
          }}
        />
      )}

      {kind === 'dm' && accept && other && (
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

      {kind === 'dm' && adAccept && other && (
        <AutoDrainRequestAcceptModal
          open={!!adAccept}
          onClose={() => setAdAccept(null)}
          amountCents={adAccept.amountCents}
          currency={adAccept.currency}
          cadence={adAccept.cadence}
          toUserId={adAccept.toUserId}
          toDisplayName={adAccept.toDisplayName}
          toAvatarUrl={adAccept.toAvatarUrl}
          conversationId={String(id)}
          onSuccess={({ autoDrainId, amountCents, currency, cadence }) => {
            const payload: AutoDrainAccPayload = { id: autoDrainId, amountCents, currency, cadence };
            void sendMessage({ text: `${ADACC_PREFIX}${JSON.stringify(payload)}` });
            setAdAccept(null);
          }}
          onDeclined={() => setAdAccept(null)}
        />
      )}

      {ownToAccept && (
        <OwnershipRequestAcceptModal
          open={!!ownToAccept}
          onClose={() => setOwnToAccept(null)}
          payload={ownToAccept}
          selfUserId={meId ?? undefined}
          onSuccess={async () => {
            await sendMessage({ text: `${OWNACC_PREFIX}{}` });
            setOwnToAccept(null);
            await load();
          }}
        />
      )}

      <ActionsPopover
        state={actionSheet}
        onClose={() => setActionSheet((s) => ({ ...s, open: false }))}
        onReply={(msgId) => { beginReplyTo(msgId); }}
        onReact={handleReact}
      />
    </>
  );
}
