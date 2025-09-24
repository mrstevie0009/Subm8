// src/components/OwnershipRequestAcceptModal.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';

export type OwnershipReqPayload = {
  // Flags/Text aus der Anfrage
  avatar?: true;
  banner?: true;
  bio?: string;

  // Neue Referenzen (vom Domme hochgeladen)
  avatarUrl?: string;
  bannerUrl?: string;

  // Legacy-Unterstützung (falls früher mal DataURLs gesendet wurden)
  avatarDataUrl?: string;
  bannerDataUrl?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  payload: OwnershipReqPayload;
  onSuccess: () => void;
  /** eigene User-ID – wird als Header gesendet (und zusätzlich im FormData als Fallback) */
  selfUserId?: string;
};

function dataUrlToBlob(dataUrl: string): Blob {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) throw new Error('Invalid data URL');
  const mime = m[1];
  const b64 = m[2];
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: mime });
}

async function srcToBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:')) return dataUrlToBlob(src);
  const res = await fetch(src);
  if (!res.ok) throw new Error(`Failed to fetch asset (${res.status})`);
  return await res.blob();
}

export default function OwnershipRequestAcceptModal({
  open,
  onClose,
  payload,
  onSuccess,
  selfUserId,
}: Props) {
  const t = useTranslations('common.ownershipRequestAcceptModal');

  const [mounted, setMounted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const bannerSrc = payload.bannerUrl || payload.bannerDataUrl || null;
  const avatarSrc = payload.avatarUrl || payload.avatarDataUrl || null;

  const canApplyAvatar = !!(payload.avatar && avatarSrc);
  const canApplyBanner = !!(payload.banner && bannerSrc);
  const canApplyBio = typeof payload.bio === 'string' && payload.bio.trim().length > 0;

  const nothingToApply = !canApplyAvatar && !canApplyBanner && !canApplyBio;

  const apply = async () => {
    if (nothingToApply) return;
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();

      if (selfUserId) fd.append('userId', selfUserId); // Fallback für die Route
      if (canApplyBio) fd.append('bio', payload.bio!.trim());

      if (canApplyAvatar && avatarSrc) {
        const b = await srcToBlob(avatarSrc);
        fd.append('avatar', b, 'avatar');
      }
      if (canApplyBanner && bannerSrc) {
        const b = await srcToBlob(bannerSrc);
        fd.append('banner', b, 'banner');
      }

      const headers: HeadersInit | undefined = selfUserId ? { 'x-user-id': selfUserId } : undefined;

      const res = await fetch('/api/profile/ownership/apply', {
        method: 'POST',
        body: fd,
        headers,
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`Apply failed (${res.status})`);

      onSuccess();
    } catch {
      setErr(t('errors.applyFail'));
      return;
    } finally {
      setBusy(false);
    }
  };

  const overlay = (
    <div className="fixed inset-0 z-[2147483600] grid place-items-center" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur" onClick={onClose} />
      <div className="relative w-[min(96vw,720px)] rounded-2xl border border-white/12 bg-black/92 shadow-2xl">
        <div className="px-4 py-3 border-b border-white/10 text-[15px] font-semibold">
          {t('header.title')}
        </div>

        <div className="p-4 space-y-4">
          {/* Banner Preview */}
          <div className="rounded-lg overflow-hidden border border-white/12 bg-white/[.03] h-[200px]">
            {bannerSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bannerSrc}
                alt={t('banner.previewAlt')}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/60 text-sm">
                {payload.banner ? t('banner.noAssetRequested') : t('banner.notRequested')}
              </div>
            )}
          </div>

          {/* Avatar + Bio */}
          <div className="flex items-center gap-3">
            <div
              className="rounded-full overflow-hidden border border-white/20 bg-white/10"
              style={{ width: 72, height: 72 }}
            >
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarSrc}
                  alt={t('avatar.previewAlt')}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full grid place-items-center text-white/60 text-sm">
                  {payload.avatar ? t('avatar.noAssetRequested') : t('avatar.notRequested')}
                </div>
              )}
            </div>

            {canApplyBio ? (
              <div className="text-[14px] text-white/90 whitespace-pre-wrap">{payload.bio}</div>
            ) : (
              <div className="text-[13px] text-white/60">{t('bio.none')}</div>
            )}
          </div>

          {err && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-[13px] px-3 py-2">
              {err}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-white/10 flex items-center justify-end gap-2">
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
            onClick={apply}
            disabled={busy || nothingToApply}
            className="px-5 h-9 rounded-full bg-[var(--purple)] text-white disabled:opacity-50 hover:opacity-95"
          >
            {busy ? t('actions.applying') : t('actions.apply')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
