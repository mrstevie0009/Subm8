// src/components/Header.tsx
'use client';

import Link from 'next/link';
import Image from 'next/image';
import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useScrollHide } from '../hooks/useScrollHide';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';

function withQuery(
  pathname: string | null,
  search: ReturnType<typeof useSearchParams>,
  patch: Record<string, string | undefined>
) {
  const p = pathname ?? '/';
  const next = new URLSearchParams(search.toString());
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') next.delete(k);
    else next.set(k, v);
  }
  const qs = next.toString();
  return qs ? `${p}?${qs}` : p;
}

/* ================== Filter Toggle (UI, hängt außerhalb) ================== */
function FeedFilterToggle({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const t = useTranslations('common.feedFilter');
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const btnRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [panelLeft, setPanelLeft] = React.useState(0);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- URL → lokale Auswahl ---
  const urlFeedSet = React.useMemo(() => {
    const v = searchParams.get('feed');
    const vals = (v ? v.split(',') : []).filter(Boolean);
    const allowed = new Set(['following', 'new', 'top']);
    return new Set(vals.filter(x => allowed.has(x)) as Array<'following' | 'new' | 'top'>);
  }, [searchParams]);

  const urlRole = ((): 'dommes' | 'subs' | null => {
    const v = searchParams.get('role');
    if (v === 'dommes' || v === 'subs') return v;
    return null;
  })();

  // State: Following (bool), FeedType (new/top/null), Role (dommes/subs/null)
  const [following, setFollowing] = React.useState<boolean>(urlFeedSet.has('following'));
  const [feedType, setFeedType] = React.useState<'new' | 'top' | null>(
   urlFeedSet.has('new') ? 'new' : urlFeedSet.has('top') ? 'top' : 'new'
  );
  const [roleType, setRoleType] = React.useState<'dommes' | 'subs' | null>(urlRole);

  // Beim Öffnen aus URL spiegeln
  React.useEffect(() => {
    if (!open) return;
    setFollowing(urlFeedSet.has('following'));
    setFeedType(urlFeedSet.has('new') ? 'new' : urlFeedSet.has('top') ? 'top' : 'new');
    setRoleType(urlRole);
  }, [open, urlFeedSet, urlRole]);

  // Outside click / ESC
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!open) return;
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open, setOpen]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setOpen]);

  // Panel im Viewport halten
  React.useLayoutEffect(() => {
    const update = () => {
      const wrap = wrapRef.current, btn = btnRef.current, panel = panelRef.current;
      if (!wrap || !btn || !panel) return;
      const wrapBox = wrap.getBoundingClientRect();
      const btnBox  = btn.getBoundingClientRect();
      const panelW  = panel.getBoundingClientRect().width || 240;
      const vw = window.innerWidth, margin = 8;
      const desiredLeft = btnBox.left + btnBox.width / 2 - panelW / 2;
      const clampedLeft = Math.max(margin, Math.min(vw - margin - panelW, desiredLeft));
      setPanelLeft(clampedLeft - wrapBox.left);
    };
    if (open) {
      update();
      const r = () => update();
      window.addEventListener('resize', r);
      return () => window.removeEventListener('resize', r);
    }
  }, [open]);

  // Apply → URL schreiben
  const apply = () => {
    const feedParts: string[] = [];
    if (following) feedParts.push('following');
    if (feedType)  feedParts.push(feedType);
    const feedCsv = feedParts.join(',');
    const roleVal = roleType ?? undefined;

    router.push(
      withQuery(pathname, searchParams, {
        feed: feedCsv || undefined,
        role: roleVal,
      }),
      { scroll: false }
    );
    setOpen(false);
  };

  const clear = () => {
    setFollowing(false);
    setFeedType('new');  // Standard wieder aktiv
    setRoleType(null);
  };

  // Checkbox/Häkchen
  const Check = ({ active }: { active: boolean }) => (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-md ring-1 ring-[var(--purple)]/45">
      {active ? (
        <svg viewBox="0 0 20 20" className="w-3.5 h-3.5" aria-hidden="true" fill="currentColor" style={{ color: 'var(--purple)' }}>
          <path fillRule="evenodd" d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.3a1 1 0 0 1-1.43.02L3.29 9.53a1 1 0 1 1 1.42-1.41l3.06 3.08 6.49-6.58a1 1 0 0 1 1.444-.33z" clipRule="evenodd"/>
        </svg>
      ) : (
        <span className="w-3.5 h-3.5 rounded-[4px] bg-transparent" />
      )}
    </span>
  );

  return (
    <div ref={wrapRef} className="relative z-[70]">
      {/* Button */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('toggleAria')}
        className="relative grid place-items-center w-10 h-10 rounded-b-xl rounded-t-none border border-black bg-black"
      >
        <svg viewBox="0 0 24 24" className="w-6 h-6" aria-hidden="true">
          <defs>
            <linearGradient id="gf" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#A855F7" />
              <stop offset="1" stopColor="#7C3AED" />
            </linearGradient>
          </defs>
          <path d="M3 5a1 1 0 0 1 1-1h16a1 1 0 0 1 .8 1.6l-6.3 8.75a1 1 0 0 0-.2.6V19a1 1 0 0 1-.55.9l-3 1.5A1 1 0 0 1 9 20.5v-4.55a1 1 0 0 0-.2-.6L2.2 6.6A1 1 0 0 1 3 5Z" fill="url(#gf)" />
        </svg>
      </button>

      {/* Panel */}
      <div
        ref={panelRef}
        className={`absolute top-full mt-3 w-60 rounded-2xl border border-white/10 bg-black origin-top overflow-hidden
          ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'} transition-all duration-150 shadow-[0_18px_50px_-14px_rgba(0,0,0,.65)]`}
        style={{ left: panelLeft }}
      >
        <div className="px-4 py-3 border-b border-white/10 text-[13px] text-white/70">
          {t('title')}
        </div>

        {/* Section 1: Following */}
        <ul className="py-2">
          <li>
            <button
              type="button"
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 ${following ? 'bg-white/[.06]' : ''}`}
              onClick={() => setFollowing(v => !v)}
            >
              <Check active={following} />
              <span className="text-[15px] font-medium">{t('following')}</span>
            </button>
          </li>
        </ul>

        {/* Divider */}
        <div className="mx-3 my-1 h-px bg-white/10" />

        {/* Section 2: New / Top (mutually exclusive, or none) */}
        <ul className="py-2">
          {(
            [
              { key: 'new', label: t('newPosts') },
              { key: 'top', label: t('topPosts') },
            ] as Array<{ key: 'new' | 'top'; label: string }>
          ).map(o => {
            const active = feedType === o.key;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 ${active ? 'bg-white/[.06]' : ''}`}
                  onClick={() => setFeedType(prev => (prev === o.key ? null : o.key))}
                >
                  <Check active={active} />
                  <span className="text-[15px] font-medium">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Divider */}
        <div className="mx-3 my-1 h-px bg-white/10" />

        {/* Section 3: Only Dommes / Only Subs (mutually exclusive, or none) */}
        <ul className="py-2">
          {(
            [
              { key: 'dommes', label: t('onlyDommes') },
              { key: 'subs', label: t('onlySubs') },
            ] as Array<{ key: 'dommes' | 'subs'; label: string }>
          ).map(o => {
            const active = roleType === o.key;
            return (
              <li key={o.key}>
                <button
                  type="button"
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 ${active ? 'bg-white/[.06]' : ''}`}
                  onClick={() => setRoleType(prev => (prev === o.key ? null : o.key))}
                >
                  <Check active={active} />
                  <span className="text-[15px] font-medium">{o.label}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 px-3 py-3 border-t border-white/10">
          <button
            type="button"
            className="px-3 py-2 text-[13px] rounded-md hover:bg-white/5"
            onClick={clear}
          >
            {t('reset')}
          </button>
          <button
            type="button"
            className="px-3 py-2 text-[13px] rounded-md bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white"
            onClick={apply}
          >
            {t('apply')}
          </button>
        </div>
      </div>
    </div>
  );
}


/* ================== Header ================== */
export default function Header({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const hidden = useScrollHide({ threshold: 6, topAlwaysShow: 12 });
  const isHome = pathname === `/${locale}`;
 // Ein stabiler Bool, ob das Panel geschlossen werden soll
 const shouldAutoClose = hidden || !isHome;

  const inBookmarks = pathname?.startsWith(`/${locale}/settings/bookmarks`) ?? false;
  const chatBase = `/${locale}/chat`;
  const inChatThread =
    !!pathname && (pathname === `${chatBase}/` ? false : pathname.startsWith(`${chatBase}/`));
  const hideHeader = inBookmarks || inChatThread;

  const [filterOpen, setFilterOpen] = React.useState(false);

  // Panel schließen, wenn Header verschwindet ODER nicht Home
  React.useEffect(() => {
    if (shouldAutoClose && filterOpen) setFilterOpen(false);
  }, [shouldAutoClose, filterOpen]);

  const iconSize = 'clamp(24px, 2.8vw, 50px)';
  const headerHeight = `calc(${iconSize} + 16px)`;

  // Position des hängenden Filters (rechts neben Settings)
  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const settingsRef = React.useRef<HTMLButtonElement | null>(null);
  const [hangLeft, setHangLeft] = React.useState<number>(0);
  const gapPx = 8;

  React.useLayoutEffect(() => {
    const update = () => {
      const inner = innerRef.current;
      const settings = settingsRef.current;
      if (!inner || !settings) return;

      const innerBox = inner.getBoundingClientRect();
      const setBox = settings.getBoundingClientRect();

      const center = setBox.left - innerBox.left + setBox.width + gapPx + 20; // 20 = 1/2 von 40px
      const minX = 8;
      const maxX = innerBox.width - 8;
      setHangLeft(Math.max(minX, Math.min(maxX, center)));
    };
    update();
    window.addEventListener('resize', update);
    const t = setTimeout(update, 60);
    return () => {
      window.removeEventListener('resize', update);
      clearTimeout(t);
    };
  }, []);

  const openSettings = () => {
    const href = withQuery(pathname, searchParams, { settings: '1' });
    router.push(href, { scroll: false });
  };

  const openCompose = async () => {
    if (!session) {
      const backTo = withQuery(pathname, searchParams, {});
      router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(backTo)}`);
      return;
    }
    if (!session.user?.ageVerified) {
      const backToAfterVerify = withQuery(pathname, searchParams, { compose: '1' });
      const res = await fetch(
        `/api/veriff/start?back=${encodeURIComponent(backToAfterVerify)}&locale=${locale}`,
        { method: 'POST' }
      );
      const { url } = await res.json();
      router.push(url);
      return;
    }
    const href = withQuery(pathname, searchParams, { compose: '1' });
    router.push(href, { scroll: false });
  };

  if (hideHeader) return null;

  type CSSVars = React.CSSProperties & { ['--header-h']?: string };

  return (
    <header
      id="app-global-header"
      className="fixed top-0 left-0 right-0 z-50 w-full overflow-visible"
      style={
        {
          height: headerHeight,
          ['--header-h']: headerHeight,
          background: '#000',
          transform: hidden ? `translateY(calc(-1 * ${headerHeight}))` : 'translateY(0)',
          transition: 'transform 220ms ease',
          willChange: 'transform',
        } as CSSVars
      }
      aria-label="Subm8 Header"
    >
      {/* Unterkante */}
      <div className="absolute left-0 right-0 bottom-0 h-px bg-white/5" />

      {/* Innen-Grid */}
      <div
        ref={innerRef}
        className="relative mx-auto px-4 h-full grid items-center"
        style={{
          maxWidth: 760,
          gridTemplateColumns: `calc(${iconSize} + 16px) 1fr calc(${iconSize} + 16px)`,
        }}
      >
        {/* Settings */}
        <button
          ref={settingsRef}
          type="button"
          onClick={openSettings}
          className="justify-self-start p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center cursor-pointer"
          aria-label="Settings"
          style={{ width: iconSize, height: iconSize }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="pointer-events-none"
            style={{
              color: 'rgba(255,255,255,.95)',
              position: 'absolute',
              inset: 0,
              width: '70%',
              height: '70%',
              margin: 'auto',
            }}
          >
            <rect x="3" y="6" width="18" height="2" rx="1" />
            <rect x="3" y="11" width="18" height="2" rx="1" />
            <rect x="3" y="16" width="18" height="2" rx="1" />
          </svg>
        </button>

        {/* Logo */}
        <Link href={`/${locale}`} prefetch={false} className="justify-self-center flex items-center">
          <Image
            src="/logo.png"
            alt="Subm8 Logo"
            width={50}
            height={50}
            priority
            className="select-none"
            style={{ width: iconSize, height: iconSize }}
            sizes="(min-width: 1024px) 50px, (min-width: 640px) 32px, 24px"
          />
        </Link>

        {/* Compose */}
        <button
          type="button"
          onClick={openCompose}
          className="justify-self-end p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center cursor-pointer"
          aria-label={session ? 'New Post' : 'Sign in to post'}
          style={{ width: iconSize, height: iconSize }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            className="pointer-events-none"
            style={{ color: 'var(--purple)', position: 'absolute', inset: 0, width: '70%', height: '70%', margin: 'auto' }}
          >
            <path d="M11 5a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z" />
          </svg>
        </button>

        {/* Hänge-Overlay: rechts neben Settings, unter dem Header */}
        {/* Hänge-Overlay: nur auf der Home-Seite anzeigen */}
        {isHome && (
          <div
            aria-hidden
            className={`pointer-events-none absolute left-0 right-0 transition-opacity duration-200 ${
              hidden ? 'opacity-0' : 'opacity-100'
            }`}
            style={{ top: 'calc(100% - 6px)', height: 0, zIndex: 60 }}
          >
            {/* Toggle */}
            <div
              className={`absolute -translate-x-1/2 z-[70] ${
                hidden ? 'pointer-events-none' : 'pointer-events-auto'
              }`}
              style={{ left: `${hangLeft}px`, top: 0 }}
            >
              <FeedFilterToggle open={filterOpen} setOpen={setFilterOpen} />
            </div>

            {/* Cover-Maske */}
            <div
              className="absolute left-0 right-0 pointer-events-none z-[80]"
              style={{
                top: 0,
                height: 5,
                background:
                  'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 70%, rgba(0,0,0,0) 100%)',
              }}
            />
          </div>
        )}
      </div>
    </header>
  );
}
