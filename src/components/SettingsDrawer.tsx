// src/components/SettingsDrawer.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { followAction, unfollowAction } from '@/app/actions/follow';

const AVATAR_PH = '/images/avatar-placeholder.png';

type Props = { open: boolean; onClose: () => void };

type Suggestion = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'DOMME' | 'SUBMISSIVE';
  isFollowing: boolean;
};

type MeBasic = {
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: 'DOMME' | 'SUBMISSIVE';
};

export default function SettingsDrawer({ open, onClose }: Props) {
  const { data: session } = useSession();
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams();

  const isAuth = Boolean(session?.user);

  const callbackUrl = React.useMemo(() => {
    const qs = search.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, search]);

  const [meBasic, setMeBasic] = React.useState<MeBasic | null>(null);

  React.useEffect(() => {
    if (!open || !isAuth) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/me/basic', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { ok?: boolean; me?: MeBasic };
        if (!json?.ok || !json?.me) return;
        if (!cancelled) setMeBasic(json.me);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAuth]);

  const u =
    (session?.user as
      | { name?: string; handle?: string; image?: string | null; role?: string | null }
      | undefined) ?? {};

  const displayName = meBasic?.displayName ?? u.name ?? 'Guest';
  const handle = meBasic?.handle ?? u.handle ?? '';
  const image = meBasic?.avatarUrl ?? u.image ?? AVATAR_PH;
  const roleRaw = (meBasic?.role ?? (u.role ?? '')).toString().toUpperCase();
  const roleLabel = roleRaw === 'DOMME' ? 'Domina' : roleRaw ? 'Sub' : '—';

  const [followers, setFollowers] = React.useState<number>(0);
  const [following, setFollowing] = React.useState<number>(0);
  const [statsError, setStatsError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open || !isAuth) return;
    let cancelled = false;
    (async () => {
      try {
        setStatsError(null);
        const res = await fetch('/api/me/stats', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { ok?: boolean; followers?: number; following?: number; error?: string } =
          await res.json();
        if (!json?.ok) throw new Error(json?.error || 'Unknown error');
        if (!cancelled) {
          setFollowers(Number(json.followers ?? 0));
          setFollowing(Number(json.following ?? 0));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Fehler beim Laden der Stats';
        if (!cancelled) setStatsError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAuth]);

  const [headline, setHeadline] = React.useState<string>('Loading…');
  const [sugs, setSugs] = React.useState<Suggestion[]>([]);
  const [suggErr, setSuggErr] = React.useState<string | null>(null);

  const loadSuggestions = React.useCallback(async () => {
    try {
      setSuggErr(null);
      setHeadline('Loading…');
      const res = await fetch('/api/suggestions', { cache: 'no-store' });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'Failed to load suggestions');
      setHeadline(String(json.headline || 'Recommended profiles'));
      setSugs(json.users as Suggestion[]);
    } catch (e) {
      setHeadline('Recommended profiles');
      setSuggErr(e instanceof Error ? e.message : 'Failed to load');
      setSugs([]);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    void loadSuggestions();
  }, [open, loadSuggestions]);

  const replaceSuggestion = React.useCallback(
    async (goneId: string) => {
      const exclude = sugs.map((x) => x.id);
      const res = await fetch(
        `/api/suggestions?take=1&exclude=${encodeURIComponent(exclude.join(','))}`,
        { cache: 'no-store' }
      ).catch(() => null);

      let next: Suggestion | null = null;
      if (res && res.ok) {
        const json = await res.json().catch(() => null);
        next = json?.users?.[0] ?? null;
      }

      setSugs((prev) => {
        const idx = prev.findIndex((p) => p.id === goneId);
        if (idx === -1) return prev;
        const copy = [...prev];
        if (next) copy[idx] = next;
        else copy.splice(idx, 1);
        return copy;
      });
    },
    [sugs]
  );

  const [mounted, setMounted] = React.useState(false);
  const [show, setShow] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  React.useEffect(() => {
    if (!open) return setShow(false);
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const hrefs = React.useMemo(
    () => ({
      profile:
        isAuth && handle
          ? `/${locale}/u/${handle}`
          : `/${locale}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      settings: `/${locale}/settings`,
      bookmarks: `/${locale}/settings/bookmarks`,
      premium: `/${locale}/settings/premium`,
      payments: `/${locale}/settings/payments`,
    }),
    [isAuth, handle, locale, callbackUrl]
  );

  if (!mounted || !open) return null;

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 2147483600,
    backgroundColor: 'rgba(0,0,0,0.60)',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
  };

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0,
    bottom: 0,
    left: 0,
    width: 'min(86vw, 420px)',
    background: '#000',
    borderRight: '1px solid rgba(255,255,255,0.10)',
    transform: show ? 'translateX(0)' : 'translateX(-100%)',
    transition: 'transform 220ms ease',
    padding: '20px 16px',
    paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
    overflowY: 'auto',
  };

  const root = (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
    >
      <aside style={panelStyle} onMouseDown={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ paddingBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 72 }}>
              <div
                style={{
                  position: 'relative',
                  width: 62,
                  height: 62,
                  borderRadius: 9999,
                  overflow: 'hidden',
                  background: 'rgba(255,255,255,0.08)',
                }}
              >
                <Image key={image} src={image} alt="Profile avatar" fill className="object-cover" sizes="64px" priority />
              </div>
              <span
                style={{
                  marginTop: 6,
                  fontSize: 11,
                  lineHeight: 1,
                  padding: '4px 8px',
                  borderRadius: 9999,
                  color: 'var(--purple)',
                  background: 'rgba(139,92,246,0.12)',
                  border: '1px solid rgba(139,92,246,0.25)',
                  whiteSpace: 'nowrap',
                }}
              >
                {roleLabel}
              </span>
            </div>

            <div style={{ lineHeight: 1.1, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontWeight: 600 }}>{displayName}</div>
              <div style={{ opacity: 0.7, fontSize: 14 }}>{handle ? `@${handle}` : '—'}</div>
            </div>
          </div>

          {isAuth && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 14 }}>
              <div title={statsError ?? undefined}>
                <span style={{ fontWeight: 600 }}>{following}</span>{' '}
                <span style={{ opacity: 0.7 }}>Following</span>
              </div>
              <div title={statsError ?? undefined}>
                <span style={{ fontWeight: 600 }}>{followers}</span>{' '}
                <span style={{ opacity: 0.7 }}>Follower</span>
              </div>
            </div>
          )}
        </div>

        {/* Menüs */}
        <nav style={{ paddingTop: 8 }}>
          <MenuItem icon={ProfileIcon} label="Profile" href={hrefs.profile} onClick={onClose} />
          <MenuItem icon={CogIcon} label="Settings" href={hrefs.settings} onClick={onClose} />
          <MenuItem icon={BookmarkIcon} label="Bookmarks" href={hrefs.bookmarks} onClick={onClose} />
          <MenuItem icon={BoltIcon} label="Premium" href={hrefs.premium} onClick={onClose} />
          <MenuItem icon={PaymentsIcon} label="Payments" href={hrefs.payments} onClick={onClose} />
        </nav>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

        <SuggestionsSection
          headline={headline}
          suggErr={suggErr}
          sugs={sugs}
          locale={locale}
          onReplace={replaceSuggestion}
        />

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

        {isAuth ? (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: `/${locale}` })}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/[.06]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            Sign out
          </button>
        ) : (
          <Link
            href={`/${locale}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            onClick={onClose}
            className="block w-full text-left px-4 py-3 rounded-lg hover:bg-white/[.06]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            Sign in
          </Link>
        )}
      </aside>
    </div>
  );

  return createPortal(root, document.body);
}

function SuggestionsSection({
  headline,
  suggErr,
  sugs,
  locale,
  onReplace,
}: {
  headline: string;
  suggErr: string | null;
  sugs: Suggestion[];
  locale: string;
  onReplace: (goneId: string) => void | Promise<void>;
}) {
  return (
    <section>
      <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>{headline}</div>

      {suggErr && (
        <div className="text-[12px]" style={{ color: '#fca5a5', marginBottom: 6 }}>
          {suggErr}
        </div>
      )}

      {sugs.map((s) => (
        <SuggestionRow key={s.id} s={s} locale={locale} onReplace={onReplace} />
      ))}

      {!suggErr && sugs.length === 0 && (
        <div className="text-[13px] text-white/70">No suggestions right now.</div>
      )}
    </section>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick,
}: {
  icon: (c: string) => React.ReactNode;
  label: string;
  href: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="group w-full px-4 py-3 flex items-center gap-5 rounded-lg hover:bg-white/[.06]"
    >
      <span className="shrink-0 grid place-items-center rounded-lg" style={{ width: 38, height: 38 }} aria-hidden="true">
        <span style={{ width: 20, height: 20, color: 'var(--purple)' }}>{Icon('currentColor')}</span>
      </span>
      <span className="text-[18px]">{label}</span>
    </Link>
  );
}

function SuggestionRow({
  s,
  locale,
  onReplace,
}: {
  s: Suggestion;
  locale: string;
  onReplace: (goneId: string) => void | Promise<void>;
}) {
  const [isFollowing, setIsFollowing] = React.useState<boolean>(s.isFollowing);
  const [pending, startTransition] = React.useTransition();
  const [fading, setFading] = React.useState(false);
  const durationMs = 300;

  return (
    <div
      className={`flex items-center justify-between gap-3 py-2 transition-all duration-300 ${
        fading ? 'opacity-0 translate-y-1' : 'opacity-100'
      }`}
      style={{ padding: '6px 0' }}
    >
      <Link href={`/${locale}/u/${s.handle}`} className="flex items-center gap-3 min-w-0" prefetch={false}>
        <div className="relative overflow-hidden rounded-full bg-white/10" style={{ width: 40, height: 40 }} aria-hidden="true">
          <Image src={s.avatarUrl || AVATAR_PH} alt="" fill className="object-cover" sizes="40px" />
        </div>
        <div className="min-w-0 leading-tight">
          <div className="font-medium truncate">{s.displayName}</div>
          <div className="text-[12px] text-white/70 truncate">@{s.handle}</div>
        </div>
      </Link>

      <form
        action={isFollowing ? unfollowAction : followAction}
        onSubmit={() => {
          const wasFollowing = isFollowing;
          startTransition(() => setIsFollowing((v) => !v));
          if (!wasFollowing) {
            setTimeout(() => setFading(true), 80);
            setTimeout(() => {
              void onReplace(s.id);
            }, 80 + durationMs);
          }
        }}
      >
        <input type="hidden" name="userId" value={s.id} />
        <button
          type="submit"
          disabled={pending}
          className={`px-3 py-1.5 rounded-full text-[13px] transition-colors ${
            isFollowing ? 'border border-white/25 hover:bg-white/5' : 'bg-[var(--purple)] text-white hover:opacity-95'
          }`}
          title={isFollowing ? 'Unfollow' : 'Follow'}
        >
          {isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      </form>
    </div>
  );
}

function ProfileIcon(c: string) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, color: c }} aria-hidden="true">
      <circle cx="12" cy="7.5" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 19a8 8 0 0 1 16 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function CogIcon(c: string) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, color: c }} aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <g stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <line x1="19.2" y1="12" x2="21.4" y2="12" />
        <line x1="4.8" y1="12" x2="2.6" y2="12" />
        <line x1="15.6" y1="5.765" x2="16.75" y2="3.773" />
        <line x1="8.4" y1="5.765" x2="7.25" y2="3.773" />
        <line x1="8.4" y1="18.235" x2="7.25" y2="20.227" />
        <line x1="15.6" y1="18.235" x2="16.75" y2="20.227" />
      </g>
    </svg>
  );
}
function BookmarkIcon(c: string) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, color: c }} aria-hidden="true">
      <path
        d="M7 4h10a1 1 0 0 1 1 1v15l-6-3-6 3V5a1 1 0 0 1 1-1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BoltIcon(c: string) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, color: c }} aria-hidden="true">
      <path
        d="M13 2 6 13h5l-1 9 8-12h-5l1-8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
function PaymentsIcon(c: string) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, color: c }} aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.5 9.5h17" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.5" cy="15.2" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
