// src/components/CreateCommunityButton.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from '@/lib/toast';
import BannerCropper from '@/components/BannerCropper';

type JoinPolicy = 'OPEN' | 'INVITE_ONLY' | 'DOMME_ONLY' | 'SUB_ONLY';

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .replace(/[^a-z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try { return JSON.stringify(err); } catch { return String(err); }
}

function stripExt(n: string) {
  const i = n.lastIndexOf('.');
  return i >= 0 ? n.slice(0, i) : n;
}

export default function CreateCommunityButton() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [policy, setPolicy] = React.useState<JoinPolicy>('OPEN');

  // Datei/Preview (nach Crop)
  const [banner, setBanner] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  // Cropper-Modal-States
  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const originalPickedNameRef = React.useRef<string>('banner.png');

  // Remote-Upload-State (Cloudflare R2)
  const [bannerUrlRemote, setBannerUrlRemote] = React.useState<string | null>(null);
  const [bannerUploading, setBannerUploading] = React.useState(false);

  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('communities.communities');
  const tt = useTranslations('home.toast');

  // Portal-Root
  React.useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    portalRef.current = el;
    setMounted(true);
    return () => {
      if (portalRef.current?.parentNode) portalRef.current.parentNode.removeChild(portalRef.current);
    };
  }, []);

  // Preview erzeugen, wenn eine (neue) Banner-Datei gesetzt wird
  React.useEffect(() => {
    if (!banner) { setPreview(null); return; }
    const url = URL.createObjectURL(banner);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [banner]);

  // ESC + Scroll-Lock (nur offen)
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  function reset() {
    setName(''); setDescription('');
    setPolicy('OPEN');

    // Banner & Upload
    if (preview) URL.revokeObjectURL(preview);
    setBanner(null); setPreview(null);
    setBannerUrlRemote(null); setBannerUploading(false);

    // Cropper
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setCropOpen(false);

    setErr(null);
  }

  // ---- Cloudflare R2 Direct Upload über vorhandenen Endpoint ----
  async function uploadBannerToR2(file: File) {
    setBannerUploading(true);
    try {
      const url = `/api/upload-urls?kind=banners`;
      const presignRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: [{ name: file.name, type: file.type || 'application/octet-stream' }] }),
      });
      const presignJson: {
        items?: { uploadUrl: string; publicUrl: string; kind: string }[];
        error?: string;
      } = await presignRes.json();

      if (!presignRes.ok || !presignJson?.items?.length) {
        throw new Error(presignJson?.error || `Presign failed: ${presignRes.status}`);
      }
      const { uploadUrl, publicUrl } = presignJson.items[0];

      // PUT direkt zu Cloudflare R2 (Signed URL)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed: ${putRes.status}`);
      }

      setBannerUrlRemote(publicUrl);
      return publicUrl;
    } finally {
      setBannerUploading(false);
    }
  }

  // Datei picken → Cropper öffnen (kein sofortiger Upload)
  async function handlePick(file: File | null) {
    setErr(null);
    setBannerUrlRemote(null);

    if (!file) {
      // Reset, wenn Auswahl gelöscht
      setBanner(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      return;
    }

    // Objekt-URL für Cropper erzeugen
    const objectUrl = URL.createObjectURL(file);
    // alten cropSrc (falls offen) freigeben
    if (cropSrc) URL.revokeObjectURL(cropSrc);

    originalPickedNameRef.current = file.name || 'banner.png';
    setCropSrc(objectUrl);
    setCropOpen(true);
  }

  // Cropper -> „Use“ gedrückt → Blob erhalten, in PNG-File umwandeln, dann hochladen
  async function handleCropComplete(blob: Blob) {
    try {
      setCropOpen(false);

      // Besseren Dateinamen erzeugen
      const base = stripExt(originalPickedNameRef.current) || 'banner';
      const outFile = new File([blob], `${base}-banner.png`, { type: 'image/png' });

      // bisherige Preview freigeben
      if (preview) URL.revokeObjectURL(preview);

      // Setze die (neue) lokale Datei => useEffect erzeugt neue Preview
      setBanner(outFile);

      // Remote Upload starten (setzt bannerUrlRemote)
      await uploadBannerToR2(outFile);
    } catch (e: unknown) {
      setErr(errorMessage(e) || 'Crop/Upload failed');
      setBanner(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      setBannerUrlRemote(null);
    } finally {
      // cropSrc Objekt-URL freigeben
      if (cropSrc) {
        URL.revokeObjectURL(cropSrc);
        setCropSrc(null);
      }
    }
  }

  function handleCropCancel() {
    setCropOpen(false);
    if (cropSrc) {
      URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setErr(null);

    try {
      // Falls User ein Banner gewählt hatte, aber Upload noch läuft / fehlt, hier absichern
      if (banner && !bannerUrlRemote) {
        try {
          await uploadBannerToR2(banner);
        } catch (e: unknown) {
          setErr(errorMessage(e) || 'Upload failed');
          return;
        }
      }

      const handleFromName = slugify(name); // Handle = slug aus Displayname
      const payload = {
        name: name.trim(),
        handle: handleFromName,
        description: description.trim() || undefined,
        policy,
        bannerUrl: bannerUrlRemote || undefined, // öffentliche R2-URL
      };

      const res = await fetch('/api/communities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json: { ok: boolean; community?: { slug: string }; error?: string } = await res.json();

      if (!res.ok || !json?.ok || !json.community) {
        setErr(json?.error || `HTTP ${res.status}`);
        toast.error(tt('community.createFailedTitle'), tt('generic.tryAgain'));
        return;
      }

      toast.show({
        title: tt('community.created'),
        variant: 'success',
        durationMs: 2000,
      });

      setOpen(false);
      reset();
      router.push(`/${locale}/communities/${json.community.slug}`);
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    '!bg-[#14161b] text-white w-full rounded-xl border border-white/10 ' +
    'px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/45 placeholder:opacity-50 ' +
    'shadow-inner';

  const modal = !open ? null : (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2147483647] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.88)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="min-h-full flex items-center justify-center py-4 sm:py-10 px-3">
        <div
          className="relative w-full max-w-[min(680px,100%)] rounded-2xl border border-white/10 shadow-2xl"
          style={{ backgroundColor: '#0c0e13', isolation: 'isolate' }}
          onClick={(e) => e.stopPropagation()}
        >
          <form onSubmit={submit} className="flex flex-col" style={{ maxHeight: 'calc(100vh - 2rem)' }}>
            {/* Header */}
            <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-base sm:text-lg font-semibold">{t('create.title')}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-grid place-items-center size-8 rounded-lg hover:bg-white/10"
                aria-label={t('create.aria.close')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
              {/* Displayname */}
              <label className="block space-y-1.5">
                <span className="text-sm opacity-80">{t('create.fields.name.label')}</span>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder={t('create.fields.name.placeholder')}
                  required
                />
                <div className="text-xs opacity-60">
                  @{slugify(name) || 'dein-handle'}
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm opacity-80">{t('create.fields.description.label')}</span>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={4}
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder={t('create.fields.description.placeholder')}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm opacity-80">{t('create.fields.policy.label')}</span>
                <select
                  className={inputCls}
                  value={policy}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPolicy(e.target.value as JoinPolicy)}
                >
                  <option value="OPEN">{t('create.fields.policy.options.open')}</option>
                  <option value="INVITE_ONLY">{t('create.fields.policy.options.invite')}</option>
                  <option value="DOMME_ONLY">{t('create.fields.policy.options.dommeOnly')}</option>
                  <option value="SUB_ONLY">{t('create.fields.policy.options.subOnly')}</option>
                </select>
              </label>

              {/* Banner Upload */}
              <div className="space-y-2">
                <div className="text-sm opacity-80">{t('create.banner.label')}</div>
                <div
                  className="rounded-xl border-2 border-dashed border-white/15 p-3 sm:p-4"
                  style={{ backgroundColor: '#14161b' }}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0] ?? null;
                    void handlePick(f);
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('create.banner.choose')}
                    </button>
                    <div className="text-sm opacity-70">
                      {t('create.banner.help')}
                    </div>
                    {bannerUploading && (
                      <span className="text-xs px-2 py-1 rounded-full border border-white/15 bg-white/5">
                        {t('create.banner.uploading') ?? 'lädt hoch…'}
                      </span>
                    )}
                    {bannerUrlRemote && !bannerUploading && (
                      <span className="text-xs px-2 py-1 rounded-full border border-emerald-400/30 bg-emerald-500/10">
                        {t('create.banner.ready') ?? 'bereit'}
                      </span>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const f = e.target.files?.[0] ?? null;
                      void handlePick(f);
                    }}
                  />

                  {preview && (
                    <div className="mt-3 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={t('create.fields.banner.previewAlt')}
                        className="h-24 w-full object-cover rounded-lg border border-white/10"
                      />
                      <button
                        type="button"
                        className="absolute top-2 right-2 inline-grid place-items-center size-8 rounded-full bg-black/70 hover:bg-black/85 border border-white/10"
                        onClick={() => {
                          if (preview) URL.revokeObjectURL(preview);
                          setBanner(null);
                          setPreview(null);
                          setBannerUrlRemote(null);
                        }}
                        aria-label={t('create.fields.banner.removeAria')}
                      >
                        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {err && <div className="text-sm text-red-400">{err}</div>}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-4 sm:px-5 py-3 border-t border-white/10 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5"
                onClick={() => setOpen(false)}
              >
                {t('create.actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim() || bannerUploading}
                className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white disabled:opacity-50"
              >
                {loading ? t('create.actions.creating') : t('create.actions.create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95"
        onClick={() => setOpen(true)}
      >
        {t('create.button')}
      </button>

      {/* Cropper Modal */}
      <BannerCropper
        open={cropOpen}
        imageSrc={cropSrc}
        onCancel={handleCropCancel}
        onComplete={handleCropComplete}
      />

      {open && mounted && portalRef.current ? createPortal(modal, portalRef.current) : null}
    </>
  );
}
