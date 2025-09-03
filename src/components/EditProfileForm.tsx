// src/components/EditProfileForm.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import AvatarCropper from "@/components/AvatarCropper";
import BannerCropper from "@/components/BannerCropper";
import OfferBgCropper from "@/components/OfferBgCropper";
import { blobToDataUrl } from "@/utils/blobToDataUrl";

const AVATAR_PH = "/images/avatar-placeholder.png";
const BANNER_PH = "/images/banner-placeholder.png";

// === Bio-Limit
const MAX_BIO_CHARS = 77 as const;

// === Font-Optionen (Frontend-only, per localStorage gespeichert)
const FONT_OPTIONS = [
  {
    key: "system",
    label: "System Sans",
    stack:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif',
  },
  { key: "serif", label: "Serif", stack: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif' },
  { key: "mono", label: "Monospace", stack: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' },
  { key: "rounded", label: "Rounded", stack: 'system-ui, "SF Pro Rounded", "Nunito", "Quicksand", Arial, sans-serif' },
] as const;
type FontKey = (typeof FONT_OPTIONS)[number]["key"];

export type EditInitial = {
  displayName: string;
  username: string;
  bio: string;
  location: string;
  role: "domme" | "submissive";
  nsfwDefault: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
};

export default function EditProfileForm({
  locale,
  initial,
  action,
}: {
  locale: string;
  initial: EditInitial;
  action: (formData: FormData) => Promise<void>;
}) {
  const [avatarPreview, setAvatarPreview] = React.useState<string>(initial.avatarUrl || AVATAR_PH);
  const [bannerPreview, setBannerPreview] = React.useState<string>(initial.bannerUrl || BANNER_PH);

  // ---- Offer Modal State
  const [offerOpen, setOfferOpen] = React.useState(false);

  // ---- Avatar Cropper (rund)
  const [cropOpen, setCropOpen] = React.useState(false);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const [avatarCroppedDataUrl, setAvatarCroppedDataUrl] = React.useState<string>("");

  // ---- Banner Cropper (3:1, rechteckig)
  const [bannerCropOpen, setBannerCropOpen] = React.useState(false);
  const [bannerCropSrc, setBannerCropSrc] = React.useState<string | null>(null);
  const [bannerCroppedDataUrl, setBannerCroppedDataUrl] = React.useState<string>("");

  const revoke = (url?: string | null) => {
    if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
  };

  // Banner-Datei wählen -> Crop öffnen
  const onBannerChange = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBannerCropSrc(url);
    setBannerCropOpen(true);
  };

  // Avatar-Datei wählen -> Crop öffnen
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const bannerH = "clamp(160px, 26vw, 260px)";
  const avatarSize = 96;
  const avatarOverlap = 0.0;

  return (
    <form
      action={action}
      method="post"
      encType="multipart/form-data"
      className="relative rounded-app border border-sub overflow-hidden shadow-app"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="text-[18px] font-semibold">Edit profile</div>
        <button type="submit" className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95">
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
            unoptimized
          />
          <label
            title="Change banner"
            style={{ position: "absolute", inset: 0, display: "block", cursor: "pointer" }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,.35)",
                border: "1px dashed rgba(255,255,255,.25)",
              }}
            />
            <span
              aria-hidden
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                borderRadius: 9999,
                border: "1px solid rgba(255,255,255,.35)",
                background: "rgba(0,0,0,.55)",
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
              unoptimized
            />
            <label
              title="Change avatar"
              style={{ position: "absolute", inset: 0, display: "block", cursor: "pointer", borderRadius: 9999 }}
            >
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,.45)",
                  borderRadius: "50%",
                  border: "1px dashed rgba(255,255,255,.25)",
                }}
              />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%, -50%)",
                  borderRadius: 9999,
                  border: "1px solid rgba(255,255,255,.35)",
                  background: "rgba(0,0,0,.65)",
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
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Abstand */}
      <div style={{ height: avatarSize * avatarOverlap }} />

      {/* Hidden Fields (Crops als Data-URL an Server) */}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="avatarCropped" value={avatarCroppedDataUrl} />
      <input type="hidden" name="bannerCropped" value={bannerCroppedDataUrl} />

      {/* Form Fields */}
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

          {/* Offer Button */}
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setOfferOpen(true)}
              className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/5"
            >
              Edit Offer Menu
            </button>
          </div>
        </Field>

        <Field label="Bio">
          <textarea
            name="bio"
            defaultValue={initial.bio}
            rows={4}
            maxLength={MAX_BIO_CHARS}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
          />
          <div className="mt-1 text-xs opacity-70">Max. {MAX_BIO_CHARS} Zeichen</div>
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
              disabled
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 h-10 outline-none
                        focus:ring-2 focus:ring-[var(--purple)]/40
                        disabled:cursor-not-allowed appearance-none pr-3"
              style={{
                opacity: 1,                 // nicht ausgegraut
                color: "inherit",
                WebkitAppearance: "none",   // Safari/iOS
                MozAppearance: "none",      // Firefox
                appearance: "none",         // Standard
                backgroundImage: "none",    // falls ein UA-Icon per BG gesetzt wird
              }}
              aria-readonly="true"
              title="Role is fixed"
            >
              <option value={initial.role}>
                {initial.role === "domme" ? "Domme" : "Submissive"}
              </option>
            </select>

            {/* disabled Felder werden nicht gesendet -> hidden mitschicken */}
            <input type="hidden" name="role" value={initial.role} />
          </Field>
        </div>
      </div>

      {/* Avatar Cropper (rund) */}
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
          const b64 = await blobToDataUrl(blob);
          setAvatarCroppedDataUrl(b64);
        }}
      />

      {/* Banner Cropper (3:1 rechteckig) */}
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
          const url = URL.createObjectURL(blob);
          setBannerPreview((prev) => {
            revoke(prev);
            return url;
          });
          const b64 = await blobToDataUrl(blob);
          setBannerCroppedDataUrl(b64);
        }}
      />

      {/* Offer Editor Modal */}
      <OfferEditorModal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        avatarPreview={avatarPreview || AVATAR_PH}
        displayName={initial.displayName}
        handle={initial.username}
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
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-white">
      <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2l.9-1.2A2 2 0 0 1 10.2 4h3.6a2 2 0 0 1 1.6.8L16.3 6h1.2A2.5 2.5 0 0 1 20 8.5V17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8.5Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/* ---------- OfferEditorModal ---------- */
function OfferEditorModal({
  open,
  onClose,
  avatarPreview,
  displayName,
  handle,
}: {
  open: boolean;
  onClose: () => void;
  avatarPreview: string;
  displayName: string;
  handle: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [bgPreview, setBgPreview] = React.useState<string | null>(null);
  const [bgFile, setBgFile] = React.useState<File | null>(null);
  const [bgOpacity, setBgOpacity] = React.useState(0.35);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  // Font + Color Auswahl (persistiert per localStorage)
  const LS_FONT_KEY = React.useMemo(() => `offer_font_${handle}`, [handle]);
  const LS_COLOR_KEY = React.useMemo(() => `offer_color_${handle}`, [handle]);

  const [fontKey, setFontKey] = React.useState<FontKey>("system");
  const fontStack = React.useMemo(
    () => FONT_OPTIONS.find((f) => f.key === fontKey)?.stack || FONT_OPTIONS[0].stack,
    [fontKey]
  );

  const [fontColor, setFontColor] = React.useState<string>("#ffffff");

  // --- Offer BG Cropper (16:9)
  const [bgCropOpen, setBgCropOpen] = React.useState(false);
  const [bgCropSrc, setBgCropSrc] = React.useState<string | null>(null);

  // Daten laden
  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/offers/${handle}`, { cache: "no-store" });
        const j = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && j?.ok) {
          setTitle(j.offer?.title ?? "");
          setBody(j.offer?.text ?? "");
          setBgOpacity(Number(j.offer?.bgDim ?? 0.35));
          setBgPreview(j.offer?.bgUrl || null);
          setBgFile(null);
        }
        // Font + Color aus localStorage laden
        const storedFont = window.localStorage.getItem(LS_FONT_KEY) as FontKey | null;
        if (storedFont) setFontKey(storedFont);
        const storedColor = window.localStorage.getItem(LS_COLOR_KEY);
        if (storedColor) setFontColor(storedColor);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, handle, LS_FONT_KEY, LS_COLOR_KEY]);

  // Datei wählen -> Crop öffnen
  const onPickFile = (file?: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setBgCropSrc(url);
    setBgCropOpen(true);
  };

  const removeBg = () => {
    if (bgPreview && bgPreview.startsWith("blob:")) URL.revokeObjectURL(bgPreview);
    setBgPreview(null);
    setBgFile(null);
  };

  const save = async () => {
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("title", title);
      fd.append("text", body);
      fd.append("dim", String(bgOpacity));
      if (bgFile) fd.append("bg", bgFile);
      if (!bgFile && !bgPreview) fd.append("removeBg", "1");

      const res = await fetch(`/api/offers/${handle}`, { method: "POST", body: fd });
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
        {/* Kopf */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--purple)]/60">
          <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white/10">
            <Image src={avatarPreview} alt="" fill className="absolute inset-0 w-full h-full object-cover" sizes="40px" unoptimized />
          </div>
          <div className="leading-tight">
            <div className="font-semibold">{displayName}</div>
            <div className="text-white/60 text-sm">@{handle}</div>
          </div>
        </div>

        {/* Inhalt */}
        <div className="relative p-4 isolate" style={{ fontFamily: fontStack, color: fontColor }}>
          {bgPreview && (
            <>
              <Image
                src={bgPreview}
                alt=""
                fill
                className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
                sizes="(min-width:768px) 480px, 100vw"
                unoptimized
                aria-hidden
              />
              <div className="absolute inset-0 z-10 pointer-events-none" style={{ background: `rgba(0,0,0,${bgOpacity})` }} aria-hidden />
            </>
          )}

          <div className="relative z-20 space-y-3">
            {/* Font & Color-Auswahl */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-xs opacity-75">Font</label>
                <select
                  value={fontKey}
                  onChange={(e) => setFontKey(e.target.value as FontKey)}
                  className="appearance-none bg-[#2a2a2e] text-white border border-white/20 rounded-md px-2 py-1 text-sm outline-none"
                  style={{ colorScheme: "dark" }}
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs opacity-75">Color</label>
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="h-8 w-10 bg-transparent border border-white/20 rounded cursor-pointer"
                  title="Text color"
                />
                <input
                  value={fontColor}
                  onChange={(e) => setFontColor(e.target.value)}
                  className="w-24 bg-[#2a2a2e] text-white border border-white/20 rounded px-2 py-1 text-sm outline-none"
                  aria-label="Hex"
                />
              </div>
            </div>

            <input
              type="text"
              placeholder="Title…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              className="w-full rounded-2xl px-4 py-2 bg-white/10 border border-white/15 outline-none"
            />
            <textarea
              placeholder="Text…"
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
                  {bgPreview ? "Change background" : "Add background"}
                </button>
                {bgPreview && (
                  <button
                    type="button"
                    onClick={removeBg}
                    className="px-3 py-1.5 rounded-full border border-white/15 hover:bg-white/5"
                  >
                    Remove
                  </button>
                )}
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onPickFile(e.currentTarget.files?.[0])}
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs opacity-75">Dim</span>
                <input type="range" min={0} max={1} step={0.05} value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--purple)]/60">
          <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-full text-[var(--purple)] hover:bg-white/5">
            Cancel
          </button>
          <button type="button" disabled={saving || loading} onClick={save} className="px-3 py-1.5 rounded-full bg-[var(--purple)] text-white disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Offer BG Cropper (16:9) */}
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

          // Vorschau
          const url = URL.createObjectURL(blob);
          setBgPreview((prev) => {
            if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
            return url;
          });

          // Blob -> File für Upload
          const croppedFile = new File([blob], `offer_bg_${Date.now()}.png`, { type: "image/png" });
          setBgFile(croppedFile);
        }}
      />
    </div>
  );
}
