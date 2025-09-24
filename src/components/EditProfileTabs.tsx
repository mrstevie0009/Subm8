// src/components/EditProfileTabs.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';                // <— hinzugefügt
import { useTranslations } from 'next-intl';
import BackButton from '@/components/BackButtonStandard';
import type { EditInitial } from '@/components/EditProfileForm';

/** Props vom Server-Page-Loader */
type EditFormProps = {
  locale: string;
  initial: EditInitial;
  action: (data: FormData) => Promise<void>;
};

type Props = {
  locale: string;
  userId: string;
  handle: string;
  isDomme: boolean;
  initial: EditInitial;
  action: (data: FormData) => Promise<void>;
  EditFormComponent: React.ComponentType<EditFormProps>;
};

/* ---------- Ownership Draft im LocalStorage ---------- */
type OwnershipDraft = {
  avatarDataUrl?: string;
  bannerDataUrl?: string;
  bio?: string;
  updatedAt: number;
};

const LS_KEY = (userId: string) => `ownership:profile:v1:${userId}`;

function loadDraft(userId: string): OwnershipDraft | null {
  try {
    const raw = localStorage.getItem(LS_KEY(userId));
    if (!raw) return null;
    const j = JSON.parse(raw) as unknown;
    if (j && typeof j === 'object') return j as OwnershipDraft;
  } catch {}
  return null;
}
function saveDraft(userId: string, d: OwnershipDraft) {
  try {
    localStorage.setItem(LS_KEY(userId), JSON.stringify(d));
  } catch {}
}
function clearDraft(userId: string) {
  try {
    localStorage.removeItem(LS_KEY(userId));
  } catch {}
}

/* ---------- File -> DataURL ---------- */
async function fileToDataUrl(file: File): Promise<string> {
  const MAX = 4 * 1024 * 1024; // 4 MB
  if (file.size > MAX) throw new Error('err.tooLarge');
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('err.readFile'));
    r.onload = () => res(String(r.result));
    r.readAsDataURL(file);
  });
}

/* ---------- Ownership Tab UI ---------- */
function OwnershipTab({ userId, handle }: { userId: string; handle: string }) {
  const t = useTranslations('common.ownershipTab');

  const [banner, setBanner] = React.useState<string | undefined>();
  const [avatar, setAvatar] = React.useState<string | undefined>();
  const [bio, setBio] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const d = loadDraft(userId);
    if (d) {
      setBanner(d.bannerDataUrl);
      setAvatar(d.avatarDataUrl);
      setBio(d.bio ?? '');
      setSavedAt(d.updatedAt ?? null);
    }
  }, [userId]);

  async function onPickBanner(file?: File | null) {
    if (!file) return;
    try {
      setError(null);
      const url = await fileToDataUrl(file);
      setBanner(url);
    } catch (e) {
      const msgKey = e instanceof Error ? e.message : 'err.generic';
      setError(
        msgKey === 'err.tooLarge'
          ? t('errors.tooLarge')
          : msgKey === 'err.readFile'
          ? t('errors.readBanner')
          : t('errors.readBanner')
      );
    }
  }
  async function onPickAvatar(file?: File | null) {
    if (!file) return;
    try {
      setError(null);
      const url = await fileToDataUrl(file);
      setAvatar(url);
    } catch (e) {
      const msgKey = e instanceof Error ? e.message : 'err.generic';
      setError(
        msgKey === 'err.tooLarge'
          ? t('errors.tooLarge')
          : msgKey === 'err.readFile'
          ? t('errors.readAvatar')
          : t('errors.readAvatar')
      );
    }
  }

  function onSave() {
    setSaving(true);
    try {
      const draft: OwnershipDraft = {
        avatarDataUrl: avatar,
        bannerDataUrl: banner,
        bio,
        updatedAt: Date.now(),
      };
      saveDraft(userId, draft);
      setSavedAt(draft.updatedAt);
    } catch {
      setError(t('errors.save'));
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    clearDraft(userId);
    setBanner(undefined);
    setAvatar(undefined);
    setBio('');
    setSavedAt(null);
    setError(null);
  }

  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app relative">
      {/* Header + Save */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10 bg-white/[.02]">
        <h2 className="text-[18px] font-semibold">{t('header.title')}</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="px-3 h-9 rounded-full border border-white/25 hover:bg-white/5"
            disabled={saving}
            title={t('header.clearTitle')}
          >
            {t('actions.reset')}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="px-4 h-9 rounded-full bg-[var(--purple)] text-white hover:opacity-95"
          >
            {saving ? t('actions.saving') : t('actions.save')}
          </button>
        </div>
      </div>

      {/* Banner */}
      <div className="relative h-[220px] md:h-[260px] bg-white/[.04] border-b border-white/10">
        {banner ? (
          <Image
            src={banner}
            alt=""
            fill
            className="object-cover"
            sizes="(min-width:768px) 720px, 100vw"
            unoptimized
            priority={false}
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-white/60">
            <span>{t('placeholders.banner')}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/35 pointer-events-none" />
        <label className="absolute right-3 bottom-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 cursor-pointer hover:bg-black/70">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            aria-label={t('actions.changeBanner')}
            onChange={(e) => onPickBanner(e.target.files?.[0] ?? null)}
          />
          <span>{t('actions.changeBanner')}</span>
        </label>
      </div>

      {/* Avatar + Bio */}
      <div className="px-4 pb-5 -mt-10">
        <div className="flex items-end gap-3">
          <div
            className="relative rounded-full overflow-hidden border border-white/20 bg-white/10"
            style={{ width: 96, height: 96 }}
          >
            {avatar ? (
              <Image
                src={avatar}
                alt=""
                fill
                className="object-cover"
                sizes="96px"
                unoptimized
                priority={false}
              />
            ) : (
              <div className="w-full h-full grid place-items-center text-white/60">
                {t('placeholders.avatar')}
              </div>
            )}
            <label
              className="absolute right-0 bottom-0 m-1 inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/65 border border-white/20 cursor-pointer hover:bg-black/75"
              title={t('actions.addAvatar')}
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
              />
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M12 5v14M5 12h14" />
              </svg>
            </label>
          </div>

          <div className="mb-2">
            <div className="text-white/70 text-sm">@{handle}</div>
            {savedAt && (
              <div className="text-white/50 text-[12px]">
                {t('labels.savedAt', { ts: new Date(savedAt).toLocaleString() })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-[12px] text-white/70 mb-1">{t('labels.bio')}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            maxLength={280}
            placeholder={t('placeholders.bio')}
            className="w-full rounded-xl bg-white/[.03] border border-white/10 px-3 py-2 outline-none"
          />
          <div className="mt-1 text-[12px] text-white/50">
            {t('labels.counter', { n: bio.length, max: 280 })}
          </div>
        </div>

        {error && (
          <div className="mt-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Tabs-Hülle mit BackArrow ---------- */
export default function EditProfileTabs({
  locale,
  userId,
  handle,
  isDomme,
  initial,
  action,
  EditFormComponent,
}: Props): React.ReactElement {
  const tTabs = useTranslations('common.editTabs');
  const [tab, setTab] = React.useState<'general' | 'ownership'>('general');

  React.useEffect(() => {
    if (!isDomme && tab === 'ownership') setTab('general');
  }, [isDomme, tab]);

  return (
    <main className="mx-auto px-3" style={{ maxWidth: 760 }}>
      {/* Sticky Header: Back + Tabs */}
      <div className="sticky top-[calc(var(--header-h,56px)+8px)] z-10 bg-black/55 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-2 px-2 py-2">
          <BackButton
            ariaLabel="Back"
            fallbackHref={`/${locale}/u/${handle}`}
            className="inline-flex items-center justify-center p-1 rounded hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[var(--purple)]/40"
            style={{ color: 'var(--purple)' }}
          >
            <ChevronLeftIcon />
          </BackButton>

          <button
            type="button"
            onClick={() => setTab('general')}
            className={`px-3 py-1.5 rounded-full text-sm ${
              tab === 'general'
                ? 'bg-[var(--purple)]/25 text-[var(--purple)] border border-[var(--purple)]/30'
                : 'border border-white/15 hover:bg-white/5'
            }`}
            aria-current={tab === 'general' ? 'page' : undefined}
          >
            {tTabs('tabs.general')}
          </button>

          {isDomme && (
            <button
              type="button"
              onClick={() => setTab('ownership')}
              className={`px-3 py-1.5 rounded-full text-sm ${
                tab === 'ownership'
                  ? 'bg-[var(--purple)]/25 text-[var(--purple)] border border-[var(--purple)]/30'
                  : 'border border-white/15 hover:bg-white/5'
              }`}
              aria-current={tab === 'ownership' ? 'page' : undefined}
            >
              {tTabs('tabs.ownership')}
            </button>
          )}
        </div>
      </div>

      <div className="mt-3" />

      {tab === 'general' ? (
        <EditFormComponent locale={locale} initial={initial} action={action} />
      ) : (
        <OwnershipTab userId={userId} handle={handle} />
      )}
    </main>
  );
}

/* ===== Icons ===== */
function ChevronLeftIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      aria-hidden="true"
    >
      <path d="m15 6-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
