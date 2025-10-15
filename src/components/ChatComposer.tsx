// src/components/ChatComposer.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import MentionSuggestChat from '@/components/MentionSuggestChat';
import TipRequestCreateModal from '@/components/TipRequestCreateModal';
import OwnershipRequestCreateModal, {
  type OwnershipReqPayload as OwnReqPayload,
} from '@/components/OwnershipRequestCreateModal';
import AutoDrainRequestCreateModal, {
  type AutoDrainReqPayload as ADReqPayload,
} from '@/components/AutoDrainRequestCreateModal';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/toast';
import { useKeyboardInset } from '@/hooks/useKeyboardInset';

// 🆕 Reply envelope prefix (client-only)
const REPLY_PREFIX = 'REPLY::';

type RoleLike = 'domme' | 'submissive' | 'DOMME' | 'SUBMISSIVE';
type TipRequestPayload = { amountCents: number; note?: string; currency?: string };
type AutoDrainRequestPayload = ADReqPayload;

// 🆕: Lightweight reply target type for the composer UI
export type ReplyTargetLite = {
  id: string;
  authorName: string;
  text?: string | null;
};

type Props = {
  disabled?: boolean;
  disabledNotice?: string;
  viewerRole: RoleLike;
  selfUserId: string;
  targetHandle: string;
  onSend: (text: string) => void;
  onTip: () => void;
  onUpload?: (file: File, caption?: string) => void;
  onCreateTipRequest?: (payload: TipRequestPayload) => void;
  onCreateAutoDrainRequest?: (payload: AutoDrainRequestPayload) => void;
  onTypingPing?: (active: boolean) => void;

  // 🆕 Reply support (optional, non-breaking)
  replyTo?: ReplyTargetLite | null;
  onCancelReply?: () => void;
  onCreateReply?: (p: { to: string; text: string }) => void;
  onCreateReaction?: (p: { to: string; emoji: string; op?: 'add' | 'remove' }) => void;
};

function SendIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      aria-hidden
      fill="currentColor"
    >
      <path d="M59.83,12.17c1.12,1.12,1.47,2.79,0.9,4.27l-17,44c-0.59,1.52-2.07,2.54-3.7,2.56c-1.61,0-3.09-0.96-3.72-2.45l-3.699-8.788	c-0.737-1.75-0.601-3.745,0.365-5.38L40.64,33.41c0.79-1.33-0.72-2.84-2.05-2.05l-12.972,7.665c-1.635,0.966-3.63,1.101-5.38,0.364	L11.45,35.69C9.94,35.05,8.98,33.57,9,31.94s1.04-3.08,2.56-3.67l44-17C57.03,10.7,58.71,11.05,59.83,12.17z"></path>
    </svg>
  );
}


function TipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 50" fill="currentColor" aria-hidden {...props}>
      {/* um den Mittelpunkt (25,25) skalieren */}
      <g transform="translate(24 25) scale(1.45) translate(-25 -25)">
        <path d="M 24 14 L 24 16.1875 C 22.398438 16.386719 19.5 17.789063 19.5 21.1875 C 19.5 27.585938 28.8125 24.292969 28.8125 29.09375 C 28.8125 30.695313 28.101563 32.1875 25 32.1875 C 21.898438 32.1875 21 29.800781 21 28.5 L 19 28.5 C 19.300781 32.800781 22.300781 33.792969 24 34.09375 L 24 36 L 26 36 L 26 34.09375 C 27.5 33.992188 31 32.90625 31 28.90625 C 31 25.605469 28.289063 24.695313 25.6875 24.09375 C 23.585938 23.59375 21.6875 23.101563 21.6875 21 C 21.6875 20.101563 22.09375 18.09375 25.09375 18.09375 C 27.195313 18.09375 28.199219 19.398438 28.5 21 L 30.5 21 C 29.898438 18.800781 28.898438 16.8125 26 16.3125 L 26 14 Z" />
      </g>
    </svg>
  );
}

/* ---------- kleines Popover/ActionMenu via Portal ---------- */
function ActionMenu({
  anchorRect,
  onClose,
  children,
}: {
  anchorRect: DOMRect;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const recompute = React.useCallback(() => {
    const gap = 8;
    const margin = 8;
    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const width = Math.max(220, Math.min(320, anchorRect.width));

    let left = Math.round(anchorRect.left);
    left = Math.min(Math.max(margin, left), winW - width - margin);

    const spaceAbove = Math.max(0, anchorRect.top - margin);
    const spaceBelow = Math.max(0, winH - anchorRect.bottom - margin);
    let openUp = spaceAbove > spaceBelow;

    let top = openUp ? Math.round(anchorRect.top - gap) : Math.round(anchorRect.bottom + gap);

    const h = panelRef.current?.offsetHeight ?? 0;
    if (h > 0) {
      if (openUp && top - h < margin) {
        openUp = false;
        top = Math.round(anchorRect.bottom + gap);
      }
      if (!openUp && top + h > winH - margin) {
        if (spaceAbove >= h + gap) {
          openUp = true;
          top = Math.round(anchorRect.top - gap);
        } else {
          top = Math.max(margin, winH - margin - h);
        }
      }
    }

    setPos({ top, left, width, openUp });
  }, [anchorRect]);

  React.useLayoutEffect(() => { recompute(); }, [recompute]);

  React.useEffect(() => {
    const onOutside = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (panelRef.current && t && panelRef.current.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onOutside, { passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute);
    };
  }, [onClose, recompute]);

  if (!pos) return null;

  const style: React.CSSProperties = {
    position: 'fixed',
    left: pos.left,
    top: pos.top,
    width: pos.width,
    transform: pos.openUp ? 'translateY(-100%)' : undefined,
    zIndex: 2147483601,
  };

  const panel = (
    <div style={style}>
      <div ref={panelRef} className="rounded-xl border border-white/12 bg-black/90 backdrop-blur p-1 shadow-2xl">
        {children}
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}

// --- Verify Prompt (identisch zum Stil im ProfileHeader) ---
function VerifyPrompt({
  open,
  onClose,
  onStart,
  title = 'Altersnachweis erforderlich',
  message = 'Verifiziere einmalig dein Alter, um diese Funktion zu nutzen.',
  confirmLabel = 'Jetzt verifizieren',
  cancelLabel = 'Abbrechen',
}: {
  open: boolean;
  onClose: () => void;
  onStart: () => void | Promise<void>;
  title?: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483604] flex items-center justify-center" role="dialog" aria-modal="true" data-no-nav onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-[min(520px,92vw)] rounded-2xl border border-white/12 bg-[#0b0b0d] p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-[18px] font-semibold">{title}</h2>
        <p className="mt-2 text-white/80">{message}</p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button type="button" className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10" onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="px-4 py-2 rounded-lg bg-[var(--purple)] hover:opacity-95 text-white" onClick={() => void onStart()}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}


/* ---------------- GIF Picker (Tenor) ---------------- */
const TENOR_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? 'LIVDSRZULELA';
const TENOR_BASE = 'https://g.tenor.com/v1';

type TenorMedia = {
  gif?: { url?: string };
  mediumgif?: { url?: string };
  tinygif?: { url?: string };
  nanogif?: { url?: string };
};
type TenorItem = { id?: string; media?: TenorMedia[]; title?: string };
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
  const t = useTranslations('common.chatComposer');
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<{ id: string; url: string }[]>([]);

  const pickUrlFromItem = (it: TenorItem): string | null => {
    const m = it.media?.[0];
    const url = m?.gif?.url || m?.mediumgif?.url || m?.tinygif?.url || m?.nanogif?.url || null;
    return url ?? null;
  };

  const run = React.useCallback(async (query?: string) => {
    setErr(null);
    setLoading(true);
    try {
      const endpoint = query && query.trim()
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
      setErr(t('errors.gif.loadList'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  React.useEffect(() => {
    if (open) run();
  }, [open, run]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483602]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[min(960px,95vw)] max-h-[85vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#111] p-3 shadow-2xl">
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') run(q); }}
            placeholder={t('gif.search.placeholder')}
            className="flex-1 h-10 rounded-xl bg-white/[.06] border border-white/10 px-3 outline-none"
          />
          <button
            type="button"
            onClick={() => run(q)}
            className="h-10 px-4 rounded-xl bg-[var(--purple)] text-white hover:opacity-95"
          >
            {t('gif.search.button')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-3 rounded-xl border border-white/15 hover:bg-white/10"
          >
            {t('gif.close')}
          </button>
        </div>

        <div className="mt-3">
          {err && <div className="text-red-300 text-sm mb-2">{err}</div>}
          {loading ? (
            <div className="text-sm text-white/80 py-8 text-center">{t('gif.loading')}</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto max-h-[65vh] pr-1">
              {items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className="relative group rounded-lg overflow-hidden border border-white/10 hover:border-white/25"
                  onClick={() => onPick(it.url)}
                  title={t('gif.selectTitle')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="block w-full h-44 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------ Composer ------------------ */
export default function ChatComposer({
  disabled,
  disabledNotice,
  viewerRole,
  selfUserId,
  targetHandle,
  onSend,
  onTip,
  onUpload,
  onCreateTipRequest,
  onCreateAutoDrainRequest,
  onTypingPing,

  // 🆕 (optional)
  replyTo,
  onCancelReply,
  onCreateReply,
}: Props) {
  const t = useTranslations('common.chatComposer');
  const tVerify = useTranslations('common.verify');
  const locale = useLocale();
  const router = useRouter();
  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;

  const [verifyOpen, setVerifyOpen] = React.useState(false);
  useKeyboardInset();
  const startAgeVerification = React.useCallback(async () => {
    try {
      // Nach Abschluss des Flows zurück an die aktuelle URL (Chat-Seite)
      const back =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : `/${locale}`;

      // Nicht eingeloggt? → erst Login, dann zurück in diesen Chat
      if (!session) {
        router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }

      const res = await fetch(`/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`, { method: 'POST' });
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.url) throw new Error(j?.details || j?.error || `HTTP ${res.status}`);

      router.push(j.url as string);
    } catch {
      toast.error('Die Verifikation konnte nicht gestartet werden.', 'Fehler');
    }
  }, [locale, router, session]);


  const [text, setText] = React.useState('');
  const taRef = React.useRef<HTMLTextAreaElement | null>(null);
  const suggestAnchorRef = React.useRef<HTMLDivElement>(null);

  const maxRows = 6;
  const lineH = 20;
  const padY = 12;
  const maxHeight = maxRows * lineH + padY;

  const autosize = React.useCallback(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px';
  }, [maxHeight]);

  React.useEffect(() => { autosize(); }, [text, autosize]);

  const circle = 'grid place-items-center rounded-full select-none';
  const sendSize = 40;
  const toolSize = 40;

  const isSub = String(viewerRole).toUpperCase() === 'SUBMISSIVE';

  // Plus-Menu (nur für Dommes)
  const plusBtnRef = React.useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [anchorRect, setAnchorRect] = React.useState<DOMRect | null>(null);

  const openMenu = React.useCallback(() => {
    const r = plusBtnRef.current?.getBoundingClientRect();
    if (!r) return;
    setAnchorRect(r);
    setMenuOpen(true);
  }, []);

  // Modals
  const [tipReqOpen, setTipReqOpen] = React.useState(false);
  const [ownReqOpen, setOwnReqOpen] = React.useState(false);
  const [adReqOpen, setAdReqOpen] = React.useState(false);

  /* -------- Voice recording (press & hold) -------- */
  const [recording, setRecording] = React.useState(false);
  const [recordSecs, setRecordSecs] = React.useState(0);
  const [recError, setRecError] = React.useState<string | null>(null);

  const recTimerRef = React.useRef<number | null>(null);
  const mrRef = React.useRef<MediaRecorder | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [audioPreviewUrl, setAudioPreviewUrl] = React.useState<string | null>(null);
  const audioBlobRef = React.useRef<Blob | null>(null);

  // 🔔 Typing loop
  const typingActiveRef = React.useRef(false);
  const typingTimerRef = React.useRef<number | null>(null);

  const startTyping = React.useCallback(() => {
    if (disabled || typingActiveRef.current) return;
    typingActiveRef.current = true;
    onTypingPing?.(true);
    if (typingTimerRef.current) window.clearInterval(typingTimerRef.current);
    typingTimerRef.current = window.setInterval(() => onTypingPing?.(true), 3000);
  }, [disabled, onTypingPing]);

  const stopTyping = React.useCallback(() => {
    if (!typingActiveRef.current) return;
    typingActiveRef.current = false;
    if (typingTimerRef.current) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    onTypingPing?.(false);
  }, [onTypingPing]);

  React.useEffect(() => () => stopTyping(), [stopTyping]);

  function clearStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }
  function clearTimer() {
    if (recTimerRef.current !== null) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
  }
  function resetPreview() {
    if (audioPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    audioBlobRef.current = null;
  }

  const canRecord = () =>
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  function getIsTypeSupported():
    | ((type: string) => boolean)
    | undefined {
    if (typeof MediaRecorder === 'undefined') return undefined;
    const ctor: { isTypeSupported?: (type: string) => boolean } = MediaRecorder as unknown as {
      isTypeSupported?: (type: string) => boolean;
    };
    return typeof ctor.isTypeSupported === 'function' ? ctor.isTypeSupported.bind(MediaRecorder) : undefined;
  }

  const pickBestAudioType = () => {
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
      'audio/mpeg',
    ];
    const supported = getIsTypeSupported();
    for (const tCand of candidates) {
      if (!supported || supported(tCand)) return tCand;
    }
    return undefined;
  };

  async function startRecording() {
    if (disabled) return;
    setRecError(null);

    if (!canRecord()) {
      setRecError(t('errors.voice.unsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickBestAudioType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mrRef.current = mr;
      chunksRef.current = [];

      mr.addEventListener('dataavailable', (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      });
      mr.addEventListener('stop', () => {
        clearTimer();
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        audioBlobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        clearStream();
        stopTyping();
      });

      mr.start();
      setRecording(true);
      setRecordSecs(0);
      clearTimer();
      recTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);

      startTyping();
    } catch {
      setRecError(t('errors.voice.denied'));
    }
  }

  function stopRecording() {
    if (!recording) return;
    try { mrRef.current?.stop(); } catch {}
  }

  async function sendVoice() {
    if (!audioBlobRef.current || !onUpload) return;
    const ext =
      (audioBlobRef.current.type.includes('mp3') && 'mp3') ||
      (audioBlobRef.current.type.includes('ogg') && 'ogg') ||
      (audioBlobRef.current.type.includes('mp4') && 'm4a') ||
      (audioBlobRef.current.type.includes('webm') && 'webm') ||
      'webm';
    const file = new File([audioBlobRef.current], `voice_${Date.now()}.${ext}`, {
      type: audioBlobRef.current.type || 'audio/webm',
    });
    await onUpload(file);
    resetPreview();
  }

  /* --------- GIF & Media: jetzt MULTI --------- */
  const [gifOpen, setGifOpen] = React.useState(false);
  const [gifPreviews, setGifPreviews] = React.useState<{ url: string; file: File }[]>([]);
  const [gifErr, setGifErr] = React.useState<string | null>(null);

  const [mediaPreviews, setMediaPreviews] = React.useState<{ url: string; file: File }[]>([]);

  const revoke = (u?: string) => { if (u && u.startsWith('blob:')) URL.revokeObjectURL(u); };

  const clearAllPreviews = React.useCallback(() => {
    mediaPreviews.forEach(p => revoke(p.url));
    gifPreviews.forEach(p => revoke(p.url));
    setMediaPreviews([]);
    setGifPreviews([]);
  }, [mediaPreviews, gifPreviews]);

  async function pickGifByUrl(url: string) {
    try {
      setGifErr(null);
      const r = await fetch(url, { mode: 'cors' });
      const blob = await r.blob();
      const type = blob.type || 'image/gif';
      const file = new File([blob], `gif_${Date.now()}.gif`, { type });
      const local = URL.createObjectURL(blob);
      setGifPreviews((arr) => [...arr, { url: local, file }]);
      setGifOpen(false);
      startTyping();
    } catch {
      setGifErr(t('errors.gif.loadOne'));
    }
  }

  const submit = React.useCallback(async () => {
    if (disabled) return;
    const tMsg = text.trim();

    // Dateien zuerst senden …
    if ((mediaPreviews.length > 0 || gifPreviews.length > 0) && onUpload) {
      const all = [...mediaPreviews, ...gifPreviews];
      for (let i = 0; i < all.length; i++) {
        const { file } = all[i];
        const cap = i === 0 ? (tMsg || undefined) : undefined;
        await onUpload(file, cap);
      }
      clearAllPreviews();
      setText('');
      stopTyping();
      requestAnimationFrame(() => autosize());
      return;
    }

    // Nichts zu senden?
    if (!tMsg && !replyTo) return;

    if (replyTo) {
      if (onCreateReply) {
        onCreateReply({ to: replyTo.id, text: tMsg });
      } else {
        // Fallback, falls Page veraltet ist
        onSend(`${REPLY_PREFIX}${JSON.stringify({ to: replyTo.id, text: tMsg })}`);
      }
      setText('');
      stopTyping();
      requestAnimationFrame(() => autosize());
      onCancelReply?.();
      return;
    }

    // normaler Text
    onSend(tMsg);
    setText('');
    stopTyping();
    requestAnimationFrame(() => autosize());
  }, [
    disabled, text, onUpload, mediaPreviews, gifPreviews, clearAllPreviews,
    stopTyping, autosize, replyTo, onCreateReply, onSend, onCancelReply
  ]);

  const hasAnyAttach = mediaPreviews.length > 0 || gifPreviews.length > 0;

  return (
    <div
      className="fixed bottom-0 inset-x-0 z-40 mx-auto w-full max-w-[760px]
                 border-t border-sub bg-black/60 backdrop-blur supports-[backdrop-filter]:bg-black/45
                 px-3 pb-2 pt-2"
      style={{
        // Safe-Area beibehalten
        paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        // nur vertikal anheben (Keyboard), Zentrierung läuft via mx-auto
        transform: 'translateY(calc(-1 * var(--kb, 0px)))',
      }}
    >
      {disabled && (
        <div className="mb-2 text-center text-[13px] text-white/80">
          {disabledNotice ?? t('disabled.default')}
        </div>
      )}

      {/* 🆕 Reply banner */}
      {replyTo && (
        <div className="mx-auto mb-2 max-w-[760px] rounded-2xl border border-white/15 bg-white/[.06] px-3 py-2">
          <div className="flex items-start gap-2">
            <div className="text-[12px] font-semibold">Antwort an {replyTo.authorName}</div>
            <button
              type="button"
              onClick={onCancelReply}
              className="ml-auto text-[12px] px-2 py-0.5 rounded-lg border border-white/15 hover:bg-white/10"
              title="Abbrechen"
            >
              Abbrechen
            </button>
          </div>
          {replyTo.text && (
            <div className="mt-1 text-[12px] text-white/70 line-clamp-2 whitespace-pre-wrap break-words">
              {replyTo.text}
            </div>
          )}
        </div>
      )}

      {recError && (
        <div className="mx-auto mb-2 max-w-[760px] text-[12px] text-red-300">
          {recError}
        </div>
      )}
      {gifErr && <div className="mx-auto mb-2 max-w-[760px] text-[12px] text-red-300">{gifErr}</div>}

      {/* Recording mini pill */}
      {recording && (
        <div className="mx-auto mb-2 max-w-[760px]">
          <div className="inline-flex items-center gap-2 rounded-full bg-[var(--purple)]/25 border border-[var(--purple)]/40 px-3 py-1 text-[13px]">
            <MicWavesIcon />
            <span>{t('recording.inProgress')}</span>
            <span className="opacity-80">{recordSecs}s</span>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-white/10 bg-white/[.06] shadow-[0_2px_16px_rgba(0,0,0,.25)] px-3 py-2">
        {/* VORSCHAUEN: Medien & GIFs als Grid */}
        {(mediaPreviews.length > 0 || gifPreviews.length > 0) && (
          <div className="mb-2 pl-2">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
              {[...mediaPreviews, ...gifPreviews].map(({ url, file }, idx) => {
                const isVideo = file.type.startsWith('video/');
                return (
                  <div key={url} className="relative">
                    {isVideo ? (
                      <video
                        src={url}
                        className="h-24 w-full rounded-lg border border-white/10 object-cover bg-black"
                        controls
                        playsInline
                        preload="metadata"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" className="h-24 w-full rounded-lg border border-white/10 object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (idx < mediaPreviews.length) {
                          const i = idx;
                          setMediaPreviews((arr) => {
                            const next = [...arr];
                            revoke(next[i]?.url);
                            next.splice(i, 1);
                            return next;
                          });
                        } else {
                          const i = idx - mediaPreviews.length;
                          setGifPreviews((arr) => {
                            const next = [...arr];
                            revoke(next[i]?.url);
                            next.splice(i, 1);
                            return next;
                          });
                        }
                        if (!text.trim() && (mediaPreviews.length + gifPreviews.length - 1) === 0) stopTyping();
                      }}
                      className="absolute -right-2 -top-2 h-7 w-7 grid place-items-center rounded-full bg-black/70 border border-white/20 hover:bg-black/85"
                      title={t('actions.remove')}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* drei Spalten: Text | Mic | Send */}
        <div ref={suggestAnchorRef} className="grid grid-cols-[1fr_auto_auto] items-end gap-2">
          <div className="flex flex-col">
            <textarea
              ref={taRef}
              rows={1}
              value={text}
              disabled={disabled}
              onChange={(e) => {
                const v = e.target.value;
                setText(v);
                autosize();
                if (v.trim() || hasAnyAttach) startTyping(); else stopTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                } else {
                  if (text.trim() || hasAnyAttach) startTyping();
                }
              }}
              onBlur={() => {
                if (!hasAnyAttach && !text.trim()) stopTyping();
              }}
              placeholder={disabled ? t('placeholders.closed') : t('placeholders.message')}
              className="w-full resize-none bg-transparent outline-none placeholder:text-muted
                        text-[14px] leading-5 px-0 pt-1 pb-1 rounded-2xl no-scrollbar break-anywhere"
              style={{
                minHeight: 40,
                maxHeight,                 // cap beibehalten
                overflowY: 'auto',         // scrollen erlauben
                WebkitOverflowScrolling: 'touch',
              }}
            />

            <div className="mt-2 flex items-center gap-8 pl-2">
              {/* Media picker (MULTI) */}
              <label
                className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 cursor-pointer`}
                style={{ width: toolSize, height: toolSize }}
                aria-label={t('actions.upload')}
                title={t('actions.upload')}
                onClick={(e) => {
                  if (!ageOk) {
                    e.preventDefault();      // verhindert das Öffnen des Dateidialogs
                    setVerifyOpen(true);     // öffnet das Veriff-Prompt
                  }
                }}
              >
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*"
                  multiple
                  disabled={disabled}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length) {
                      setMediaPreviews((arr) => [
                        ...arr,
                        ...files.map((f) => ({ url: URL.createObjectURL(f), file: f })),
                      ]);
                      startTyping();
                    }
                    e.currentTarget.value = '';
                  }}
                />
                <PhotoIcon />
              </label>


              {/* GIF Button */}
              <button
                type="button"
                onClick={() => setGifOpen(true)}
                disabled={disabled}
                className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 disabled:opacity-50`}
                style={{ width: toolSize, height: toolSize }}
                aria-label={t('actions.gif')}
                title={t('actions.gif')}
              >
                <GifIcon size={22} />
              </button>

              {/* Sub: Tip Button / Domme: Plus-Menü */}
              {isSub ? (
                <button
                  type="button"
                  onClick={() => {
                    if (!ageOk) { setVerifyOpen(true); return; }
                    onTip();
                  }}
                  disabled={disabled}
                  className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 disabled:opacity-50`}
                  style={{ width: toolSize, height: toolSize }}
                  aria-label={t('actions.tip')}
                  title={t('actions.tip')}
                >
                      <TipIcon className="w-[30px] h-[30px]" />
                    </button>
              ) : (
                <>
                  <button
                    ref={plusBtnRef}
                    type="button"
                    onClick={() => {
                      if (disabled) return;
                      if (!ageOk) { setVerifyOpen(true); return; }
                      openMenu();
                    }}
                    disabled={disabled}
                    className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 disabled:opacity-50`}
                    style={{ width: toolSize, height: toolSize }}
                    aria-label={t('actions.openActions')}
                    title={t('actions.actions')}
                  >
                    <PlusIcon />
                  </button>

                  {menuOpen && anchorRect && (
                    <ActionMenu anchorRect={anchorRect} onClose={() => setMenuOpen(false)}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => {
                          setMenuOpen(false);
                          setTipReqOpen(true);
                        }}
                      >
                        {t('menu.tipRequest')}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => {
                          setMenuOpen(false);
                          setAdReqOpen(true);
                        }}
                      >
                        {t('menu.autodrainRequest')}
                      </button>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => {
                          setMenuOpen(false);
                          setOwnReqOpen(true);
                        }}
                      >
                        {t('menu.ownershipRequest')}
                      </button>
                    </ActionMenu>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mic */}
          <button
            type="button"
            disabled={disabled}
            className={`${circle} border border-white/12 bg-transparent hover:bg-white/10 disabled:opacity-50`}
            style={{ width: sendSize, height: sendSize }}
            aria-label={t('actions.voice.holdAria')}
            title={t('actions.voice.holdTitle')}
            onPointerDown={(e) => {
              e.preventDefault();
              startRecording();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              stopRecording();
            }}
            onPointerLeave={() => {
              if (recording) stopRecording();
            }}
          >
            <MicIcon />
          </button>

          {/* Send */}
          <button
            type="button"
            onClick={() => void submit()}
            disabled={(!text.trim() && !hasAnyAttach && !replyTo) || disabled}
            className={`${circle} bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50`}
            style={{ width: sendSize, height: sendSize }}
            aria-label={t('actions.sendMessageAria')}
            title={t('actions.send')}
          >
            <SendIcon />
          </button>
        </div>
      </div>

      {/* Voice preview bar */}
      {audioPreviewUrl && (
        <div className="mx-auto mt-2 max-w-[760px] rounded-2xl border border-white/12 bg-white/[.06] p-2 flex items-center gap-3">
          <audio src={audioPreviewUrl} controls className="flex-1" />
          <button
            type="button"
            onClick={sendVoice}
            className="h-9 px-4 rounded-lg bg-[var(--purple)] text-white hover:opacity-95"
          >
            {t('voice.preview.send')}
          </button>
          <button
            type="button"
            onClick={() => { resetPreview(); stopTyping(); }}
            className="h-9 px-3 rounded-lg border border-white/15 hover:bg-white/10"
          >
            {t('voice.preview.discard')}
          </button>
        </div>
      )}

      <MentionSuggestChat
        anchorRef={suggestAnchorRef as React.RefObject<HTMLElement>}
        value={text}
        onChange={setText}
        limit={8}
      />

      <TipRequestCreateModal
        open={tipReqOpen}
        onClose={() => setTipReqOpen(false)}
        onCreate={(payload) => {
          setTipReqOpen(false);
          if (onCreateTipRequest) {
            onCreateTipRequest(payload);
            return;
          }
          const currency = payload.currency ?? 'EUR';
          const amountStr = new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(
            payload.amountCents / 100,
          );
          const msg = `🧾 ${t('protocol.tipRequestLabel')}: ${amountStr}${payload.note ? `\n${payload.note}` : ''}`;
          onSend(msg);
        }}
      />

      <OwnershipRequestCreateModal
        open={ownReqOpen}
        onClose={() => setOwnReqOpen(false)}
        userId={selfUserId}
        handle={targetHandle}
        onCreate={(payload: OwnReqPayload) => {
          setOwnReqOpen(false);
          onSend(`OWNREQ::${JSON.stringify(payload)}`);
        }}
      />

      <AutoDrainRequestCreateModal
        open={adReqOpen}
        onClose={() => setAdReqOpen(false)}
        onCreate={(payload: ADReqPayload) => {
          setAdReqOpen(false);
          if (onCreateAutoDrainRequest) {
            onCreateAutoDrainRequest(payload);
            return;
          }
          const currency = payload.currency ?? 'EUR';
          const data = { ...payload, currency };
          onSend(`ADREQ::${JSON.stringify(data)}`);
        }}
      />

      <VerifyPrompt
        open={verifyOpen}
        onClose={() => setVerifyOpen(false)}
        onStart={startAgeVerification}
        title={tVerify('modal.title')}
        message={tVerify('modal.message')}
        confirmLabel={tVerify('modal.confirm')}
        cancelLabel={tVerify('modal.cancel')}
      />


      <GifPickerModal
        open={gifOpen}
        onClose={() => setGifOpen(false)}
        onPick={(url) => void pickGifByUrl(url)}
      />
    </div>
  );
}

function PhotoIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      aria-hidden
      fill="currentColor"  // statt style="fill:#FFFFFF"
    >
      <path d="M 13 12 C 9.686 12 7 14.686 7 18 L 7 54 C 7 57.314 9.686 60 13 60 L 59 60 C 62.314 60 65 57.314 65 54 L 65 18 C 65 14.686 62.314 12 59 12 L 13 12 z M 16 20 L 56 20 C 56.552 20 57 20.448 57 21 L 57 44.505859 L 49.166016 37.304688 C 47.102016 35.407688 43.926187 35.412453 41.867188 37.314453 L 32.861328 45.630859 L 27.927734 41.412109 C 25.906734 39.683109 22.927109 39.689781 20.912109 41.425781 L 15 46.519531 L 15 21 C 15 20.448 15.448 20 16 20 z M 27 24 C 24.791 24 23 25.791 23 28 C 23 30.209 24.791 32 27 32 C 29.209 32 31 30.209 31 28 C 31 25.791 29.209 24 27 24 z"></path>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
function MicIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 72 72"
      width={size}
      height={size}
      aria-hidden
      fill="currentColor"
    >
      <path d="M 36 7 C 29.935 7 25 11.935 25 18 L 25 30 C 25 36.065 29.935 41 36 41 C 42.065 41 47 36.065 47 30 L 47 18 C 47 11.935 42.065 7 36 7 z M 17 29 C 14.791 29 13 30.791 13 33 C 13 42.173798 21.36238 50.061694 32 51.679688 L 32 53.25 C 32 53.506733 32.029944 53.756715 32.076172 54 L 29 54 C 26.791 54 25 55.791 25 58 C 25 60.209 26.791 62 29 62 L 43 62 C 45.209 62 47 60.209 47 58 C 47 55.791 45.209 54 43 54 L 39.923828 54 C 39.970056 53.756715 40 53.506733 40 53.25 L 40 51.679688 C 50.63762 50.061694 59 42.173798 59 33 C 59 30.791 57.209 29 55 29 C 52.791 29 51 30.791 51 33 C 51 38.203 44.84 44 36 44 C 27.16 44 21 38.203 21 33 C 21 30.791 19.209 29 17 29 z"></path>
    </svg>
  );
}

function MicWavesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v3M8 9v6M12 6v12M16 9v6M20 12v3" strokeLinecap="round" />
    </svg>
  );
}
function GifIcon({ size = 22 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontFamily="ui-sans-serif,system-ui"
        fontWeight="700"
        fontSize="15"
        fill="currentColor"
      >
        GIF
      </text>
    </svg>
  );
}
