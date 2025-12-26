// src/components/EditProfileForm.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import AvatarCropper from '@/components/AvatarCropper';
import BannerCropper from '@/components/BannerCropper';
import OfferBgCropper from '@/components/OfferBgCropper';

const AVATAR_PH = '/images/avatar-placeholder.png';
const BANNER_PH = '/images/banner-placeholder.png';

const MAX_BIO_CHARS = 77 as const;

const FONT_OPTIONS = [
  { key: 'system',  label: 'System Sans', stack: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif' },
  { key: 'serif',   label: 'Serif',       stack: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { key: 'mono',    label: 'Monospace',   stack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  { key: 'rounded', label: 'Rounded',     stack: 'system-ui, "SF Pro Rounded", "Nunito", "Quicksand", Arial, sans-serif' },
] as const;
type FontKey = (typeof FONT_OPTIONS)[number]['key'];

const KINK_OPTIONS = [
  'no limits', 'Power Exchange', 'Control & Obedience', 'Ownership', 
  'Training & Conditioning', 'Tasking', 'Financial Domination',  
  'Tribute', 'Wallet Control', 'Debt Play', 'Silent Sending', 
  'Total Power Exchange (TPE)', 'Slave / Ownership Fantasy', 'Hypnosis', 'Ignoring',
  'Bondage', 'Domination', 'Submission', 'Roleplay',
  'Praise', 'Degradation', 'Edging', 'Teasing', 'Sensory play',
  'Impact play', 'Spanking', 'Choking', 'Foot worship',
  'Petplay', 'CNC', 'Humiliation', 'Exhibitionism', 'Shemale',
  'Voyeurism', 'Anal', 'Oral', 'Threesome', 'Femdom', 'Pegging',
  'Latex', 'Leather', 'Handcuffs', 'Whips', 'SPH', 'golden shower',
] as const;

export type EditInitial = {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  role: 'domme' | 'submissive';
  nsfwDefault: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
  websiteUrl?: string;
  kinks?: string[];
};

type CheckState = 'idle' | 'checking' | 'ok' | 'taken' | 'error';

function isAvailableRes(x: unknown): x is { available: boolean } {
  return typeof x === 'object' && x !== null && 'available' in x &&
    typeof (x as { available: unknown }).available === 'boolean';
}

export default function EditProfileForm({
  locale,
  initial,
  action,
}: {
  locale: string;
  initial: EditInitial;
  action: (formData: FormData) => Promise<void>;
}) {
  const t = useTranslations('profile.editProfileForm');
  const te = useTranslations('offer.offerEditor');

  const [avatarPreview, setAvatarPreview] = React.useState<string>(initial.avatarUrl || AVATAR_PH);
  const [bannerPreview, setBannerPreview] = React.useState<string>(initial.bannerUrl || BANNER_PH);

  const [kinksOpen, setKinksOpen] = React.useState(false);
  const [kinks, setKinks] = React.useState<string[]>(initial.kinks ?? []);

  const [offerOpen, setOfferOpen] = React.useState(false);

  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);


  const [bannerCropOpen, setBannerCropOpen] = React.useState(false);
  const [bannerCropSrc, setBannerCropSrc] = React.useState<string | null>(null);
  const [bannerFile, setBannerFile] = React.useState<File | null>(null);

  // --- neue: kontrollierte Felder + Availability-Checks
  const [displayName, setDisplayName] = React.useState<string>(initial.displayName);
  const [username, setUsername] = React.useState<string>(initial.username);

  const [displayState, setDisplayState] = React.useState<CheckState>('idle');
  const [handleState, setHandleState] = React.useState<CheckState>('idle');

  const [displayMsg, setDisplayMsg] = React.useState<string>('');
  const [handleMsg, setHandleMsg] = React.useState<string>('');

  const displayDebRef = React.useRef<number | null>(null);
  const handleDebRef = React.useRef<number | null>(null);

  // helpers
  const sanitizeHandle = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const validHandle = (v: string) => /^[a-z0-9_]{3,20}$/.test(v);
  const validDisplay = (v: string) => v.trim().length >= 2 && v.trim().length <= 40;

  // skip check if unchanged (own current values)
  const unchangedHandle = username === initial.username;
  const unchangedDisplay = displayName.trim() === initial.displayName.trim();

  // API checkers
  const checkHandleAvailability = React.useCallback(async (h: string): Promise<CheckState> => {
    if (!validHandle(h)) return 'idle';
    if (unchangedHandle) return 'ok';
    setHandleState('checking'); setHandleMsg('');
    try {
      const res = await fetch(`/api/signup/handle-available?handle=${encodeURIComponent(h)}`, {
        method: 'GET',
        headers: { accept: 'application/json' }
      });
      if (res.status === 404) { setHandleState('idle'); return 'idle'; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: unknown = await res.json().catch(() => ({}));
      const available = isAvailableRes(j) ? j.available : false;
      if (available) { setHandleState('ok'); return 'ok'; }
      setHandleState('taken'); setHandleMsg(t('hints.usernamePattern'));
      return 'taken';
    } catch {
      setHandleState('error'); setHandleMsg('Check failed. Try again.');
      return 'error';
    }
  }, [unchangedHandle, t]);

  const checkDisplayNameAvailability = React.useCallback(async (name: string): Promise<CheckState> => {
    const n = name.trim();
    if (!validDisplay(n)) return 'idle';
    if (unchangedDisplay) return 'ok';
    setDisplayState('checking'); setDisplayMsg('');
    try {
      const res = await fetch(`/api/profile/displayname-available?name=${encodeURIComponent(n)}`, {
        method: 'GET',
        headers: { accept: 'application/json' }
      });
      if (res.status === 404) { setDisplayState('idle'); return 'idle'; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j: unknown = await res.json().catch(() => ({}));
      const available = isAvailableRes(j) ? j.available : false;
      if (available) { setDisplayState('ok'); return 'ok'; }
      setDisplayState('taken'); setDisplayMsg('Display name is already in use.');
      return 'taken';
    } catch {
      setDisplayState('error'); setDisplayMsg('Check failed. Try again.');
      return 'error';
    }
  }, [unchangedDisplay]);

  React.useEffect(() => {
    setAvatarPreview(initial.avatarUrl || AVATAR_PH);
    setBannerPreview(initial.bannerUrl || BANNER_PH);
    setAvatarFile(null);
    setBannerFile(null);
    setCropOpen(false);
    setBannerCropOpen(false);
    setCropSrc(null);
    setBannerCropSrc(null);
  }, [initial.avatarUrl, initial.bannerUrl]);

  // ⬇️ kontrollierte Felder nachziehen, wenn anderer User (oder Werte) kommt
  React.useEffect(() => {
    setDisplayName(initial.displayName);
    setUsername(initial.username);
  }, [initial.displayName, initial.username]);

  React.useEffect(() => {
    setKinks(initial.kinks ?? []);
  }, [initial.kinks]);

  // debounce effects
  React.useEffect(() => {
    if (displayDebRef.current) window.clearTimeout(displayDebRef.current);
    const val = displayName.trim();
    if (!val) { setDisplayState('idle'); setDisplayMsg(''); return; }
    if (!validDisplay(val)) { setDisplayState('idle'); return; }
    displayDebRef.current = window.setTimeout(() => { void checkDisplayNameAvailability(val); }, 350) as unknown as number;
    return () => { if (displayDebRef.current) window.clearTimeout(displayDebRef.current); };
  }, [displayName, checkDisplayNameAvailability]);

  React.useEffect(() => {
    if (handleDebRef.current) window.clearTimeout(handleDebRef.current);
    const val = username;
    if (!val) { setHandleState('idle'); setHandleMsg(''); return; }
    if (!validHandle(val)) { setHandleState('idle'); return; }
    handleDebRef.current = window.setTimeout(() => { void checkHandleAvailability(val); }, 350) as unknown as number;
    return () => { if (handleDebRef.current) window.clearTimeout(handleDebRef.current); };
  }, [username, checkHandleAvailability]);

  // submit guard
  const canSubmit =
    validDisplay(displayName) &&
    (unchangedDisplay || displayState === 'ok' || displayState === 'idle') &&
    validHandle(username) &&
    (unchangedHandle || handleState === 'ok' || handleState === 'idle');

  const onSubmitGuard = async (e: React.FormEvent) => {
    if (!canSubmit) {
      e.preventDefault();
      return;
    }
    e.preventDefault();

    const uploads: { avatarUrl?: string; bannerUrl?: string } = {};

    try {
      if (avatarFile) {
        const pre = await fetch(`/api/upload-urls?kind=avatars`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ files: [{ name: avatarFile.name, type: avatarFile.type }] }),
        });
        const pj = await pre.json();
        const it = pj?.items?.[0];
        if (!it?.uploadUrl || !it?.publicUrl) throw new Error('avatar presign failed');
        const put = await fetch(it.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': avatarFile.type || 'application/octet-stream' },
          body: avatarFile,
        });
        if (!put.ok) throw new Error('avatar upload failed');
        uploads.avatarUrl = it.publicUrl;
      }

      if (bannerFile) {
        const pre = await fetch(`/api/upload-urls?kind=banners`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ files: [{ name: bannerFile.name, type: bannerFile.type }] }),
        });
        const pj = await pre.json();
        const it = pj?.items?.[0];
        if (!it?.uploadUrl || !it?.publicUrl) throw new Error('banner presign failed');
        const put = await fetch(it.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': bannerFile.type || 'application/octet-stream' },
          body: bannerFile,
        });
        if (!put.ok) throw new Error('banner upload failed');
        uploads.bannerUrl = it.publicUrl;
      }
    } catch (err) {
      console.error(err);
      // TODO: toast('Upload failed')
      return;
    }

    // FormData für Server Action – nur URLs übergeben
    const fd = new FormData();
    fd.append('locale', locale);
    fd.append('displayName', displayName);
    fd.append('username', username);
    fd.append('bio', (document.querySelector('textarea[name="bio"]') as HTMLTextAreaElement)?.value ?? '');
    fd.append('location', (document.querySelector('input[name="location"]') as HTMLInputElement)?.value ?? '');
    fd.append('websiteUrl', (document.querySelector('input[name="websiteUrl"]') as HTMLInputElement)?.value ?? '');
    fd.append('role', initial.role);
    fd.append('kinks', JSON.stringify(kinks.slice(0, 10)));
    if (uploads.avatarUrl) fd.append('avatarUrl', uploads.avatarUrl);
    if (uploads.bannerUrl) fd.append('bannerUrl', uploads.bannerUrl);

    await action(fd);
  };

  const revoke = (url?: string | null) => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const onBannerChange = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBannerCropSrc(url);
    setBannerCropOpen(true);
  };

  const onAvatarChange = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    setCropOpen(true);
  };

  React.useEffect(() => {
    return () => {
      revoke(avatarPreview);
      revoke(bannerPreview);
      revoke(cropSrc);
      revoke(bannerCropSrc);
    };
  }, [avatarPreview, bannerPreview, cropSrc, bannerCropSrc]);

  const bannerH = 'clamp(160px, 26vw, 260px)';
  const avatarSize = 96;
  const avatarOverlap = 0.0;

  return (
    <form
      className="relative rounded-app border border-sub overflow-hidden shadow-app"
      onSubmit={onSubmitGuard}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="text-[18px] font-semibold">{t('header.title')}</div>
        <button
          type="submit"
          disabled={!canSubmit}
          className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed"
          title={!canSubmit ? 'Please fix issues before saving' : undefined}
        >
          {t('actions.save')}
        </button>
      </div>

      {/* Banner + Avatar */}
      <div className="relative">
        <div className="relative overflow-hidden" style={{ height: bannerH }}>
          <Image
            src={bannerPreview || BANNER_PH}
            alt={t('media.bannerAlt')}
            fill
            className="object-cover"
            sizes="(min-width:768px) 720px, 100vw"
            priority
            unoptimized
          />
          <label
            title={t('actions.changeBanner')}
            style={{ position: 'absolute', inset: 0, display: 'block', cursor: 'pointer' }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,.35)',
                border: '1px dashed rgba(255,255,255,.25)',
              }}
            />
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                borderRadius: 9999,
                border: '1px solid rgba(255,255,255,.35)',
                background: 'rgba(0,0,0,.55)',
                padding: 14,
              }}
            >
              <CameraIcon size={44} />
            </span>
            <input
              type="file"
              accept="image/*"
              name="banner"
              className="sr-only"
              aria-label={t('actions.changeBanner')}
              onChange={(e) => onBannerChange(e.currentTarget.files?.[0])}
            />
          </label>
        </div>

        <div className="absolute left-4 z-10" style={{ bottom: -(avatarSize * avatarOverlap) }}>
          <div
            className="relative rounded-full overflow-hidden ring-2 ring-black/40 border border-black/60 bg-white/10"
            style={{ width: avatarSize, height: avatarSize }}
          >
            <Image
              src={avatarPreview || AVATAR_PH}
              alt={t('media.avatarAlt')}
              fill
              className="object-cover"
              sizes={`${avatarSize}px`}
              priority
              unoptimized
            />
            <label
              title={t('actions.changeAvatar')}
              style={{ position: 'absolute', inset: 0, display: 'block', cursor: 'pointer', borderRadius: 9999 }}
            >
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'rgba(0,0,0,.45)',
                  borderRadius: '50%',
                  border: '1px dashed rgba(255,255,255,.25)',
                }}
              />
              <span
                aria-hidden
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  borderRadius: 9999,
                  border: '1px solid rgba(255,255,255,.35)',
                  background: 'rgba(0,0,0,.65)',
                  padding: 10,
                }}
              >
                <CameraIcon size={36} />
              </span>
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                aria-label={t('actions.changeAvatar')}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  onAvatarChange(file);
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>

      <div style={{ height: avatarSize * avatarOverlap }} />

      {/* Hidden */}
      <input type="hidden" name="locale" value={locale} />

      {/* Fields */}
      <div className="p-4 grid gap-3">
        <Field label={t('fields.name')}>
          <div>
            <input
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className={`w-full bg-white/5 border rounded-lg px-3 h-10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40 ${
                displayName && !validDisplay(displayName) ? 'border-red-400/70' : 'border-white/10'
              }`}
              maxLength={40}
              required
            />
            {/* Helper Row */}
            <div className="mt-1 text-xs">
              {displayName && !validDisplay(displayName) && (
                <span className="text-red-300">2–40 characters required.</span>
              )}
              {validDisplay(displayName) && !unchangedDisplay && displayState === 'checking' && (
                <span className="text-white/70">Checking availability…</span>
              )}
              {validDisplay(displayName) && !unchangedDisplay && displayState === 'taken' && (
                <span className="text-red-300">{displayMsg || 'Display name already in use.'}</span>
              )}
              {validDisplay(displayName) && !unchangedDisplay && displayState === 'error' && (
                <span className="text-yellow-200">{displayMsg || 'Check failed.'}</span>
              )}
            </div>
          </div>
        </Field>

        <Field label={t('fields.username')}>
          <div>
            <div className={`flex items-center bg-white/5 border rounded-lg px-3 h-10 ${username && !validHandle(username) ? 'border-red-400/70' : 'border-white/10'}`}>
              <span className="opacity-70 mr-1">@</span>
              <input
                name="username"
                value={username}
                onChange={(e) => setUsername(sanitizeHandle(e.target.value))}
                pattern="^[a-z0-9_]{3,20}$"
                title={t('hints.usernamePattern')}
                className="w-full bg-transparent outline-none lowercase"
                required
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            {/* Helper Row */}
            <div className="mt-1 text-xs">
              {username && !validHandle(username) && (
                <span className="text-red-300">{t('hints.usernamePattern')}</span>
              )}
              {validHandle(username) && !unchangedHandle && handleState === 'checking' && (
                <span className="text-white/70">Checking availability…</span>
              )}
              {validHandle(username) && !unchangedHandle && handleState === 'taken' && (
                <span className="text-red-300">{handleMsg || 'Username is already taken.'}</span>
              )}
              {validHandle(username) && !unchangedHandle && handleState === 'error' && (
                <span className="text-yellow-200">{handleMsg || 'Check failed.'}</span>
              )}
            </div>

            <div className="mt-2">
              <button
                type="button"
                onClick={() => setOfferOpen(true)}
                className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/5"
              >
                {t('actions.editOfferMenu')}
              </button>
            </div>
          </div>
        </Field>

        <Field label={t('fields.bio')}>
          <textarea
            name="bio"
            defaultValue={initial.bio}
            rows={4}
            maxLength={MAX_BIO_CHARS}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
          />
          <div className="mt-1 text-xs opacity-70">
            {t('hints.maxChars', { count: MAX_BIO_CHARS })}
          </div>
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('fields.location')}>
            <input
              name="location"
              defaultValue={initial.location}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
          </Field>

          <Field label="Kinks">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/70">
                {kinks.length ? `${kinks.length}/10 selected` : 'No kinks selected'}
              </div>

              <button
                type="button"
                onClick={() => setKinksOpen(true)}
                className="px-3 h-9 rounded-full border border-white/15 hover:bg-white/5"
              >
                {kinks.length ? 'Edit kinks' : 'Add kinks'}
              </button>
            </div>

            {kinks.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {kinks.map((x) => (
                  <span
                    key={x}
                    className="text-[12px] px-2 py-1 rounded-full border"
                    style={{
                      color: 'var(--purple)',
                      background: 'rgba(139,92,246,0.12)',
                      borderColor: 'rgba(139,92,246,0.25)',
                    }}
                  >
                    {x}
                  </span>
                ))}
              </div>
            )}
          </Field>

          <Field label={t('fields.website')}>
            <input
              name="websiteUrl"
              defaultValue={initial.websiteUrl ?? ''}
              placeholder={t('placeholders.website')}
              maxLength={255}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label={t('fields.role')}>
            <select
              name="role"
              defaultValue={initial.role}
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 outline-none
                        focus:ring-2 focus:ring-[var(--purple)]/40
                        disabled:cursor-not-allowed appearance-none pr-3"
              style={{ opacity: 1, color: 'inherit', WebkitAppearance: 'none', MozAppearance: 'none', appearance: 'none', backgroundImage: 'none' }}
              aria-readonly="true"
              title={t('hints.roleFixed')}
            >
              <option value={initial.role}>
                {initial.role === 'domme' ? t('roles.domme') : t('roles.submissive')}
              </option>
            </select>
            <input type="hidden" name="role" value={initial.role} />
          </Field>
        </div>

        {/* Hidden actual values for controlled inputs (server action reads these) */}
        <input type="hidden" name="displayName_controlled" value={displayName} />
        <input type="hidden" name="username_controlled" value={username} />
      </div>

      {/* Avatar Cropper */}
      <AvatarCropper
        open={cropOpen}
        imageSrc={cropSrc}
        onCancel={() => {
          setCropOpen(false);
          revoke(cropSrc);
          setCropSrc(null);
        }}
        onComplete={async (blob) => {
          setCropOpen(false);
          revoke(cropSrc);
          setCropSrc(null);
          const file = new File([blob], `avatar_${Date.now()}.png`, { type: 'image/png' });
          const url = URL.createObjectURL(file);
          setAvatarPreview((prev) => { revoke(prev); return url; });
          setAvatarFile(file); // ✨ wichtig
        }}
      />

      {/* Banner Cropper */}
      <BannerCropper
        open={bannerCropOpen}
        imageSrc={bannerCropSrc}
        onCancel={() => {
          setBannerCropOpen(false);
          revoke(bannerCropSrc);
          setBannerCropSrc(null);
        }}
        onComplete={async (blob) => {
          setBannerCropOpen(false);
          revoke(bannerCropSrc);
          setBannerCropSrc(null);
          const file = new File([blob], `banner_${Date.now()}.png`, { type: 'image/png' });
          const url = URL.createObjectURL(file);
          setBannerPreview((prev) => { revoke(prev); return url; });
          setBannerFile(file); // ✨ wichtig
        }}
      />

      {/* Offer Editor Modal */}
      <OfferEditorModal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        avatarPreview={avatarPreview || AVATAR_PH}
        displayName={displayName}
        handle={username}
        teNS={te}
      />

      <KinkPickerModal
        open={kinksOpen}
        onClose={() => setKinksOpen(false)}
        options={KINK_OPTIONS}
        value={kinks}
        onChange={setKinks}
        max={10}
      />
    </form>
  );
}

function KinkPickerModal({
  open,
  onClose,
  options,
  value,
  onChange,
  max = 10,
}: {
  open: boolean;
  onClose: () => void;
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
}) {
  const [q, setQ] = React.useState('');

  React.useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const selected = React.useMemo(() => new Set(value), [value]);

  const filtered = React.useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return options;
    return options.filter((k) => k.toLowerCase().includes(qq));
  }, [q, options]);

  const toggle = (k: string) => {
    const has = selected.has(k);
    if (has) {
      onChange(value.filter((x) => x !== k));
      return;
    }
    if (value.length >= max) return;
    onChange([...value, k]);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2200] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
    >
      <div className="w-full max-w-[720px] rounded-3xl border border-white/12 bg-[#111114] shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <div className="text-[18px] font-semibold">Select kinks</div>
            <div className="text-sm text-white/60">{value.length}/{max} selected</div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onChange([])}
              className="px-3 h-9 rounded-full border border-white/15 hover:bg-white/5"
              disabled={value.length === 0}
            >
              Clear
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-full bg-[var(--purple)] text-white hover:opacity-95"
            >
              Done
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-white/10">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search kinks…"
            className="w-full rounded-2xl bg-white/[.06] border border-white/10 px-4 py-3 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
          />
          {value.length >= max && (
            <div className="mt-2 text-sm text-yellow-200">
              Max {max} reached. Remove one to add another.
            </div>
          )}
        </div>

        {value.length > 0 && (
          <div className="px-4 pt-4">
            <div className="text-xs text-white/60 mb-2">Selected</div>
            <div className="flex flex-wrap gap-2">
              {value.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => toggle(k)}
                  className="text-[12px] px-2 py-1 rounded-full border hover:opacity-95"
                  style={{
                    color: 'var(--purple)',
                    background: 'rgba(139,92,246,0.12)',
                    borderColor: 'rgba(139,92,246,0.25)',
                  }}
                  title="Remove"
                >
                  {k} <span className="opacity-70">×</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {filtered.map((k) => {
              const isOn = selected.has(k);
              const disabled = !isOn && value.length >= max;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => !disabled && toggle(k)}
                  disabled={disabled}
                  className={`rounded-2xl border px-3 py-2 text-left text-[13px] transition
                    ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/[.04]'}
                  `}
                  style={{
                    borderColor: isOn ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.12)',
                    background: isOn ? 'rgba(139,92,246,0.14)' : 'rgba(255,255,255,0.03)',
                    color: isOn ? 'var(--purple)' : 'rgba(255,255,255,0.9)',
                  }}
                >
                  {k}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-sm text-white/60">No results.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm mb-1 opacity-80">{label}</label>
      {children}
    </div>
  );
}

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-white">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l.9-1.2A2 2 0 0 1 10.2 4h3.6a2 2 0 0 1 1.6.8L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5V17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/* ---------- OfferEditorModal (mit i18n) ---------- */
function OfferEditorModal({
  open,
  onClose,
  avatarPreview,
  displayName,
  handle,
  teNS
}: {
  open: boolean;
  onClose: () => void;
  avatarPreview: string;
  displayName: string;
  handle: string;
  teNS: ReturnType<typeof useTranslations>;
}) {
  const te = teNS;

  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState('');
  const [body, setBody] = React.useState('');
  const [bgPreview, setBgPreview] = React.useState<string | null>(null);
  const [bgFile, setBgFile] = React.useState<File | null>(null);
  const [bgOpacity, setBgOpacity] = React.useState(0.35);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const LS_FONT_KEY = React.useMemo(() => `offer_font_${handle}`, [handle]);
  const LS_COLOR_KEY = React.useMemo(() => `offer_color_${handle}`, [handle]);

  const [fontKey, setFontKey] = React.useState<FontKey>('system');
  const fontStack = React.useMemo(
    () => FONT_OPTIONS.find((f) => f.key === fontKey)?.stack || FONT_OPTIONS[0].stack,
    [fontKey]
  );

  const [fontColor, setFontColor] = React.useState<string>('#ffffff');

  const [bgCropOpen, setBgCropOpen] = React.useState(false);
  const [bgCropSrc, setBgCropSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/offers/${handle}`, { cache: 'no-store' });
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && j?.ok) {
          setTitle(j.offer?.title ?? '');
          setBody(j.offer?.text ?? '');
          setBgOpacity(Number(j.offer?.bgDim ?? 0.35));
          setBgPreview(j.offer?.bgUrl || null);
          setBgFile(null);
        }
        const storedFont = window.localStorage.getItem(LS_FONT_KEY) as FontKey | null;
        if (!cancelled && storedFont) setFontKey(storedFont);
        const storedColor = window.localStorage.getItem(LS_COLOR_KEY);
        if (!cancelled && storedColor) setFontColor(storedColor);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, handle, LS_FONT_KEY, LS_COLOR_KEY]);

  const onPickFile = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgCropSrc(url);
    setBgCropOpen(true);
  };

  const removeBg = () => {
    if (bgPreview && bgPreview.startsWith('blob:')) URL.revokeObjectURL(bgPreview);
    setBgPreview(null);
    setBgFile(null);
  };

  const save = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append('title', title);
      fd.append('text', body);
      fd.append('dim', String(bgOpacity));
      if (bgFile) fd.append('bg', bgFile);
      if (!bgFile && !bgPreview) fd.append('removeBg', '1');

      const res = await fetch(`/api/offers/${handle}`, { method: 'POST', body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);

      window.localStorage.setItem(LS_FONT_KEY, fontKey);
      window.localStorage.setItem(LS_COLOR_KEY, fontColor);

      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2000] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      onMouseDown={(e) => e.currentTarget === e.target && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[#202022] text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--purple)]/60">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white/10">
            <Image src={avatarPreview} alt="" fill className="absolute inset-0 w-full h-full object-cover" sizes="40px" unoptimized />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">{displayName}</div>
            <div className="text-white/60 text-sm">@{handle}</div>
          </div>
        </div>

        {/* Body */}
        <div className="relative p-4 isolate" style={{ fontFamily: fontStack, color: fontColor }}>
          {bgPreview && (
            <>
              <Image
                src={bgPreview}
                alt=""
                fill
                className="absolute inset-0 w-full h-full object-contain z-0 pointer-events-none"  // <- vorher object-cover
                sizes="(min-width:768px) 480px, 100vw"
                unoptimized
                aria-hidden
              />
              <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: `rgba(0,0,0,${bgOpacity})` }} aria-hidden />
            </>
          )}

          <div className="relative z-20 space-y-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs opacity-75">{te('controls.font')}</label>
                <select
                  value={fontKey}
                  onChange={(e) => setFontKey(e.target.value as FontKey)}
                  className="appearance:none bg-[#2a2a2e] text-white border border-white/20 rounded-md px-2 py-1 text-sm outline-none"
                  style={{ colorScheme: 'dark' }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs opacity-75">{te('controls.color')}</label>
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="h-8 w-10 bg-transparent border border-white/20 rounded cursor-pointer"
                  title={te('controls.textColor')}
                />
                <input
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="w-24 bg-[#2a2a2e] text-white border border-white/20 rounded px-2 py-1 text-sm outline-none"
                  aria-label={te('controls.hex')}
                />
              </div>
            </div>

            <input
              type="text"
              placeholder={te('placeholders.title')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full rounded-2xl px-4 py-2 bg-white/10 border border-white/15 outline-none"
            />
            <textarea
              placeholder={te('placeholders.text')}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={9}
              maxLength={4000}
              className="w-full rounded-2xl px-4 py-3 bg-white/10 border border-white/15 outline-none"
            />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/5"
                >
                  {bgPreview ? te('actions.changeBg') : te('actions.addBg')}
                </button>
                {bgPreview && (
                  <button
                    type="button"
                    onClick={removeBg}
                    className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/5"
                  >
                    {te('actions.remove')}
                  </button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.currentTarget.files?.[0])}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs opacity-75">{te('controls.dim')}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={bgOpacity}
                  onChange={(e) => setBgOpacity(Number(e.target.value))}
                  aria-label={te('controls.dim')}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--purple)]/60">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-full text-[var(--purple)] hover:bg-white/5"
          >
            {te('actions.cancel')}
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={save}
            className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white disabled:opacity-50"
          >
            {saving ? te('actions.saving') : te('actions.save')}
          </button>
        </div>
      </div>

      {/* Offer BG Cropper */}
      <OfferBgCropper
        open={bgCropOpen}
        imageSrc={bgCropSrc}
        onCancel={() => {
          setBgCropOpen(false);
          if (bgCropSrc) URL.revokeObjectURL(bgCropSrc);
          setBgCropSrc(null);
        }}
        onComplete={async (blob) => {
          setBgCropOpen(false);
          if (bgCropSrc) URL.revokeObjectURL(bgCropSrc);
          setBgCropSrc(null);

          const url = URL.createObjectURL(blob);
          setBgPreview((prev) => {
            if (prev && prev.startsWith('blob:')) URL.revokeObjectURL(prev);
            return url;
          });

          const croppedFile = new File([blob], `offer_bg_${Date.now()}.png`, { type: 'image/png' });
          setBgFile(croppedFile);
        }}
      />
    </div>
  );
}
