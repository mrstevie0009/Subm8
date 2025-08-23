'use client';

import * as React from 'react';
import Image from 'next/image';
import AvatarCropper from '@/components/AvatarCropper';

const AVATAR_PH = '/images/avatar-placeholder.png';
const BANNER_PH = '/images/banner-placeholder.png';

export type EditInitial = {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  role: 'domme' | 'submissive';
  nsfwDefault: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
};

export default function EditProfileForm({
  locale,
  initial,
}: {
  locale: string;
  initial: EditInitial;
}) {
  const [avatarPreview, setAvatarPreview] = React.useState<string>(
    initial.avatarUrl || AVATAR_PH
  );
  const [bannerPreview, setBannerPreview] = React.useState<string>(
    initial.bannerUrl || BANNER_PH
  );

  // ---- Cropper Steuerung
  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [avatarCroppedDataUrl, setAvatarCroppedDataUrl] = React.useState<string>('');

  const revoke = (url?: string | null) => {
    if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
  };

  const onBannerChange = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBannerPreview((prev) => {
      revoke(prev);
      return url;
    });
  };

  // WICHTIG: hier wird NICHT die Vorschau gesetzt! Nur Cropper öffnen.
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bannerH = 'clamp(160px, 26vw, 260px)';
  const avatarSize = 96;
  const avatarOverlap = 0.0;

  return (
    <form className="rounded-app border border-sub overflow-hidden shadow-app">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="text-[18px] font-semibold">Edit profile</div>
        <button
          type="submit"
          className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95"
        >
          Save
        </button>
      </div>

      {/* Banner + Avatar */}
      <div className="relative">
        {/* Banner */}
        <div className="relative overflow-hidden" style={{ height: bannerH }}>
          <Image
            src={bannerPreview || BANNER_PH}
            alt="Banner"
            fill
            className="object-cover"
            sizes="(min-width:768px) 720px, 100vw"
            priority
          />
          <label
            title="Change banner"
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
              className="sr-only"
              onChange={(e) => onBannerChange(e.currentTarget.files?.[0])}
            />
          </label>
        </div>

        {/* Avatar */}
        <div className="absolute left-4 z-10" style={{ bottom: -(avatarSize * avatarOverlap) }}>
          <div
            className="relative rounded-full overflow-hidden ring-2 ring-black/40 border border-black/60 bg-white/10"
            style={{ width: avatarSize, height: avatarSize }}
          >
            <Image
              src={avatarPreview || AVATAR_PH}
              alt="Avatar"
              fill
              className="object-cover"
              sizes={`${avatarSize}px`}
              priority
            />
            <label
              title="Change avatar"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'block',
                cursor: 'pointer',
                borderRadius: 9999,
              }}
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
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  onAvatarChange(file);
                  // Input zurücksetzen, damit man die gleiche Datei erneut wählen kann
                  e.currentTarget.value = '';
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Abstand */}
      <div style={{ height: avatarSize * avatarOverlap }} />

      {/* Hidden Felder (z.B. für Server Action) */}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="avatarCropped" value={avatarCroppedDataUrl} />

      {/* Form Felder */}
      <div className="p-4 grid gap-3">
        <Field label="Name">
          <input
            name="displayName"
            defaultValue={initial.displayName}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            maxLength={40}
            required
          />
        </Field>

        <Field label="Username">
          <div className="flex items-center bg-white/5 border border-white/10 rounded-lg px-3 h-10">
            <span className="opacity-70 mr-1">@</span>
            <input
              name="username"
              defaultValue={initial.username}
              pattern="^[a-z0-9_]{3,20}$"
              title="3–20 Zeichen, a–z, 0–9, _"
              className="w-full bg-transparent outline-none"
              required
            />
          </div>
        </Field>

        <Field label="Bio">
          <textarea
            name="bio"
            defaultValue={initial.bio}
            rows={4}
            maxLength={300}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Location">
            <input
              name="location"
              defaultValue={initial.location}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            />
          </Field>
          <Field label="Role">
            <select
              name="role"
              defaultValue={initial.role}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            >
              <option value="domme">Domme</option>
              <option value="submissive">Submissive</option>
            </select>
          </Field>
        </div>

        <label className="inline-flex items-center gap-2 mt-1">
          <input
            type="checkbox"
            name="nsfwDefault"
            defaultChecked={initial.nsfwDefault}
            className="size-4"
          />
          <span className="text-sm opacity-90">Posts default to NSFW</span>
        </label>
      </div>

      {/* Cropper Modal */}
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

          const url = URL.createObjectURL(blob);
          setAvatarPreview((prev) => {
            revoke(prev);
            return url;
          });

          // Optional: für Server Action als Base64 mitgeben
          const b64 = await blobToDataURL(blob);
          setAvatarCroppedDataUrl(b64);
        }}
      />
    </form>
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
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="text-white"
    >
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l.9-1.2A2 2 0 0 1 10.2 4h3.6a2 2 0 0 1 1.6.8L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5V17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}
