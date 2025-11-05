// src/app/[locale]/chat/[id]/info/page.tsx
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import AvatarCropper from '@/components/AvatarCropper';

type Member = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  role?: 'ADMIN' | 'MEMBER';
};

type ApiGroupMember = {
  role?: 'ADMIN' | 'MEMBER' | string;
  user?: { id?: string; displayName?: string; handle?: string; avatarUrl?: string | null };
  id?: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string | null;
};
type GroupDto = { ok: boolean; group?: { members?: ApiGroupMember[] } | null };

export default function GroupInfoPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const t = useTranslations('chat.chat.groupInfo');
  const router = useRouter();

  const [title, setTitle] = React.useState<string>('Group');
  const [members, setMembers] = React.useState<Member[]>([]);
  const [memberCount, setMemberCount] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);

  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [cropSrc, setCropSrc] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = React.useState(false);

  // NEW: actions UI state
  const [addOpen, setAddOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [muted, setMuted] = React.useState<boolean>(false);
  const [savingMute, setSavingMute] = React.useState(false);

  // Initial load (meta + members)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);

        // Meta
        const m = await fetch(`/api/chat/meta/${id}`, { cache: 'no-store' });
        const mj = await m.json().catch(() => null);
        if (!cancelled && mj?.ok) {
          setTitle(mj.title || 'Group');
          setAvatarUrl(mj.avatarUrl ?? null);
          setIsAdmin(mj.role === 'ADMIN');
        }

        // Members
        const g = await fetch(`/api/chat/group/${id}`, { cache: 'no-store' });
        const gj = (await g.json().catch(() => null)) as GroupDto | null;

        if (!cancelled && gj?.ok) {
          const raw = Array.isArray(gj.group?.members) ? gj.group!.members! : [];
          const mapped: Member[] = raw.map((x): Member => ({
            id: String(x.user?.id ?? x.id ?? ''),
            displayName: x.user?.displayName ?? x.displayName ?? 'User',
            handle: x.user?.handle ?? x.handle ?? 'user',
            avatarUrl: x.user?.avatarUrl ?? x.avatarUrl ?? null,
            role: x.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
          }));
          setMembers(mapped);
          setMemberCount(mapped.length);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Fetch current mute state (optional convenience endpoint)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/chat/group/${id}/settings`, { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!cancelled && j?.ok && typeof j.settings?.muted === 'boolean') {
          setMuted(!!j.settings.muted);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [id]);

  // --------- Actions (handlers) ----------
  async function onToggleMute() {
    if (savingMute) return;
    setSavingMute(true);
    try {
      const next = !muted;
      setMuted(next); // optimistic
      const r = await fetch(`/api/chat/group/${id}/mute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ muted: next }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    } catch {
      setMuted((v) => !v); // revert
    } finally {
      setSavingMute(false);
    }
  }

  async function onLeaveGroup() {
    try {
      const r = await fetch(`/api/chat/group/${id}/leave`, { method: 'POST' });
      if (!r.ok) {
        // fallback alt route
        await fetch(`/api/chat/group/${id}/members/me`, { method: 'DELETE' });
      }
    } catch {}
    router.replace(`/${locale}/chat`);
  }

  async function onReportConversation(reason: string) {
    try {
      const r = await fetch(`/api/chat/group/${id}/report`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!r.ok) throw new Error('report failed');
      setReportOpen(false);
      alert('Thanks. We received your report.');
    } catch {
      alert('Report failed');
    }
  }

  async function onAddPeople(userIds: string[]) {
    if (!userIds.length) return;
    const r = await fetch(`/api/chat/group/${id}/invite`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberIds: userIds }),
    });
    if (!r.ok) {
      alert('Could not add members.');
      return;
    }
    // refresh members
    try {
      const g = await fetch(`/api/chat/group/${id}`, { cache: 'no-store' });
      const gj = (await g.json().catch(() => null)) as GroupDto | null;
      if (gj?.ok) {
        const raw = Array.isArray(gj.group?.members) ? gj.group!.members! : [];
        const mapped: Member[] = raw.map((x): Member => ({
          id: String(x.user?.id ?? x.id ?? ''),
          displayName: x.user?.displayName ?? x.displayName ?? 'User',
          handle: x.user?.handle ?? x.handle ?? 'user',
          avatarUrl: x.user?.avatarUrl ?? x.avatarUrl ?? null,
          role: x.role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
        }));
        setMembers(mapped);
        setMemberCount(mapped.length);
      }
    } catch {}
    setAddOpen(false);
  }

  return (
    <main className="mx-auto w-full max-w-[760px] px-3 pb-8">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="flex items-center gap-3 px-1 py-2">
          <button
            onClick={() => router.back()}
            aria-label={t('back')}
            className="inline-grid place-items-center rounded-lg hover:bg-white/5"
            style={{ width: 36, height: 36 }}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M15 6 9 12l6 6" />
            </svg>
          </button>

          <div className="min-w-0">
            <div className="text-[18px] font-semibold leading-tight">{t('title')}</div>
            <div className="truncate text-[13px] text-white/70">{title}</div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <section className="pt-3">
        <div
          className="relative h-[160px] overflow-hidden rounded-2xl border border-white/10"
          style={{
            background:
              'radial-gradient(1200px 240px at 20% -10%, rgba(139,92,246,.25), transparent 55%), linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02))',
          }}
        >
          {/* Inhalt sitzt IN der Karte */}
          <div className="absolute inset-0 flex items-end gap-3 p-3">
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-white/15 bg-white/10 shadow-lg">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="" fill sizes="80px" className="object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center">
                  <svg viewBox="0 0 24 24" width="26" height="26" className="opacity-90" fill="currentColor">
                    <path d="M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm-6.5 4.5a5.5 5.5 0 0 0-5.5 5.5h16a5.5 5.5 0 0 0-5.5-5.5h-5Z" />
                  </svg>
                </div>
              )}

              {isAdmin && (
                <button
                  type="button"
                  aria-label="Change avatar"
                  title="Change avatar"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-1 right-1 grid h-8 w-8 place-items-center rounded-full border border-white/25
                                bg-black/70 backdrop-blur transition-all duration-150 shadow-md hover:bg-black/80 hover:shadow-lg
                                ring-1 ring-white/15"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z" />
                  </svg>
                </button>
              )}
            </div>

            <div className="min-w-0 pb-1">
              <h1 className="truncate text-[20px] font-semibold">{title}</h1>
              <span className="mt-1 inline-block rounded-full border border-white/15 bg-white/10 px-2 py-[2px] text-[12px] text-white/80">
                {loading ? t('loadingMembers') : t('members', { count: memberCount })}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <section className="mt-4 grid grid-cols-2 gap-2">
        <ActionButton onClick={() => setAddOpen(true)}>
          <IconUserPlus />
          <span>{t('addPeople')}</span>
        </ActionButton>

        <ActionButton onClick={onToggleMute}>
          <IconBellOff />
          <span>{savingMute ? t('saving') : muted ? t('unmuteMentions') : t('muteMentions')}</span>
        </ActionButton>

        <ActionButton onClick={() => setReportOpen(true)}>
          <IconFlag />
          <span>{t('reportConversation')}</span>
        </ActionButton>

        <ActionButton tone="danger" onClick={() => setLeaveOpen(true)}>
          <IconLeave />
          <span>{t('leaveConversation')}</span>
        </ActionButton>
      </section>

      {/* People */}
      <section className="mt-6">
        <h2 className="mb-2 text-[15px] font-semibold">{t('people')}</h2>

        <div className="overflow-hidden rounded-2xl border border-white/10">
          {loading && (
            <div className="space-y-2 p-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl p-2">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" />
                  <div className="flex-1">
                    <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
                    <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && members.length === 0 && (
            <div className="p-4 text-white/70">{t('noMembers')}</div>
          )}

          {!loading &&
            members.map((m) => (
              <Link
                key={m.id}
                href={`/${locale}/u/${m.handle}`}
                prefetch={false}
                className="group flex items-center gap-3 border-t border-white/10 p-3 first:border-t-0 hover:bg-white/[.04]"
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-full border border-white/10">
                  <Image
                    src={m.avatarUrl || '/images/avatar-placeholder.png'}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium group-hover:opacity-95">{m.displayName}</div>
                  <div className="truncate text-[12px] text-white/70">@{m.handle}</div>
                </div>

                {m.role === 'ADMIN' && (
                  <span className="rounded-full border border-white/15 bg-white/10 px-2 py-[2px] text-[11px]">Admin</span>
                )}
              </Link>
            ))}
        </div>
      </section>

      {/* Hidden file input for avatar change */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.currentTarget.files?.[0];
          if (!f) return;
          const url = URL.createObjectURL(f);
          setCropSrc(url);
          setPickerOpen(true);
          e.currentTarget.value = '';
        }}
      />

      {/* Avatar cropper */}
      <AvatarCropper
        open={pickerOpen}
        imageSrc={cropSrc}
        onCancel={() => {
          if (cropSrc) URL.revokeObjectURL(cropSrc);
          setPickerOpen(false);
          setCropSrc(null);
        }}
        onComplete={async (blob) => {
          setUploading(true);
          try {
            const fd = new FormData();
            fd.append('file', new File([blob], 'avatar.png', { type: 'image/png' }));
            const res = await fetch(`/api/chat/group/${id}/avatar`, { method: 'PUT', body: fd });
            const j = await res.json().catch(() => null);
            if (j?.ok && j.url) {
              setAvatarUrl(j.url);
              try {
                window.dispatchEvent(
                  new CustomEvent('chat:group-avatar-updated', {
                    detail: { conversationId: String(id), url: j.url },
                  }),
                );
              } catch {}
            } else {
              alert('Could not update avatar');
            }
          } finally {
            if (cropSrc) URL.revokeObjectURL(cropSrc);
            setPickerOpen(false);
            setCropSrc(null);
            setUploading(false);
          }
        }}
      />

      {uploading && (
        <div className="fixed inset-0 z-[2147483599] grid place-items-center bg-black/40">
          <div className="rounded-xl border border-white/15 bg-black/80 px-4 py-2 text-sm">Uploading…</div>
        </div>
      )}

      {/* Action modals */}
      {addOpen && (
        <AddPeopleModal onClose={() => setAddOpen(false)} onConfirm={(ids) => onAddPeople(ids)} />
      )}

      {reportOpen && (
        <ReportModal
          onClose={() => setReportOpen(false)}
          onConfirm={(txt) => onReportConversation(txt)}
        />
      )}

      {leaveOpen && (
        <ConfirmModal
          title={t('leave.confirmTitle')}
          message={t('leave.confirmBody')}
          confirmLabel={t('leave.confirmCta')}
          tone="danger"
          onCancel={() => setLeaveOpen(false)}
          onConfirm={() => onLeaveGroup()}
        />
      )}
    </main>
  );
}

/* ——— small UI helpers ——— */
function ActionButton({
  children,
  onClick,
  tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
}) {
  const base =
    'flex items-center gap-2 rounded-2xl border px-3 py-2 text-left transition hover:opacity-95';
  const cls =
    tone === 'danger'
      ? `${base} border-red-300/25 bg-red-400/10 text-red-200`
      : `${base} border-white/12 bg-white/[.06] text-white`;
  return (
    <button type="button" className={cls} onClick={onClick}>
      {children}
    </button>
  );
}

function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M15.5 19.5a4.5 4.5 0 0 0-9 0h9Z" />
      <circle cx="11" cy="9" r="3.5" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  );
}
function IconBellOff() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      <path d="M18.63 13A17.89 17.89 0 0 1 18 8a6 6 0 1 0-12 0v1" />
      <path d="M2 2l20 20M4.25 4.25A6.47 6.47 0 0 0 4 8c0 4-2 5-2 5h16" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 21V4a2 2 0 0 1 2-2h12l-2 4 2 4H6" />
    </svg>
  );
}
function IconLeave() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

/* ——— inline modals ——— */
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[2147483600]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="absolute inset-0 grid place-items-center px-3">{children}</div>
    </div>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Overlay>
      <div className="w-full max-w-[420px] rounded-2xl border border-white/12 bg-neutral-900 shadow-2xl p-4">
        <div className="text-[16px] font-semibold">{title}</div>
        <div className="mt-2 text-sm text-white/80">{message}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={`px-3 py-1.5 rounded-lg ${
              tone === 'danger' ? 'bg-red-500/80 text-white' : 'bg-[var(--purple)] text-white'
            } hover:opacity-95`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function ReportModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (text: string) => void;
}) {
  const [txt, setTxt] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  return (
    <Overlay>
      <div className="w-full max-w-[520px] rounded-2xl border border-white/12 bg-neutral-900 shadow-2xl p-4">
        <div className="text-[16px] font-semibold">Report conversation</div>
        <div className="mt-2 text-sm text-white/80">Tell us briefly what happened. Moderators will review it.</div>
        <textarea
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          className="mt-3 w-full h-28 rounded-xl bg-white/[.06] border border-white/10 p-3 outline-none"
          placeholder="Reason…"
        />
        <div className="mt-3 flex justify-end gap-2">
          <button className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={!txt.trim() || busy}
            className={`px-3 py-1.5 rounded-lg ${
              !txt.trim() || busy ? 'bg-white/10 text-white/50 cursor-not-allowed' : 'bg-[var(--purple)] text-white hover:opacity-95'
            }`}
            onClick={async () => {
              if (!txt.trim()) return;
              setBusy(true);
              try {
                await onConfirm(txt.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            Send report
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function AddPeopleModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  const [qLive, setQLive] = React.useState('');
  const [q, setQ] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<
    Array<{ id: string; handle: string; displayName: string; avatarUrl?: string | null }>
  >([]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const t = setTimeout(() => setQ(qLive.trim().replace(/^@+/, '')), 180);
    return () => clearTimeout(t);
  }, [qLive]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!q) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' });
        const j = await r.json().catch(() => null);
        const list = Array.isArray(j?.items) ? j.items : Array.isArray(j?.users) ? j.users : [];
        if (!cancelled) setResults(list || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Overlay>
      <div className="w-full max-w-[560px] rounded-2xl border border-white/12 bg-neutral-900 shadow-2xl">
        <div className="p-3 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold">Add people</div>
          <button className="p-2 rounded-lg hover:bg-white/10" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width="18" height="18">
              <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-3">
          <input
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            onFocus={() => {
              if (!qLive.startsWith('@')) setQLive((s) => '@' + s);
            }}
            placeholder="Search by handle…"
            className="w-full rounded-xl bg-white/[.06] border border-white/10 pl-3 pr-3 py-2 outline-none focus:ring-2 focus:ring-[var(--purple)]/30"
            autoFocus
          />

          <div className="mt-3 max-h-[50vh] overflow-auto space-y-1">
            {loading && <div className="text-sm text-white/70 px-1 py-2">Loading…</div>}
            {!loading && !results.length && q && (
              <div className="text-sm text-white/70 px-1 py-2">No results.</div>
            )}
            {results.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/10 text-left"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={u.avatarUrl || '/images/avatar-placeholder.png'}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{u.displayName}</div>
                  <div className="truncate text-xs text-white/70">@{u.handle}</div>
                </div>
                <input type="checkbox" className="size-5 accent-[var(--purple)]" readOnly checked={selected.has(u.id)} />
              </button>
            ))}
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button className="px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/10" onClick={onClose}>
              Cancel
            </button>
            <button
              className={`px-3 py-1.5 rounded-lg ${
                selected.size ? 'bg-[var(--purple)] text-white hover:opacity-95' : 'bg-white/10 text-white/50 cursor-not-allowed'
              }`}
              onClick={() => onConfirm(Array.from(selected))}
              disabled={!selected.size}
            >
              Add {selected.size ? `(${selected.size})` : ''}
            </button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
