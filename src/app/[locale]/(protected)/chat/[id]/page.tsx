// src/app/[locale]/chat/[id]/page.tsx
'use client';

import * as React from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import ChatHeader from '@/components/ChatHeader';
import ChatComposer from '@/components/ChatComposer';
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
  const isImg = mediaUrl ? (() => {
    const u = mediaUrl.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|webp|gif)$/i.test(u);
  })() : false;

  // Gemeinsamer, stabiler Wrapper: feste responsive Breite, runde Ecken, overflow hidden
  // Wir geben dem Container eine eigene Breite, damit Flex ihn nicht zusammenquetscht.
  const wrapperStyle: React.CSSProperties = { width: 'min(75vw, 560px)' };

  return (
    <div
      className="relative inline-block rounded-xl border border-white/10 overflow-hidden"
      data-no-nav
      style={wrapperStyle}
    >
      <div className="bg-black/20">
        {isImg && mediaUrl ? (
          // Bild: nimmt volle Breite ein, Höhe folgt dem Bild (max-h für Viewport)
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl}
            alt=""
            className="block w-full h-auto max-h-[60vh] object-cover"
            style={{ filter: 'blur(22px) saturate(.6) brightness(.7)' }}
            aria-hidden
          />
        ) : (
          // Video: Platzhalter mit stabiler Aspect Ratio (hier 16:9),
          // damit Layout/Overlay nicht kollabieren
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

      {/* Overlay */}
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
              Du wirst nach Abschluss automatisch zurückgeleitet.
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
  const t = useTranslations('common.chatThread');
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
  const t = useTranslations('common.chatThread');
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
  const t = useTranslations('common.chatThread');
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

/* ------------------------- Page ------------------------- */
export default function ChatThreadPage() {
  const t = useTranslations('common.chatThread');
  const tVerify = useTranslations('common.verify');
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;

  const startAgeVerification = React.useCallback(async () => {
    try {
      // Zurück in diesen Chat
      const back = `/${locale}/chat/${id}`;

      // Wenn nicht eingeloggt → Login mit Callback
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

  const [adAccept, setAdAccept] = React.useState<{
    amountCents: number;
    currency: string;
    cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY';
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
    if (!other) return;
    // Signalisiere BottomNav, welcher Thread offen ist
    const ev = new CustomEvent('chat:thread-opened', {
      detail: { conversationId: String(id), userId: other.id },
    });
    window.dispatchEvent(ev);
  }, [id, other]);


  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) await load();
    })();
    const tmr = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(tmr);
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

  // --------- Einmaliges Senden von ?text= beim ersten Laden ---------
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
      ? t('disabled.byOther')
      : t('disabled.youBlocked')
    : undefined;

  if (!loading && error) {
    return (
      <main className="mx-auto px-3 py-6" style={{ maxWidth: 760 }}>
        {error}
      </main>
    );
  }

  const cadenceLabel = (c: AutoDrainReqPayload['cadence']) =>
    c === 'DAILY' ? t('envelopes.autodrainRequest.cadence.daily')
      : c === 'WEEKLY' ? t('envelopes.autodrainRequest.cadence.weekly')
      : t('envelopes.autodrainRequest.cadence.monthly');

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
          className="mx-auto w-full max-w-[760px] overflow-x-hidden"
          style={{
            paddingTop: 'calc(var(--chat-header-h, 48px) + 8px)',
            paddingBottom: 'calc(var(--bottomnav-h, 72px) + 72px + var(--kb, 0px))',
          }}
        >
          {loading ? (
            <div className="py-8 text-sm text-muted">{t('loading')}</div>
          ) : (
            <div className="space-y-2 pb-24">
              {messages.map((m) => {
                const mine = meId ? m.senderId === meId : false;

                // --- TIP REQUEST ---
                const req = parseTipRequest(m.text);
                if (req) {
                  const isViewerSub = meRole === 'submissive';
                  const canAct = !mine && isViewerSub && !!other;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">{t('envelopes.tipRequest.title')}</div>
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

                // --- AUTODRAIN REQUEST ---
                const ad = parseAutoDrainReq(m.text);
                if (ad) {
                  const canAct = !mine && meRole === 'submissive' && !!other;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[75%] rounded-2xl px-3 py-2 border bg-white/[.07] border-white/10">
                        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">{t('envelopes.autodrainRequest.title')}</div>
                        <div className="text-[15px] font-semibold">{fmtCurrency(ad.amountCents, ad.currency)}</div>
                        <div className="text-[13px] text-white/80 mt-0.5">
                          {t('envelopes.autodrainRequest.recurrenceLabel', { cadence: cadenceLabel(ad.cadence) })}
                        </div>
                        {canAct && (
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
                                  toDisplayName: other!.displayName,
                                  toAvatarUrl: other!.avatarUrl,
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

                // --- AUTODRAIN ACCEPTED ---
                const adAcc = parseAutoDrainAcc(m.text);
                if (adAcc) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
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

                // --- TIP PAID ---
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

                // --- OWNERSHIP REQUEST ---
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
                        <div className="text-[11px] uppercase tracking-wide text-white/70 mb-1">{t('envelopes.ownershipRequest.title')}</div>
                        <ul className="text-[13px] text-white/80 space-y-1 mb-2">
                          {hasAvatar && <li>• {t('envelopes.ownershipRequest.items.avatar')}</li>}
                          {hasBanner && <li>• {t('envelopes.ownershipRequest.items.banner')}</li>}
                          {hasBio && <li>• {t('envelopes.ownershipRequest.items.bio')}</li>}
                        </ul>
                        {canAct && (
                          <div className="mt-1 flex items-center gap-2">
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
                              onClick={() => void sendMessage({ text: t('envelopes.ownershipRequest.declinedMsg') })}
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
                          <span>{t('envelopes.ownershipAccepted.title')}</span>
                        </div>
                        <div className="text-[13px] text-white/80">{t('envelopes.ownershipAccepted.applied')}</div>
                        <div className="text-[11px] mt-2 text-white/60" title={new Date(m.createdAt).toLocaleString()}>
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                }

                // Medien (Image/Video) – gated by age verification
                if (m.mediaUrl && (isImage(m.mediaUrl, m.mediaType) || isVideo(m.mediaUrl, m.mediaType))) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        {!ageOk ? (
                          <ChatBlurredMediaGate
                            mediaUrl={isImage(m.mediaUrl, m.mediaType) ? m.mediaUrl : undefined}
                            onStartVeriff={startAgeVerification}
                            title={tVerify('modal.title')}       // 🔹 gleicher Key wie in den anderen Stellen
                            subtitle={tVerify('modal.message')}  // 🔹 gleicher Key wie in den anderen Stellen
                            cta={tVerify('modal.confirm')}       // 🔹 gleicher Key wie in den anderen Stellen
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

                // --- INVITE LINK PREVIEW ---
                const inv = parseInviteLink(m.text);
                if (inv) {
                  const note = (m.text || '').replace(inv.url, '').trim();
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <InviteLinkPreview code={inv.code} href={inv.url} />
                        {note && (
                          <div className={`mt-1 text-[13px] ${mine ? 'text-white/90' : 'text-white/80'}`}>
                            <RichText text={note} locale={locale} validateMentions variant={mine ? 'chat' : 'default'} />
                          </div>
                        )}
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

                // Post-Link Preview
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

                // Profile-Link Preview
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

                // Community-Link Preview (NEW)
                const cLink = parseCommunityLink(m.text);
                if (cLink && (!m.text || m.text.trim() === cLink.url.trim())) {
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div>
                        <CommunityLinkPreview slug={cLink.slug} locale={locale} />
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
      {other && (
        <ChatComposer
          viewerRole={meRole ?? 'submissive'}
          disabled={disabled}
          disabledNotice={disabledNotice}
          selfUserId={meId ?? ''}
          targetHandle={other.username}
          onSend={(text) => sendMessage({ text })}
          onTip={() => setTipOpen(true)}
          onUpload={(file, caption) => sendMessage({ text: caption || '', file })}
          onCreateTipRequest={(p: { amountCents: number; currency?: string; note?: string }) => {
            const { amountCents, currency = 'EUR', note } = p;
            const payload = { amountCents, currency, note: note?.trim() || undefined };
            void sendMessage({ text: `${TIPREQ_PREFIX}${JSON.stringify(payload)}` });
          }}
          onCreateAutoDrainRequest={(p: { amountCents: number; currency?: string; cadence: 'DAILY' | 'WEEKLY' | 'MONTHLY' }) => {
            const { amountCents, currency = 'EUR', cadence } = p;
            const payload = { amountCents, currency, cadence };
            void sendMessage({ text: `${ADREQ_PREFIX}${JSON.stringify(payload)}` });
          }}
        />
      )}

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

      {adAccept && other && (
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
    </>
  );
}
