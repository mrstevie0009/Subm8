// src/components/OwnershipRequestCreateModal.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

/** Payload, das in den Chat gesendet wird */
export type OwnershipReqPayload = {
  // Flags/Text
  avatar?: true;
  banner?: true;
  bio?: string;

  // Neue Referenzen (wenn Upload geklappt hat)
  avatarUrl?: string;
  bannerUrl?: string;

  // Fallback (Legacy / falls Upload fehlschlägt)
  avatarDataUrl?: string;
  bannerDataUrl?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Eigene User-ID (für LS-Key) */
  userId: string;
  /** Nur Anzeige (@handle des Subs) */
  handle: string;
  onCreate: (payload: OwnershipReqPayload) => void;
};

type OwnershipDraft = {
  avatarDataUrl?: string;
  bannerDataUrl?: string;
  bio?: string;
  updatedAt?: number;
};

const lsKey = (userId: string) => `ownership:profile:v1:${userId}`;

function readDraft(userId: string): OwnershipDraft | null {
  try {
    const raw = localStorage.getItem(lsKey(userId));
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === 'object') return j as OwnershipDraft;
  } catch {}
  return null;
}

/* ------------ Helpers: DataURL <-> Blob, Downscale ------------ */
function dataUrlToBlob(dataUrl: string): { blob: Blob; mime: string; ext: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Invalid data URL');
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  const ext = mime.split('/')[1] || 'bin';
  return { blob: new Blob([u8], { type: mime }), mime, ext };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image load error'));
    img.src = src;
  });
}

/** Skaliert eine DataURL auf maxW/maxH runter (JPEG quality), gibt DataURL zurück */
async function downscaleDataUrl(
  dataUrl: string,
  { maxW = 2048, maxH = 2048, quality = 0.85 }: { maxW?: number; maxH?: number; quality?: number }
): Promise<string> {
  const img = await loadImage(dataUrl);
  const { width, height } = img;

  const scale = Math.min(maxW / width, maxH / height, 1);
  const tw = Math.round(width * scale);
  const th = Math.round(height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, tw, th);

  return canvas.toDataURL('image/jpeg', quality);
}

/** Versucht Upload; bei Fehlern (404/413/5xx) -> null */
async function tryUploadDataUrl(
  dataUrl: string,
  kind: 'avatar' | 'banner'
): Promise<string | null> {
  try {
    const { blob, ext } = dataUrlToBlob(dataUrl);
    const fd = new FormData();
    fd.append('file', blob, `${kind}.${ext}`);
    fd.append('kind', kind);

    const res = await fetch('/api/ownership/upload', { method: 'POST', body: fd });
    if (!res.ok) return null;
    const json = (await res.json().catch(() => null)) as { ok?: boolean; url?: string } | null;
    return json?.url ? String(json.url) : null;
  } catch {
    return null;
  }
}

/** Upload mit Downscale-Fallback; am Ende URL oder null */
async function uploadWithFallback(dataUrl: string, kind: 'avatar' | 'banner'): Promise<string | null> {
  const url1 = await tryUploadDataUrl(dataUrl, kind);
  if (url1) return url1;

  try {
    const small = await downscaleDataUrl(dataUrl, { maxW: kind === 'banner' ? 2560 : 1024, maxH: 1440, quality: 0.82 });
    const url2 = await tryUploadDataUrl(small, kind);
    if (url2) return url2;
  } catch {}

  return null;
}

/* ------------ Modal ------------ */
export default function OwnershipRequestCreateModal({
  open,
  onClose,
  userId,
  handle,
  onCreate,
}: Props) {
  const t = useTranslations('common.ownershipRequest');

  const [mounted, setMounted] = React.useState(false);
  const [draft, setDraft] = React.useState<OwnershipDraft | null>(null);

  const [pickAvatar, setPickAvatar] = React.useState(false);
  const [pickBanner, setPickBanner] = React.useState(false);
  const [pickBio, setPickBio] = React.useState(false);

  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const d = readDraft(userId);
    setDraft(d);
    setPickAvatar(!!d?.avatarDataUrl);
    setPickBanner(!!d?.bannerDataUrl);
    setPickBio(!!(d?.bio && d.bio.trim()));
  }, [open, userId]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const nothingSaved = !draft?.avatarDataUrl && !draft?.bannerDataUrl && !draft?.bio;
  const nothingPicked = !pickAvatar && !pickBanner && !pickBio;

  const send = async () => {
    if (!draft || nothingPicked) return;
    setBusy(true);
    setErr(null);
    try {
      const payload: OwnershipReqPayload = {
        ...(pickAvatar ? { avatar: true } : {}),
        ...(pickBanner ? { banner: true } : {}),
        ...(pickBio && draft.bio ? { bio: draft.bio } : {}),
      };

      if (pickAvatar && draft.avatarDataUrl) {
        const url = await uploadWithFallback(draft.avatarDataUrl, 'avatar');
        if (url) payload.avatarUrl = url;
        else payload.avatarDataUrl = draft.avatarDataUrl;
      }

      if (pickBanner && draft.bannerDataUrl) {
        const url = await uploadWithFallback(draft.bannerDataUrl, 'banner');
        if (url) payload.bannerUrl = url;
        else payload.bannerDataUrl = draft.bannerDataUrl;
      }

      onCreate(payload);
    } catch {
      setErr(t('errors.createFailed'));
      return;
    } finally {
      setBusy(false);
    }
  };

  const overlay = (
    <div className="fixed inset-0 z-[2147483600] grid place-items-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={onClose} />
      <div className="relative w-[min(92vw,520px)] rounded-2xl border border-white/12 bg-black/92 shadow-2xl p-3">
        <div className="flex items-center justify-between px-1 pb-2">
          <div>
            <div className="text-[15px] font-semibold">{t('title')}</div>
            <div className="text-[12px] text-white/70">{t('subtitle', { handle })}</div>
          </div>
          <button
            className="w-8 h-8 grid place-items-center rounded-full hover:bg-white/10"
            onClick={onClose}
            aria-label={t('aria.close')}
            title={t('aria.close')}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
            </svg>
          </button>
        </div>

        {nothingSaved ? (
          <div className="px-2 py-3 text-[14px] text-white/75">
            {t('emptySaved')}
          </div>
        ) : (
          <div className="px-2 py-1 space-y-3">
            {!!draft?.avatarDataUrl && (
              <label className="flex items-center gap-3 text-[14px]">
                <input
                  type="checkbox"
                  className="accent-[var(--purple)]"
                  checked={pickAvatar}
                  onChange={(e) => setPickAvatar(e.target.checked)}
                />
                <span>{t('fields.avatar')}</span>
              </label>
            )}

            {!!draft?.bannerDataUrl && (
              <label className="flex items-center gap-3 text-[14px]">
                <input
                  type="checkbox"
                  className="accent-[var(--purple)]"
                  checked={pickBanner}
                  onChange={(e) => setPickBanner(e.target.checked)}
                />
                <span>{t('fields.banner')}</span>
              </label>
            )}

            {!!(draft?.bio && draft.bio.trim()) && (
              <label className="flex items-center gap-3 text-[14px]">
                <input
                  type="checkbox"
                  className="accent-[var(--purple)]"
                  checked={pickBio}
                  onChange={(e) => setPickBio(e.target.checked)}
                />
                <span>{t('fields.bio')}</span>
              </label>
            )}
          </div>
        )}

        {err && (
          <div className="mt-2 mx-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-[13px] px-3 py-2">
            {err}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2 px-1 pb-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 h-9 rounded-full border border-white/20 hover:bg-white/10"
            disabled={busy}
          >
            {t('actions.cancel')}
          </button>
          <button
            type="button"
            disabled={busy || nothingSaved || nothingPicked}
            onClick={send}
            className="px-5 h-9 rounded-full bg-[var(--purple)] text-white disabled:opacity-50 hover:opacity-95"
          >
            {busy ? t('actions.uploading') : t('actions.send')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
