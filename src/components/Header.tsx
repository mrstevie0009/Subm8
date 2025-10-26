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

function FilterIconOutline(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 50 50"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...props}  
    >
      <path d="M 4 2 C 3.398438 2 3 2.398438 3 3 L 3 6 C 3 6.300781 3.113281 6.488281 3.3125 6.6875 L 19.3125 23.6875 C 19.511719 23.886719 19.800781 24 20 24 L 30 24 C 30.300781 24 30.488281 23.886719 30.6875 23.6875 L 46.6875 6.6875 C 46.886719 6.488281 47 6.300781 47 6 L 47 3 C 47 2.398438 46.601563 2 46 2 Z M 19 26 L 19 41 C 19 41.398438 19.199219 41.707031 19.5 41.90625 L 29.5 47.90625 C 29.601563 48.007813 29.800781 48 30 48 C 30.199219 48 30.300781 48.007813 30.5 47.90625 C 30.800781 47.707031 31 47.398438 31 47 L 31 26 Z" />
    </svg>
  );
}

function FilterIconFilled(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 50 50"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...props}
    >
      <path d="M 3.8125 2 C 3.335938 2.089844 2.992188 2.511719 3 3 L 3 6 C 3.003906 6.257813 3.101563 6.503906 3.28125 6.6875 L 19 23.375 L 19 41 C 19.007813 41.347656 19.199219 41.667969 19.5 41.84375 L 29.5 47.84375 C 29.804688 48.019531 30.183594 48.023438 30.492188 47.847656 C 30.796875 47.675781 30.992188 47.351563 31 47 L 31 23.375 L 46.5625 6.84375 C 46.574219 6.832031 46.582031 6.824219 46.59375 6.8125 L 46.71875 6.6875 C 46.765625 6.640625 46.808594 6.585938 46.84375 6.53125 C 46.867188 6.511719 46.886719 6.492188 46.90625 6.46875 C 46.964844 6.339844 46.996094 6.203125 47 6.0625 C 47 6.042969 47 6.019531 47 6 C 47.003906 5.949219 47.003906 5.894531 47 5.84375 L 47 3 C 47 2.449219 46.550781 2 46 2 L 4 2 C 3.96875 2 3.9375 2 3.90625 2 C 3.875 2 3.84375 2 3.8125 2 Z M 5 4 L 45 4 L 45 5.625 L 29.5625 22 L 20.4375 22 L 5 5.625 Z M 21 24 L 29 24 L 29 45.25 L 21 40.46875 Z" />
    </svg>
  );
}

/* ================== Filter Toggle (UI, hängt außerhalb) ================== */
function FeedFilterToggle({ open, setOpen }: { open: boolean; setOpen: (v: boolean) => void }) {
  const t = useTranslations('home.feedFilter'); // feedFilter.json
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

  // Standard-Zustand: nur "new" (oder gar kein feed-Param), kein following, keine Rolle
  const isDefaultFilter = React.useMemo(() => {
    const onlyNew =
      urlFeedSet.size === 0 || (urlFeedSet.size === 1 && urlFeedSet.has('new'));
    const noFollowing = !urlFeedSet.has('following');
    const noTop = !urlFeedSet.has('top');
    const noRole = urlRole == null;
    return onlyNew && noFollowing && noTop && noRole;
  }, [urlFeedSet, urlRole]);


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
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={t('toggleAria')}
        className="relative grid place-items-center w-10 h-10 rounded-b-xl rounded-t-none border border-black bg-black"
      >
        <span className="w-6 h-6" style={{ color: 'var(--purple)' }} aria-hidden="true">
          {isDefaultFilter ? (
            <FilterIconOutline style={{ width: '100%', height: '100%' }} />
          ) : (
            <FilterIconFilled style={{ width: '100%', height: '100%' }} />
          )}
        </span>
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
  const shouldAutoClose = hidden || !isHome;

  const inBookmarks = pathname?.startsWith(`/${locale}/settings/bookmarks`) ?? false;
  const chatBase = `/${locale}/chat`;
  const inChatThread =
    !!pathname && (pathname === `${chatBase}/` ? false : pathname.startsWith(`${chatBase}/`));
  const hideHeader = inBookmarks || inChatThread;

  const [filterOpen, setFilterOpen] = React.useState(false);
  React.useEffect(() => {
    if (shouldAutoClose && filterOpen) setFilterOpen(false);
  }, [shouldAutoClose, filterOpen]);

  // <<< WICHTIG: eine gemeinsame, gedeckelte Größe
  // Passe MIN/FLUID/MAX nach Geschmack an.
  const ICON_MIN = 30;      // px – auf sehr kleinen Screens
  const ICON_MAX = 30;      // px – deine Obergrenze (nicht größer werden)
  const ICON_FLUID = '5vw';
  const iconSize = `clamp(${ICON_MIN}px, ${ICON_FLUID}, ${ICON_MAX}px)`;
  const headerHeight = `calc(${iconSize} + 16px)`;

  const innerRef = React.useRef<HTMLDivElement | null>(null);
  const settingsRef = React.useRef<HTMLButtonElement | null>(null);
  const [hangLeft, setHangLeft] = React.useState<number>(0);
  const gapPx = 8;

  const onLogoClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isHome) {
      e.preventDefault();                     // nicht neu navigieren
      window.dispatchEvent(new CustomEvent('home:refresh'));
    }
  };

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

  type CSSVars = React.CSSProperties & { ['--header-h']?: string; ['--icon-size']?: string };

  return (
    <header
      id="app-global-header"
      className="fixed top-0 left-0 right-0 z-50 w-full overflow-visible"
      style={
        {
          height: headerHeight,
          ['--header-h']: headerHeight,
          ['--icon-size']: iconSize,        // <<< Variable bereitstellen
          background: '#000',
          transform: hidden ? `translateY(calc(-1 * ${headerHeight}))` : 'translateY(0)',
          transition: 'transform 220ms ease',
          willChange: 'transform',
        } as CSSVars
      }
      aria-label="Subm8 Header"
    >
      <div className="absolute left-0 right-0 bottom-0 h-px bg-white/5" />

      <div
        ref={innerRef}
        className="relative mx-auto px-4 h-full grid items-center"
        style={{
          maxWidth: 760,
          gridTemplateColumns: `calc(var(--icon-size) + 16px) 1fr calc(var(--icon-size) + 16px)`,
        }}
      >
        {/* Settings */}
        <button
          ref={settingsRef}
          type="button"
          onClick={openSettings}
          className="justify-self-start p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center cursor-pointer"
          aria-label="Settings"
          style={{ width: 'var(--icon-size)', height: 'var(--icon-size)' }}
        >
          <svg
            viewBox="0 0 48 48"
            aria-hidden="true"
            style={{
              color: 'var(--purple)',
              position: 'absolute',
              inset: 0,
              width: '70%',
              height: '70%',
              margin: 'auto',
            }}
          >
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth={3} d="M36.1,7.5h2.4c1.1,0,2,0.9,2,2v3c0,1.1-0.9,2-2,2H18" />
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth={3} d="M13,14.5H9.5c-1.1,0-2-0.9-2-2v-3c0-1.1,0.9-2,2-2h21.3" />
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth={3} d="M13.3,27.5H9.5c-1.1,0-2-0.9-2-2v-3c0-1.1,0.9-2,2-2h20" />
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth={3} d="M35,20.5h3.5c1.1,0,2,0.9,2,2v3c0,1.1-0.9,2-2,2h-20" />
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth={3} d="M13.5,40.5h-4c-1.1,0-2-0.9-2-2v-3c0-1.1,0.9-2,2-2h19.6" />
            <path fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeMiterlimit="10" strokeWidth={3} d="M34.2,33.5h4.3c1.1,0,2,0.9,2,2v3c0,1.1-0.9,2-2,2h-20" />
          </svg>
        </button>

        {/* Logo – benutzt dieselbe gedeckelte Größe */}
        <Link
          href={`/${locale}`}
          prefetch={false}
          onClick={onLogoClick}  // <-- neu
          className="justify-self-center flex items-center"
        >
          <Image
            src="/logo.svg"
            alt="Subm8 Logo"
            width={80}
            height={80}
            priority
            className="select-none"
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
            viewBox="0 0 72 72"
            aria-hidden="true"
            style={{
              color: 'var(--purple)', // steuert die Icon-Farbe
              position: 'absolute',
              inset: 0,
              width: '70%',
              height: '70%',
              margin: 'auto',
            }}
          >
            <path
              fill="currentColor"
              d="M 58.132812 9.7050781 C 57.573812 9.7443281 57.005594 9.9983125 56.558594 10.445312 L 54.685547 12.296875 L 59.65625 17.292969 L 61.496094 15.408203 C 62.415094 14.441203 62.486359 13.111359 61.568359 12.193359 L 59.652344 10.253906 C 59.241344 9.8429063 58.691813 9.6658281 58.132812 9.7050781 z M 19 11 C 14.589 11 11 14.589 11 19 L 11 53 C 11 57.411 14.589 61 19 61 L 53 61 C 57.411 61 61 57.411 61 53 L 61 21.720703 L 40.251953 42.470703 L 33.640625 44.070312 C 33.212625 44.198313 32.768359 44.261719 32.318359 44.261719 C 30.716359 44.261719 29.227937 43.450797 28.335938 42.091797 C 27.541938 40.882797 27.347109 39.4055 27.787109 38.0625 L 29.490234 31.6875 L 50.150391 11 L 19 11 z M 52.820312 13.986328 L 33.078125 33.755859 L 31.611328 39.251953 C 31.369328 39.806953 31.996734 40.43575 32.552734 40.21875 L 38.216797 38.847656 L 57.960938 19.103516 L 52.820312 13.986328 z"
            />
          </svg>
        </button>

        {/* Hänge-Overlay nur Home */}
        {isHome && (
          <div
            aria-hidden
            className={`pointer-events-none absolute left-0 right-0 transition-opacity duration-200 ${hidden ? 'opacity-0' : 'opacity-100'}`}
            style={{ top: 'calc(100% - 6px)', height: 0, zIndex: 60 }}
          >
            <div
              className={`absolute -translate-x-1/2 z-[70] ${hidden ? 'pointer-events-none' : 'pointer-events-auto'}`}
              style={{ left: `${hangLeft}px`, top: 0 }}
            >
              <FeedFilterToggle open={filterOpen} setOpen={setFilterOpen} />
            </div>
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
