'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';

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

export default function CreateCommunityButton() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [policy, setPolicy] = React.useState<JoinPolicy>('OPEN');
  const [banner, setBanner] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const portalRef = React.useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = React.useState(false);

  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('common.communities.create');

  // Portal-Root ohne Styles, blockiert nichts wenn geschlossen.
  React.useEffect(() => {
    const el = document.createElement('div');
    document.body.appendChild(el);
    portalRef.current = el;
    setMounted(true);
    return () => {
      if (portalRef.current?.parentNode) {
        portalRef.current.parentNode.removeChild(portalRef.current);
      }
    };
  }, []);

  // Auto-Handle aus Name (nur wenn leer)
  React.useEffect(() => {
    if (!handle.trim() && name.trim()) setHandle(slugify(name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  // Preview fürs Banner
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
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open]);

  function reset() {
    setName(''); setHandle(''); setDescription('');
    setPolicy('OPEN'); setBanner(null); setPreview(null); setErr(null);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true); setErr(null);
    try {
      const fd = new FormData();
      fd.set('name', name.trim());
      if (handle.trim()) fd.set('handle', handle.trim());
      if (description.trim()) fd.set('description', description.trim());
      fd.set('policy', policy);
      if (banner) fd.set('banner', banner);

      const res = await fetch('/api/communities', { method: 'POST', body: fd });
      const json: { ok: boolean; community?: { slug: string }; error?: string } = await res.json();

      if (!res.ok || !json?.ok || !json.community) {
        setErr(json?.error || `HTTP ${res.status}`);
        return;
      }
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

  const handlePreview = handle || t('fields.handle.example');

  const modal = !open ? null : (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[2147483647] overflow-y-auto"
      style={{ background: 'rgba(0,0,0,.88)' }}
      onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      {/* Zentrierung + Seitenabstand für Mobile */}
      <div className="min-h-full flex items-center justify-center py-4 sm:py-10 px-3">
        <div
          className="relative w-full max-w-[min(680px,100%)] rounded-2xl border border-white/10 shadow-2xl"
          style={{ backgroundColor: '#0c0e13', isolation: 'isolate' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Flex-Layout: Header (fix) / Body (scrollbar) / Footer (fix) */}
          <form
            onSubmit={submit}
            className="flex flex-col"
            style={{ maxHeight: 'calc(100vh - 2rem)' }}
          >
            {/* Header */}
            <div className="shrink-0 px-4 sm:px-5 py-3 border-b border-white/10 flex items-center justify-between">
              <div className="text-base sm:text-lg font-semibold">{t('title')}</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-grid place-items-center size-8 rounded-lg hover:bg-white/10"
                aria-label={t('aria.close')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Body – scrollt eigenständig bei kleinen Displays */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm opacity-80">{t('fields.name.label')}</span>
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                  placeholder={t('fields.name.placeholder')}
                  required
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm opacity-80">{t('fields.handle.label')}</span>
                <input
                  className={inputCls}
                  value={handle}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setHandle(e.target.value)}
                  placeholder={t('fields.handle.placeholder')}
                />
                <div className="text-xs opacity-60">
                  {t('fields.handle.helperPreview', { handle: handlePreview })}
                </div>
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm opacity-80">{t('fields.description.label')}</span>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={4}
                  value={description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
                  placeholder={t('fields.description.placeholder')}
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-sm opacity-80">{t('fields.policy.label')}</span>
                <select
                  className={inputCls}
                  value={policy}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPolicy(e.target.value as JoinPolicy)}
                >
                  <option value="OPEN">{t('fields.policy.options.open')}</option>
                  <option value="INVITE_ONLY">{t('fields.policy.options.invite')}</option>
                  <option value="DOMME_ONLY">{t('fields.policy.options.dommeOnly')}</option>
                  <option value="SUB_ONLY">{t('fields.policy.options.subOnly')}</option>
                </select>
              </label>

              {/* Banner Upload */}
              <div className="space-y-2">
                <div className="text-sm opacity-80">{t('banner.label')}</div>
                <div
                  className="rounded-xl border-2 border-dashed border-white/15 p-3 sm:p-4"
                  style={{ backgroundColor: '#14161b' }}
                  onDragOver={(e) => { e.preventDefault(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) setBanner(file);
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/5"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('banner.choose')}
                    </button>
                    <div className="text-sm opacity-70">
                      {t('banner.help')}
                    </div>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="sr-only"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const file = e.target.files?.[0] ?? null;
                      setBanner(file);
                    }}
                  />

                  {preview && (
                    <div className="mt-3 relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={t('banner.previewAlt')}
                        className="h-24 w-full object-cover rounded-lg border border-white/10"
                      />
                      <button
                        type="button"
                        className="absolute top-2 right-2 inline-grid place-items-center size-8 rounded-full bg-black/70 hover:bg-black/85 border border-white/10"
                        onClick={() => setBanner(null)}
                        aria-label={t('banner.remove')}
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
                {t('actions.cancel')}
              </button>
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white disabled:opacity-50"
              >
                {loading ? t('actions.creating') : t('actions.create')}
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
        {t('button')}
      </button>
      {open && mounted && portalRef.current ? createPortal(modal, portalRef.current) : null}
    </>
  );
}
