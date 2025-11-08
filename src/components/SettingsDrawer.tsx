//src/components/SettingsDrawer.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useSearchParams } from 'next/navigation';
import { followAction, unfollowAction } from '@/app/actions/follow';
import { UserBadges } from '@/components/UserBadges';

const AVATAR_PH = '/images/avatar-placeholder.png';
const isPremiumActive = (iso?: string | null) =>
  !!iso && new Date(iso).getTime() > Date.now();

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
  premiumUntil?: string | null;
  isFirstAdopter?: boolean;
};

type LinkedMini = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'DOMME' | 'SUBMISSIVE';
};

export default function SettingsDrawer({ open, onClose }: Props) {
  const { data: session } = useSession();
  const locale = useLocale();
  const pathname = usePathname();
  const search = useSearchParams();
  const t = useTranslations('settings.settings');
  const b = useTranslations('common');

  const isAuth = Boolean(session?.user);

  // --- move ALL hooks to top-level (no conditional calls)
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
    | {
        name?: string;
        handle?: string;
        image?: string | null;
        role?: string | null;
        premiumUntil?: string | null;
        isFirstAdopter?: boolean;
      }
    | undefined) ?? {};

  const displayName = meBasic?.displayName ?? u.name ?? t('guest');
  const handle = meBasic?.handle ?? u.handle ?? '';
  const image = meBasic?.avatarUrl ?? u.image ?? AVATAR_PH;
  const roleRaw = (meBasic?.role ?? (u.role ?? '')).toString().toUpperCase();
  const roleLabel =
    roleRaw === 'DOMME' ? t('roleDomme')
    : roleRaw === 'SUBMISSIVE' ? t('roleSub')
    : t('noHandle');

  const [followers, setFollowers] = React.useState<number>(0);
  const [following, setFollowing] = React.useState<number>(0);
  const [statsError, setStatsError] = React.useState<string | null>(null);
  const premiumUntil = meBasic?.premiumUntil ?? u.premiumUntil ?? null;
  const isFirstAdopter = (meBasic?.isFirstAdopter ?? u.isFirstAdopter) ? true : false;

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
        if (!json?.ok) throw new Error(json?.error || 'error');
        if (!cancelled) {
          setFollowers(Number(json.followers ?? 0));
          setFollowing(Number(json.following ?? 0));
        }
      } catch {
        if (!cancelled) setStatsError(t('statsError'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, isAuth, t]);

  // --- Vorschläge ---
  const [headline, setHeadline] = React.useState<string>(t('loading'));
  const [sugs, setSugs] = React.useState<Suggestion[]>([]);
  const [suggErr, setSuggErr] = React.useState<string | null>(null);

  const loadSuggestions = React.useCallback(async () => {
    try {
      setSuggErr(null);
      setHeadline(t('loading'));
      const res = await fetch('/api/suggestions', { cache: 'no-store' });
      const json = await res.json();
      if (!json?.ok) throw new Error(json?.error || 'Failed to load suggestions');
      setHeadline(String(json.headline || t('recommended')));
      setSugs(json.users as Suggestion[]);
    } catch (e) {
      setHeadline(t('recommended'));
      setSuggErr(e instanceof Error ? e.message : 'Failed to load');
      setSugs([]);
    }
  }, [t]);

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

  // --- Multi-Account ---
  const [accounts, setAccounts] = React.useState<LinkedMini[]>([]);
  const [canAddMore, setCanAddMore] = React.useState<boolean>(false);
  const [sheetOpen, setSheetOpen] = React.useState<boolean>(false);
  const [connecting, setConnecting] = React.useState<boolean>(false);
  const [connErr, setConnErr] = React.useState<string | null>(null);

  const loadAccounts = React.useCallback(async () => {
    if (!isAuth) return;
    const r = await fetch('/api/account-links', { cache: 'no-store' });
    const j = await r.json().catch(() => null);
    if (j?.ok) {
      setAccounts((j.items || []) as LinkedMini[]);
      setCanAddMore(Boolean(j.canAddMore));
    }
  }, [isAuth]);

  React.useEffect(() => {
    if (open && isAuth) void loadAccounts();
  }, [open, isAuth, loadAccounts]);

  async function switchTo(userId: string) {
    await fetch('/api/account-links?action=switch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (typeof window !== 'undefined') window.location.reload();
  }

  const hrefs = React.useMemo(
    () => ({
      profile:
        isAuth && handle
          ? `/${locale}/u/${handle}`
          : `/${locale}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
      settings: `/${locale}/settings`,
      bookmarks: `/${locale}/settings/bookmarks`,
      premium: `/${locale}/settings/premium`,
      payments: `/${locale}/settings/payments`
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
    WebkitBackdropFilter: 'blur(6px)'
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
    overflowY: 'auto'
  };

async function smartSignOut() {
  try {
    const r = await fetch('/api/account-links?action=signout-active', {
      method: 'POST',
      headers: { 'content-type': 'application/json' }
    });
    const j = await r.json().catch(() => null);

    if (!r.ok || !j?.ok) {
      await signOut({ callbackUrl: `/${locale}` });
      return;
    }
    if (j.fullSignOut) {
      await signOut({ callbackUrl: `/${locale}` });
    } else {
      if (typeof window !== 'undefined') window.location.reload();
    }
  } catch {
    await signOut({ callbackUrl: `/${locale}` });
  }
}

  const root = (
    <div
      style={overlayStyle}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={t('aria')}
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
                  background: 'rgba(255,255,255,0.08)'
                }}
              >
                <Image
                  key={image}
                  src={image}
                  alt={t('avatarAlt')}
                  fill
                  className="object-cover"
                  sizes="64px"
                  priority
                />
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
                  whiteSpace: 'nowrap'
                }}
              >
                {roleLabel}
              </span>
            </div>

            <div style={{ lineHeight: 1.1, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{displayName}</span>
                <UserBadges
                  role={(roleRaw === 'DOMME' ? 'DOMME' : 'SUBMISSIVE')}
                  isPremium={isPremiumActive(premiumUntil)}
                  isFirstAdopter={isFirstAdopter}
                  size={16}
                  className="-ml-0.5 translate-y-[1px]"
                  premiumLabel={b('badges.verified')}
                  firstAdopterLabel={b('badges.firstAdopter')}
                />
              </div>
              <div style={{ opacity: 0.7, fontSize: 14 }}>{handle ? `@${handle}` : t('noHandle')}</div>
            </div>

            {/* Rechts: Avatare + Plus */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {accounts
                // nur Accounts anzeigen, die NICHT der aktuell aktive sind
                .filter((a) => a.handle !== handle)
                .map((a) => (
                  <button
                    key={a.id}
                    title={t('switchToHandle', { handle: a.handle })}
                    onClick={() => switchTo(a.id)}
                    className="relative h-8 w-8 rounded-full overflow-hidden border border-white/20 hover:opacity-90"
                    aria-label={t('switchToName', { name: a.displayName })}
                  >
                    <Image src={a.avatarUrl || AVATAR_PH} alt="" fill sizes="32px" className="object-cover" />
                  </button>
                ))}
              {isAuth && canAddMore && (
                <button
                  onClick={() => { setConnErr(null); setSheetOpen(true); }}
                  title='addAccount'
                  className="grid place-items-center h-8 w-8 rounded-full border border-white/20 hover:bg-white/10"
                  aria-label='addAccount'
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" aria-hidden="true">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {isAuth && (
            <div style={{ display: 'flex', gap: 16, marginTop: 10, fontSize: 14 }}>
              {handle ? (
                <>
                  <Link
                    href={`/${locale}/u/${handle}/followers?tab=following`}
                    prefetch={false}
                    onClick={onClose}
                    className="group inline-flex items-baseline gap-1.5 hover:opacity-95"
                    title={statsError ?? undefined}
                    aria-label={`${following.toLocaleString(locale)} ${t('statsFollowing')}`}
                  >
                    <span className="tabular-nums font-extrabold text-white">
                      {following.toLocaleString(locale)}
                    </span>
                    <span className="text-white/70 group-hover:text-white/80">
                      {t('statsFollowing')}
                    </span>
                  </Link>

                  <Link
                    href={`/${locale}/u/${handle}/followers?tab=followers`}
                    prefetch={false}
                    onClick={onClose}
                    className="group inline-flex items-baseline gap-1.5 hover:opacity-95"
                    title={statsError ?? undefined}
                    aria-label={`${followers.toLocaleString(locale)} ${t('statsFollowers')}`}
                  >
                    <span className="tabular-nums font-extrabold text-white">
                      {followers.toLocaleString(locale)}
                    </span>
                    <span className="text-white/70 group-hover:text-white/80">
                      {t('statsFollowers')}
                    </span>
                  </Link>
                </>
              ) : (
                // Fallback: kein Handle bekannt → nicht klickbar
                <>
                  <div title={statsError ?? undefined}>
                    <span style={{ fontWeight: 600 }}>{following}</span>{' '}
                    <span style={{ opacity: 0.7 }}>{t('statsFollowing')}</span>
                  </div>
                  <div title={statsError ?? undefined}>
                    <span style={{ fontWeight: 600 }}>{followers}</span>{' '}
                    <span style={{ opacity: 0.7 }}>{t('statsFollowers')}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Menüs */}
        <nav style={{ paddingTop: 8 }}>
          <MenuItem icon={ProfileIcon} label={t('menu.profile')} href={hrefs.profile} onClick={onClose} />
          <MenuItem icon={CogIcon} label={t('menu.settings')} href={hrefs.settings} onClick={onClose} />
          <MenuItem icon={BookmarkIcon} label={t('menu.bookmarks')} href={hrefs.bookmarks} onClick={onClose} />
          <MenuItem icon={BoltIcon} label={t('menu.premium')} href={hrefs.premium} onClick={onClose} />
          <MenuItem icon={PaymentsIcon} label={t('menu.payments')} href={hrefs.payments} onClick={onClose} />
        </nav>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

        <SuggestionsSection
          headline={headline}
          suggErr={suggErr}
          sugs={sugs}
          locale={locale}
          onReplace={replaceSuggestion}
          t={t}
        />

        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '10px 0' }} />

        {isAuth ? (
          <button
            type="button"
            onClick={() => void smartSignOut()}
            className="w-full text-left px-4 py-3 rounded-lg hover:bg-white/[.06]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {t('signOut')}
          </button>
        ) : (
          <Link
            href={`/${locale}/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            onClick={onClose}
            className="block w-full text-left px-4 py-3 rounded-lg hover:bg-white/[.06]"
            style={{ color: 'rgba(255,255,255,0.85)' }}
          >
            {t('signIn')}
          </Link>
        )}
      </aside>

      {/* Bottom-Sheet */}
      {sheetOpen &&
        createPortal(
          <AccountSheet
            onClose={() => setSheetOpen(false)}
            onConnected={() => {
              setSheetOpen(false);
              void loadAccounts();
              if (typeof window !== 'undefined') window.location.reload();
            }}
            busy={connecting}
            setBusy={setConnecting}
            err={connErr}
            setErr={setConnErr}
          />,
          document.body
        )}
    </div>
  );

  return createPortal(root, document.body);
}

function AccountSheet({
  onClose,
  onConnected,
  busy,
  setBusy,
  err,
  setErr
}: {
  onClose: () => void;
  onConnected: () => void;
  busy: boolean;
  setBusy: (b: boolean) => void;
  err: string | null;
  setErr: (e: string | null) => void;
}) {
  const tA = useTranslations('auth.accountSheet');
  const [tab, setTab] = React.useState<'existing' | 'new'>('existing');

  // --- existing
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');

  // --- new
  const [email, setEmail] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [pw2, setPw2] = React.useState('');
  const [role, setRole] = React.useState<'SUBMISSIVE' | 'DOMME'>('SUBMISSIVE');

  // --- validation helpers
  const baseInput =
    'h-11 w-full rounded-xl bg-black/30 border border-white/20 text-white placeholder:text-white/60 focus:border-white/40 focus:ring-2 focus:ring-white/20 outline-none px-3 transition';
  const tabBtn =
    'px-4 py-1.5 rounded-full text-sm transition border border-white/15';
  const primaryBtn =
    'h-11 w-full rounded-full font-semibold bg-[var(--purple)]/85 hover:bg-[var(--purple)] text-white transition disabled:opacity-50 disabled:cursor-not-allowed';
  const ghostBtn =
    'px-2.5 py-1.5 rounded-md hover:bg-white/10 transition text-white/90';

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const sanitizeHandle = (v: string) => v.toLowerCase().replace(/[^a-z0-9_]/g, '');
  const validHandle = (v: string) => /^[a-z0-9_]{3,20}$/.test(v);
  const okPw = pw.length >= 8;
  const pwMatch = pw && pw2 && pw === pw2;

  // --- availability state machines
  type CheckState = 'idle' | 'checking' | 'ok' | 'taken' | 'error';
  const [handleState, setHandleState] = React.useState<CheckState>('idle');
  const [emailState, setEmailState] = React.useState<CheckState>('idle');

  const [handleMsg, setHandleMsg] = React.useState<string>('');
  const [emailMsg, setEmailMsg] = React.useState<string>('');

  const handleDebRef = React.useRef<number | null>(null);
  const emailDebRef = React.useRef<number | null>(null);

  // --- effects: Esc to close
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // --- API: check handle availability
  const checkHandleAvailability = React.useCallback(async (h: string): Promise<CheckState> => {
    if (!validHandle(h)) return 'idle';
    setHandleState('checking');
    setHandleMsg('');
    try {
      const res = await fetch(`/api/signup/handle-available?handle=${encodeURIComponent(h)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      if (res.status === 404) { setHandleState('idle'); return 'idle'; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json().catch(() => ({}));
      const available = typeof j?.available === 'boolean' ? j.available : false;
      if (available) {
        setHandleState('ok'); setHandleMsg(''); return 'ok';
      } else {
        setHandleState('taken'); setHandleMsg('Username is already taken.'); return 'taken';
      }
    } catch {
      setHandleState('error'); setHandleMsg('Check failed. Try again.'); return 'error';
    }
  }, []);

  // --- API: check email availability
  const checkEmailAvailability = React.useCallback(async (e: string): Promise<CheckState> => {
    if (!isValidEmail(e)) return 'idle';
    setEmailState('checking');
    setEmailMsg('');
    try {
      const res = await fetch(`/api/signup/email-available?email=${encodeURIComponent(e)}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
      });
      if (res.status === 404) { setEmailState('idle'); return 'idle'; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json().catch(() => ({}));
      const available = typeof j?.available === 'boolean' ? j.available : false;
      if (available) {
        setEmailState('ok'); setEmailMsg(''); return 'ok';
      } else {
        setEmailState('taken'); setEmailMsg('Email already in use.'); return 'taken';
      }
    } catch {
      setEmailState('error'); setEmailMsg('Check failed. Try again.'); return 'error';
    }
  }, []);

  // --- debounce: handle
  React.useEffect(() => {
    if (handleDebRef.current) window.clearTimeout(handleDebRef.current);
    if (!handle) { setHandleState('idle'); setHandleMsg(''); return; }
    if (!validHandle(handle)) { setHandleState('idle'); return; }
    handleDebRef.current = window.setTimeout(() => { void checkHandleAvailability(handle); }, 350) as unknown as number;
    return () => { if (handleDebRef.current) window.clearTimeout(handleDebRef.current); };
  }, [handle, checkHandleAvailability]);

  // --- debounce: email
  React.useEffect(() => {
    if (emailDebRef.current) window.clearTimeout(emailDebRef.current);
    if (!email) { setEmailState('idle'); setEmailMsg(''); return; }
    if (!isValidEmail(email)) { setEmailState('idle'); return; }
    emailDebRef.current = window.setTimeout(() => { void checkEmailAvailability(email); }, 350) as unknown as number;
    return () => { if (emailDebRef.current) window.clearTimeout(emailDebRef.current); };
  }, [email, checkEmailAvailability]);

  // --- actions
  async function connectExisting() {
    setErr(null);
    setBusy(true);
    const r = await fetch('/api/account-links?action=connect-existing', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identifier, password })
    });
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok || !j?.ok) {
      setErr(j?.error || `HTTP ${r.status}`);
      return;
    }
    onConnected();
  }

  async function createNew() {
    // Frontend guard (zusätzlich zur Servervalidierung)
    if (!isValidEmail(email) || emailState === 'taken') return;
    if (!validHandle(handle) || handleState === 'taken') return;
    if (!okPw || !pwMatch) return;

    setErr(null);
    setBusy(true);
    const r = await fetch('/api/account-links?action=create-new', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email,
        handle: sanitizeHandle(handle),
        password: pw,
        role
      })
    });
    const j = await r.json().catch(() => null);
    setBusy(false);
    if (!r.ok || !j?.ok) {
      setErr(j?.error || `HTTP ${r.status}`);
      return;
    }
    onConnected();
  }

  const createDisabled =
    busy ||
    !isValidEmail(email) ||
    emailState === 'taken' ||
    !validHandle(handle) ||
    handleState === 'taken' ||
    !okPw ||
    !pwMatch;

  return (
    <div
      className="fixed inset-0 z-[2147483603] grid place-items-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={tA('title')}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Sheet/Card */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[min(640px,95vw)] rounded-2xl bg-white/5 backdrop-blur-xl ring-1 ring-white/40 shadow-[0_10px_50px_rgba(0,0,0,.6)] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-[rgba(162,89,255,0.45)] px-6 pt-5 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white text-lg font-semibold">{tA('title')}</div>
              <div className="mt-2 inline-flex rounded-full bg-black/25 p-1 ring-1 ring-white/10">
                <button
                  type="button"
                  onClick={() => setTab('existing')}
                  className={`${tabBtn} ${tab === 'existing' ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'}`}
                >
                  {tA('tabExisting')}
                </button>
                <button
                  type="button"
                  onClick={() => setTab('new')}
                  className={`${tabBtn} ${tab === 'new' ? 'bg-white/20 text-white' : 'text-white/80 hover:text-white'}`}
                >
                  {tA('tabNew')}
                </button>
              </div>
            </div>
            <button onClick={onClose} className={ghostBtn} aria-label={tA('close')}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {tab === 'existing' ? (
            <div className="grid gap-4">
              <div>
                <label className="block text-sm text-white/90 mb-1">{tA('phIdentifier')}</label>
                <input
                  className={baseInput}
                  placeholder={tA('phIdentifier')}
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  autoComplete="username email"
                />
              </div>

              <div>
                <label className="block text-sm text-white/90 mb-1">{tA('phPassword')}</label>
                <input
                  type="password"
                  className={baseInput}
                  placeholder={tA('phPassword')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              {err && <div className="text-sm text-red-300 -mt-1">{err}</div>}

              <button
                disabled={busy || !identifier || !password}
                onClick={() => void connectExisting()}
                className={primaryBtn}
              >
                {tA('btnConnect')}
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {/* Email */}
              <div>
                <label className="block text-sm text-white/90 mb-1">{tA('phEmail')}</label>
                <input
                  className={`${baseInput} ${email && !isValidEmail(email) ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                  placeholder={tA('phEmail')}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                />
                {/* helper row */}
                <div className="mt-1 text-[12px]">
                  {email && !isValidEmail(email) && (
                    <span className="text-red-300">Invalid email format.</span>
                  )}
                  {isValidEmail(email) && emailState === 'checking' && (
                    <span className="text-white/70">Checking availability…</span>
                  )}
                  {isValidEmail(email) && emailState === 'taken' && (
                    <span className="text-red-300">{emailMsg || 'Email already in use.'}</span>
                  )}
                  {isValidEmail(email) && emailState === 'error' && (
                    <span className="text-yellow-200">{emailMsg || 'Check failed.'}</span>
                  )}
                </div>
              </div>

              {/* Handle + Role */}
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div>
                  <label className="block text-sm text-white/90 mb-1">@{tA('phHandle')}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 select-none pointer-events-none">@</span>
                    <input
                      className={`${baseInput} pl-8 lowercase ${handle && !validHandle(handle) ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                      placeholder={tA('phHandle')}
                      value={handle}
                      onChange={(e) => setHandle(sanitizeHandle(e.target.value))}
                      autoCapitalize="none"
                      spellCheck={false}
                    />
                  </div>
                  {/* helper row */}
                  <div className="mt-1 text-[12px]">
                    {handle && !validHandle(handle) && (
                      <span className="text-red-300">3–20 chars, a–z, 0–9, _</span>
                    )}
                    {validHandle(handle) && handleState === 'checking' && (
                      <span className="text-white/70">Checking availability…</span>
                    )}
                    {validHandle(handle) && handleState === 'taken' && (
                      <span className="text-red-300">{handleMsg || 'Username is already taken.'}</span>
                    )}
                    {validHandle(handle) && handleState === 'error' && (
                      <span className="text-yellow-200">{handleMsg || 'Check failed.'}</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-white/90 mb-1">
                    {tA('roleSub')} / {tA('roleDomme')}
                  </label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      className={`px-3 h-11 rounded-xl border ${role === 'SUBMISSIVE' ? 'bg-white/15 text-white border-white/30' : 'border-white/15 text-white/80 hover:text-white'}`}
                      onClick={() => setRole('SUBMISSIVE')}
                      title={tA('roleSub')}
                    >
                      😊 {tA('roleSub')}
                    </button>
                    <button
                      type="button"
                      className={`px-3 h-11 rounded-xl border ${role === 'DOMME' ? 'bg-white/15 text-white border-white/30' : 'border-white/15 text-white/80 hover:text-white'}`}
                      onClick={() => setRole('DOMME')}
                      title={tA('roleDomme')}
                    >
                      👑 {tA('roleDomme')}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password + Repeat */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-white/90 mb-1">
                    {tA('phPwMin', { min: 8 })}
                  </label>
                  <input
                    type="password"
                    className={`${baseInput} ${pw && !okPw ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                    placeholder={tA('phPwMin', { min: 8 })}
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
                <div>
                  <label className="block text-sm text-white/90 mb-1">
                    {tA('phPwMin', { min: 8 })} — repeat
                  </label>
                  <input
                    type="password"
                    className={`${baseInput} ${pw2 && !pwMatch ? 'border-red-400/70 focus:ring-red-400/30' : ''}`}
                    placeholder="repeat password"
                    value={pw2}
                    onChange={(e) => setPw2(e.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                  {pw2 && !pwMatch && (
                    <div className="mt-1 text-[12px] text-red-300">Passwords do not match.</div>
                  )}
                </div>
              </div>

              {err && <div className="text-sm text-red-300 -mt-1">{err}</div>}

              <button
                disabled={createDisabled}
                onClick={() => void createNew()}
                className={primaryBtn}
              >
                {tA('btnCreate')}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 pb-5">
          <button type="button" onClick={onClose} className={ghostBtn}>
            {tA('close')}
          </button>
        </div>
      </div>
    </div>
  );
}





function SuggestionsSection({
  headline,
  suggErr,
  sugs,
  locale,
  onReplace,
  t
}: {
  headline: string;
  suggErr: string | null;
  sugs: Suggestion[];
  locale: string;
  onReplace: (goneId: string) => void | Promise<void>;
  t: ReturnType<typeof useTranslations<'settings'>>;
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
        <SuggestionRow key={s.id} s={s} locale={locale} onReplace={onReplace} t={t} />
      ))}

      {!suggErr && sugs.length === 0 && (
        <div className="text-[13px] text-white/70">{t('suggestionsEmpty')}</div>
      )}
    </section>
  );
}

function MenuItem({
  icon: Icon,
  label,
  href,
  onClick
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
  t
}: {
  s: Suggestion;
  locale: string;
  onReplace: (goneId: string) => void | Promise<void>;
  t: ReturnType<typeof useTranslations<'settings'>>;
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
          title={isFollowing ? t('unfollow') : t('follow')}
        >
          {isFollowing ? t('unfollow') : t('follow')}
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
