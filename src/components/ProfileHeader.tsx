// src/components/ProfileHeader.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { Profile } from '@/types/profile';
import { followAction, unfollowAction } from '@/app/actions/follow';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import { reportUserAction } from '@/app/actions/reports';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/toast';
import BackButton from '@/components/BackButton';
import { UserBadges } from '@/components/UserBadges';


type DbRole = 'DOMME' | 'SUBMISSIVE';

const CDN_BASE = process.env.NEXT_PUBLIC_CDN_BASE || '';

function cdnify(u?: string | null): string {
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;               // already absolute (e.g., R2/CF public URL)
  if (CDN_BASE && u.startsWith('/uploads/')) {
    return `${CDN_BASE.replace(/\/$/, '')}${u}`;       // map legacy local path to CDN
  }
  return u;                                            // leave anything else untouched (placeholders, data:, etc.)
}

// Falls dein Profile.role mal klein- oder großgeschrieben sein kann:
const toDbRole = (r: Profile['role'] | string): DbRole =>
  String(r).toUpperCase() === 'DOMME' ? 'DOMME' : 'SUBMISSIVE';

// Zusätzliche, optionale Felder, ohne globalen Typ ändern zu müssen
type ProfileWithBadges = Profile & {
  premiumUntil?: string | null;
  isFirstAdopter?: boolean;
};

const isPremiumActive = (iso?: string | null) =>
  !!iso && new Date(iso).getTime() > Date.now();

const AVATAR_PH = '/images/avatar-placeholder.png';
const BANNER_PH = '/images/banner-placeholder.png';

const Chip = React.memo(function Chip({
  children,
  tone = 'neutral',
  size = 'sm',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'purple' | 'success' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: { color: 'rgba(255,255,255,.9)', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' },
    purple:  { color: 'var(--purple)', background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' },
    success: { color: '#4ade80', background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.25)' },
    danger:  { color: '#fca5a5', background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)' },
  };
  const sizeCls: Record<'sm'|'md'|'lg', string> = {
    sm: 'text-[11px] px-2 py-1',
    md: 'text-[12px] px-2.5 py-[6px]',
    lg: 'text-[14px] px-3 py-[6px]',
  };
  return (
    <span className={`rounded-full leading-none whitespace-nowrap ${sizeCls[size]}`} style={styles[tone]}>
      {children}
    </span>
  );
});

// Tip-Icon ohne Kreis
function TipIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 50" fill="currentColor" aria-hidden {...props}>
      {/* um den Mittelpunkt (25,25) skalieren */}
      <g transform="translate(24 25) scale(1.45) translate(-25 -25)">
        <path d="M 24 14 L 24 16.1875 C 22.398438 16.386719 19.5 17.789063 19.5 21.1875 C 19.5 27.585938 28.8125 24.292969 28.8125 29.09375 C 28.8125 30.695313 28.101563 32.1875 25 32.1875 C 21.898438 32.1875 21 29.800781 21 28.5 L 19 28.5 C 19.300781 32.800781 22.300781 33.792969 24 34.09375 L 24 36 L 26 36 L 26 34.09375 C 27.5 33.992188 31 32.90625 31 28.90625 C 31 25.605469 28.289063 24.695313 25.6875 24.09375 C 23.585938 23.59375 21.6875 23.101563 21.6875 21 C 21.6875 20.101563 22.09375 18.09375 25.09375 18.09375 C 27.195313 18.09375 28.199219 19.398438 28.5 21 L 30.5 21 C 29.898438 18.800781 28.898438 16.8125 26 16.3125 L 26 14 Z" />
      </g>
    </svg>
  );
}


function ChatGlyphIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 50 50" fill="currentColor" aria-hidden {...props}>
      <path d="M 43 8 L 7 8 C 4.242188 8 2 10.242188 2 13 L 2 37 C 2 39.757813 4.242188 42 7 42 L 11.140625 42 C 11.480469 44.894531 10.625 46.859375 8.484375 48.144531 C 8.101563 48.375 7.917969 48.835938 8.035156 49.265625 C 8.15625 49.699219 8.550781 50 9 50 C 11.558594 50 17.707031 49.203125 20.683594 42 L 43 42 C 45.757813 42 48 39.757813 48 37 L 48 13 C 48 10.242188 45.757813 8 43 8 Z M 15 27 C 13.894531 27 13 26.105469 13 25 C 13 23.894531 13.894531 23 15 23 C 16.105469 23 17 23.894531 17 25 C 17 26.105469 16.105469 27 15 27 Z M 25 27 C 23.894531 27 23 26.105469 23 25 C 23 23.894531 23.894531 23 25 23 C 26.105469 23 27 23.894531 27 25 C 27 26.105469 26.105469 27 25 27 Z M 35 27 C 33.894531 27 33 26.105469 33 25 C 33 23.894531 33.894531 23 35 23 C 36.105469 23 37 23.894531 37 25 C 37 26.105469 36.105469 27 35 27 Z"/>
    </svg>
  );
}


function joinedMonthYear(iso?: string | Date, locale: string = 'en-US') {
  if (!iso) return undefined;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(d);
}

// ——— Helpers fürs Website-Feld ———
function ensureHttp(raw: string) {
  const s = raw.trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}
function displayHost(raw: string) {
  try {
    const u = new URL(ensureHttp(raw));
    const path = u.pathname === '/' ? '' : u.pathname;
    return `${u.host}${path}`.replace(/\/$/, '');
  } catch {
    return raw.replace(/^https?:\/\//i, '');
  }
}

type Props = {
  profile: Profile;
  isOwner: boolean;
  initialIsFollowing?: boolean;
  activeTab?: 'posts' | 'gallery' | 'leaderboard';
  onTabChange?: (t: 'posts' | 'gallery' | 'leaderboard') => void;
  showTabs?: boolean;
  viewerHasBlocked?: boolean;
  isBlockedByProfile?: boolean;
  onInlineButtonClick?: () => void;
  onOpenTip?: () => void;
  onOpenAutoDrain?: () => void;
  onOpenVerify?: () => void;
};

export default function ProfileHeader({
  profile,
  isOwner,
  initialIsFollowing = false,
  activeTab = 'posts',
  onTabChange,
  showTabs = true,
  viewerHasBlocked = false,
  isBlockedByProfile = false,
  onInlineButtonClick,
  onOpenTip,
  onOpenAutoDrain,
  onOpenVerify,
}: Props) {
  const locale = useLocale();
  const router = useRouter();

  const { data: session } = useSession();
  const ageOk = !!session?.user?.ageVerified;


  const onMessageClick = React.useCallback(() => {
    if (ageOk) {
      router.push(`/${locale}/chat/new?to=${profile.username}`);
    } else {
      onOpenVerify?.();
    }
  }, [ageOk, router, locale, profile.username, onOpenVerify]);


  // 🔤 Translations
  const tPost = useTranslations('post');      // für share-Overlay (vorhandene Keys)
  const tProf = useTranslations('profile.profile');   // neue Keys für ProfileHeader
  const b = useTranslations('common');
  const t = useTranslations('settings.settings');

  const AVATAR_BIG   = 'clamp(88px, 18vw, 136px)';
  const BANNER_H     = 'clamp(160px, 26vw, 260px)';

  const [bannerSrc, setBannerSrc] = React.useState<string>(cdnify(profile.bannerUrl) || BANNER_PH);
  const [avatarSrc, setAvatarSrc] = React.useState<string>(cdnify(profile.avatarUrl) || AVATAR_PH);
  // Loading-States für angenehme Skeleton-Fades
  const [bannerLoaded, setBannerLoaded] = React.useState(false);
  const [avatarLoaded, setAvatarLoaded] = React.useState(false);

  // winziges 1x1-Blur (Data-URI) – sofort da, keine Netzwerklast
  const BLUR_PIXEL =
    'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

  const [isFollowing, setIsFollowing] = React.useState<boolean>(!!initialIsFollowing);
  const [pending, startTransition] = React.useTransition();

  const [hasBlocked, setHasBlocked] = React.useState<boolean>(viewerHasBlocked);
  const blockedEither = hasBlocked || isBlockedByProfile;
  const p = profile as ProfileWithCounts;

  const handleOfferClick = onInlineButtonClick ?? (() => { /* no-op fallback */ });
  const [stats, setStats] = React.useState<FollowStats>({
    followers: Number(p.followersCount ?? p.followers ?? 0),
    following: Number(p.followingCount ?? p.following ?? 0),
  });

  const [mounted, setMounted] = React.useState(false);

  // nach dem useState für stats & isFollowing:
  const initialIsFollowingRef = React.useRef(!!initialIsFollowing);
  React.useEffect(() => {
    initialIsFollowingRef.current = !!initialIsFollowing;
  }, [initialIsFollowing]);

  // Anzeige immer aus Serverzahl + Delta ableiten:
  const displayFollowers = React.useMemo(() => {
    const initial = initialIsFollowingRef.current;
    // Wenn ich vorher nicht gefolgt habe und jetzt folge → +1
    if (!initial && isFollowing) return stats.followers + 1;
    // Wenn ich vorher gefolgt habe und jetzt nicht mehr → -1
    if (initial && !isFollowing) return Math.max(0, stats.followers - 1);
    // Sonst unverändert
    return stats.followers;
  }, [stats.followers, isFollowing]);

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    setBannerSrc(cdnify(profile.bannerUrl) || BANNER_PH);
    setAvatarSrc(cdnify(profile.avatarUrl) || AVATAR_PH);
  }, [profile.bannerUrl, profile.avatarUrl]);

  // ---- Compact Header Logik
  const [compact, setCompact] = React.useState(false);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setCompact(!entry.isIntersecting),
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  type CSSVars = React.CSSProperties & { ['--avatar']?: string; ['--bannerH']?: string };
  const rootVars: CSSVars = { ['--avatar']: AVATAR_BIG, ['--bannerH']: BANNER_H };

  // ---------- Icons ----------
  function DotIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    );
  }

  function GiftIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
        <path d="M20 7H4v4h16V7Z" />
        <path d="M12 7v14" />
        <path d="M7.5 7C6 7 5 5.8 5 4.5S6 2 7.5 2 11 5 12 7" />
        <path d="M16.5 7C18 7 19 5.8 19 4.5S18 2 16.5 2 13 5 12 7" />
        <path d="M4 11h16v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7Z" />
      </svg>
    );
  }
  function ShareIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} {...props}>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="M8.6 11l6.8-4M8.6 13l6.8 4" />
      </svg>
    );
  }
  function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
        <path d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4" strokeLinecap="round" />
        <path d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 1 0 7.07 7.07L13 20" strokeLinecap="round" />
      </svg>
    );
  }

  async function copyProfileLink() {
    try {
      const href = `${window.location.origin}/${locale}/u/${profile.username}`;
      await navigator.clipboard.writeText(href);
      toast.show?.({ title: tProf('copied'), variant: 'success', durationMs: 1400 });
    } catch {}
  }

  // ---------- kleines ActionMenu via Portal (für Tip-Button) ----------
  function ActionMenu({
    anchorRect,
    onClose,
    children,
  }: {
    anchorRect: DOMRect;
    onClose: () => void;
    children: React.ReactNode;
  }) {
    const panelRef = React.useRef<HTMLDivElement>(null);
    const [pos, setPos] = React.useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

    const recompute = React.useCallback(() => {
      const gap = 8;
      const margin = 8;
      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const width = Math.max(220, Math.min(300, anchorRect.width + 60));

      let left = Math.round(anchorRect.left);
      left = Math.min(Math.max(margin, left), winW - width - margin);

      const spaceAbove = Math.max(0, anchorRect.top - margin);
      const spaceBelow = Math.max(0, winH - anchorRect.bottom - margin);
      let openUp = spaceAbove > spaceBelow;

      let top = openUp ? Math.round(anchorRect.top - gap) : Math.round(anchorRect.bottom + gap);

      const h = panelRef.current?.offsetHeight ?? 0;
      if (h > 0) {
        if (openUp && top - h < margin) {
          openUp = false;
          top = Math.round(anchorRect.bottom + gap);
        }
        if (!openUp && top + h > winH - margin) {
          if (spaceAbove >= h + gap) {
            openUp = true;
            top = Math.round(anchorRect.top - gap);
          } else {
            top = Math.max(margin, winH - margin - h);
          }
        }
      }

      setPos({ top, left, width, openUp });
    }, [anchorRect]);

    React.useLayoutEffect(() => { recompute(); }, [recompute]);

    React.useEffect(() => {
      const onOutside = (e: PointerEvent) => {
        const t = e.target as Node | null;
        if (panelRef.current && t && panelRef.current.contains(t)) return;
        onClose();
      };
      const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
      window.addEventListener('pointerdown', onOutside, { passive: true });
      window.addEventListener('keydown', onKey);
      window.addEventListener('resize', recompute);
      window.addEventListener('scroll', recompute, { passive: true });
      return () => {
        window.removeEventListener('pointerdown', onOutside);
        window.removeEventListener('keydown', onKey);
        window.removeEventListener('resize', recompute);
        window.removeEventListener('scroll', recompute);
      };
    }, [onClose, recompute]);

    if (!pos) return null;

    const style: React.CSSProperties = {
      position: 'fixed',
      left: pos.left,
      top: pos.top,
      width: pos.width,
      transform: pos.openUp ? 'translateY(-100%)' : undefined,
      zIndex: 2147483601,
    };

    const panel = (
      <div style={style}>
        <div ref={panelRef} className="rounded-xl border border-white/12 bg-black/90 backdrop-blur p-1 shadow-2xl">
          {children}
        </div>
      </div>
    );

    return createPortal(panel, document.body);
  }


  // ---------- DM-Overlay ----------
  function DMShareOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [items, setItems] = React.useState<Array<{
      id: string;
      other: { username: string; displayName: string; avatarUrl: string | null };
      lastMessageAt: string;
    }>>([]);

    const [q, setQ] = React.useState('');
    const [selected, setSelected] = React.useState<Set<string>>(new Set());
    const [note, setNote] = React.useState('');
    const [sending, setSending] = React.useState(false);

    React.useEffect(() => {
      if (!open) return;
      let cancelled = false;
      (async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await fetch('/api/chat', { cache: 'no-store' });
          const j = await res.json();
          if (!res.ok || !j?.ok) throw new Error(j?.error || `HTTP ${res.status}`);
          if (!cancelled) setItems(j.items || []);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load chats');
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => { cancelled = true; };
    }, [open]);

    const toggle = (id: string) => {
      setSelected(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    const filtered = React.useMemo(() => {
      const qq = q.trim().toLowerCase();
      const base = !qq
        ? items
        : items.filter(i =>
            i.other.displayName.toLowerCase().includes(qq) ||
            i.other.username.toLowerCase().includes(qq)
          );
      return base.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
    }, [items, q]);

    const profileUrl =
      typeof window !== 'undefined'
        ? `${window.location.origin}/${locale}/u/${profile.username}`
        : `/${locale}/u/${profile.username}`;

    async function send() {
      if (selected.size === 0) return;
      try {
        setSending(true);
        setError(null);
        const ids = Array.from(selected);
        const msg = [profileUrl, note.trim()].filter(Boolean).join('\n\n');

        await Promise.all(
          ids.map((conversationId) =>
            fetch(`/api/chat/${encodeURIComponent(conversationId)}`, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ text: msg }),
            }).then(async (r) => {
              if (!r.ok) {
                const j = await r.json().catch(() => null);
                throw new Error(j?.error || `HTTP ${r.status}`);
              }
            })
          )
        );
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to send');
      } finally {
        setSending(false);
      }
    }

    if (!open || !mounted) return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[2147483602]"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          onMouseDown={(e) => e.stopPropagation()}
        />
        <div
          className="absolute left-1/2 top-1/2 w-[min(720px,94vw)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/12 bg-[#0b0b0d] p-3 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="px-2 py-2 border-b border-white/10">
            <div className="text-[18px] font-semibold">{tPost('share.dmTitle')}</div>
            <div className="mt-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                placeholder={tPost('share.searchPlaceholder')}
                className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="mt-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
            {loading && <div className="px-3 py-6 text-sm text-white/70">{tPost('share.loadingChats')}</div>}
            {!loading && error && <div className="px-3 py-3 text-sm text-red-400">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="px-3 py-6 text-sm text-white/70">{tPost('share.empty')}</div>
            )}

            <ul className="divide-y divide-white/10">
              {filtered.map((c) => {
                const checked = selected.has(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-white/5"
                      onClick={() => toggle(c.id)}
                    >
                      <div className="relative size-10 overflow-hidden rounded-full bg-white/10 shrink-0">
                        <Image
                          src={cdnify(c.other.avatarUrl) || AVATAR_PH}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <div className="min-w-0 flex-1 text-left">
                        <div className="font-medium truncate">{c.other.displayName}</div>
                        <div className="text-sm text-white/70 truncate">@{c.other.username}</div>
                      </div>
                      <span
                        className={`grid place-items-center rounded-full border ${
                          checked ? 'bg-[var(--purple)] border-[var(--purple)]' : 'border-white/25'
                        }`}
                        style={{ width: 22, height: 22 }}
                        aria-hidden
                      >
                        {checked ? (
                          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="3">
                            <path d="M5 12.5 10 17l9-10" />
                          </svg>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="px-3 pt-3">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={200}
              placeholder={tPost('share.notePlaceholder')}
              className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
            />
          </div>

          <div className="px-3 pb-2 pt-3 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
              disabled={sending}
            >
              {tPost('share.cancel')}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void send(); }}
              disabled={sending || selected.size === 0}
              className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50"
            >
              {sending ? tPost('share.sending') : tPost('share.send')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );

    function runSearch() {
      // gleiche UX wie vorher: Enter löst Suche aus – hier reicht setQ, da Filter in useMemo erfolgt
    }
  }

  function MoreMenu() {
    const [open, setOpen] = React.useState(false);
    const [shareOpen, setShareOpen] = React.useState(false);
    return (
      <div className="relative">
        <button
          type="button"
          aria-label={tProf('more')}
          className="rounded-full p-1.5 border border-white/15 hover:bg-white/5"
          onClick={() => setOpen(v => !v)}
        >
          <DotIcon />
        </button>

        {open && (
          <div
            className="absolute right-0 z-50 mt-2 w-60 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1"
            role="menu"
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10 flex items-center gap-2"
              onClick={() => { setShareOpen(true); setOpen(false); }}
            >
              <ShareIcon className="w-[16px] h-[16px]" />
              {tProf('shareProfileViaDm')}
            </button>

            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={() => { copyProfileLink(); setOpen(false); }}
            >
              {tProf('copyProfileLink')}
            </button>

            {!hasBlocked ? (
              <form action={blockUserAction} onSubmit={() => { setHasBlocked(true); setOpen(false); }} >
                <input type="hidden" name="blockedHandle" value={profile.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">{tProf('blockUser')}</button>
              </form>
            ) : (
              <form action={unblockUserAction} onSubmit={() => { setHasBlocked(false); setOpen(false); }} >
                <input type="hidden" name="blockedHandle" value={profile.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">{tProf('unblockUser')}</button>
              </form>
            )}

            <form action={reportUserAction} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="handle" value={profile.username} />
              <input type="hidden" name="reason" value="OTHER" />
              <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">{tProf('reportUser')}</button>
            </form>
          </div>
        )}

        {/* DM-Overlay */}
        <DMShareOverlay open={shareOpen} onClose={() => setShareOpen(false)} />
      </div>
    );
  }

  // — Variablen werden genutzt
  const website   = (profile.websiteUrl ?? '').trim();
  const pwb = profile as ProfileWithBadges;
  const premiumActive = isPremiumActive(pwb.premiumUntil ?? null);
  const firstAdopter = !!pwb.isFirstAdopter;

  // Tip-Button State (nur Domme-Profile)
  const [tipMenuOpen, setTipMenuOpen] = React.useState(false);
  const [tipAnchorRect, setTipAnchorRect] = React.useState<DOMRect | null>(null);
  const tipBtnRef = React.useRef<HTMLButtonElement | null>(null);
  // ⬇️ ersetzt deine bisherige openTipMenu-Definition
  const openTipMenu = React.useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
    setTipAnchorRect(r);
    setTipMenuOpen(true);
  }, []);


  type WithModernCSS = React.CSSProperties & {
    contentVisibility?: 'auto' | 'hidden' | 'visible';
    containIntrinsicSize?: string;
  };
  const sectionStyle: WithModernCSS = {
    ...rootVars,
    contentVisibility: 'auto',
    containIntrinsicSize: '800px',
  };

  // ---- Follow-Stats (aus Profile oder via API laden) — typsicher
  type FollowStats = { followers: number; following: number };

  // optional vorhandene Zähler am Profile-Typ zulassen, ohne den globalen Typ zu knacken
  type ProfileWithCounts = Profile & {
    followersCount?: number | null;
    followingCount?: number | null;
    followers?: number | null; // falls du diese Keys schon nutzt
    following?: number | null;
  };

  React.useEffect(() => {
    // wenn Zahlen bereits am Profile vorhanden sind -> nichts laden
    const hasInitial =
      p.followersCount != null ||
      p.followers != null ||
      p.followingCount != null ||
      p.following != null;

    if (hasInitial) return;

    // gleiche API-Form wie im SettingsDrawer, aber für beliebiges Profil
    const url = isOwner
      ? '/api/me/stats'
      : `/api/user/${encodeURIComponent(profile.username)}/stats`;

    type ApiStats = { ok?: boolean; followers?: number; following?: number };

    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json().catch(() => null)) as ApiStats | null;
        const followers = Number(j?.followers ?? 0);
        const following = Number(j?.following ?? 0);
        if (!cancelled) setStats({ followers, following });
      } catch {
        // ignore
      }
    })();

    return () => { cancelled = true; };
  // nur neu laufen, wenn sich die Identität ändert
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOwner, profile.username]);

  return (
    <section
      className="rounded-app border border-sub overflow-hidden shadow-app relative"
      style={sectionStyle}
    >
      {/* FIXED MINI HEADER */}
      {mounted &&
        createPortal(
          <div
            className={`
              fixed top-0 left-0 right-0 z-[60]
              border-b border-white/10
              transition-all duration-200
              ${mounted && compact ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-3 pointer-events-none'}
            `}
            role="banner"
          >
            {/* Hintergrund-Layer mit Banner + Blur */}
            <div className="relative h-[56px]">
              <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
                <Image
                  src={bannerSrc}
                  alt=""
                  fill
                  sizes="100vw"
                  className="object-cover blur-[4px] scale-110 brightness-50"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/40 to-black/60" />
              </div>

              <div className="max-w-screen-xl mx-auto">
                <div className="h-[56px] px-2 sm:px-3 flex items-center gap-2">
                  <BackButton
                    fallbackHref={`/${locale}`}
                    ariaLabel="Back"
                    className="inline-flex items-center justify-center h-8 w-8 rounded-full border border-white/15
                              bg-black/30 hover:bg-black/50 text-white"
                  />
                  <div className="rounded-full overflow-hidden shrink-0" style={{ width: 32, height: 32 }}>
                    <Image src={avatarSrc} alt="" width={32} height={32} className="object-cover" />
                  </div>
                  <div className="min-w-0 mr-auto">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className="text-[15px] font-semibold truncate">{profile.displayName}</div>

                      <UserBadges
                        role={toDbRole(profile.role)}
                        isPremium={premiumActive}
                        isFirstAdopter={firstAdopter}
                        size={16}
                        className="-ml-0.5 shrink-0"
                        premiumLabel={b('badges.verified')}
                        firstAdopterLabel={b('badges.firstAdopter')}
                      />
                    </div>
                  </div>
                  {!isOwner && !blockedEither && (
                    <button
                      type="button"
                      onClick={onMessageClick}
                      aria-label={tProf('message')}
                      title={tProf('message')}
                      className="inline-grid place-items-center rounded-full border border-white/20 hover:bg-white/10 h-8 w-8"
                    >
                      <ChatGlyphIcon className="w-[16px] h-[16px]" />
                    </button>
                  )}
                  <MoreMenu />
                </div>
              </div>
            </div>

            {showTabs && (
              <nav className="px-1 border-t border-white/10 bg-black/60">
                <ul className="grid grid-cols-3 text-center text-[14px] font-medium">
                  <TabBtn label={tProf('tabs.posts')}       active={activeTab === 'posts'}       onClick={() => onTabChange?.('posts')} />
                  <TabBtn label={tProf('tabs.gallery')}     active={activeTab === 'gallery'}     onClick={() => onTabChange?.('gallery')} />
                  <TabBtn label={tProf('tabs.leaderboard')} active={activeTab === 'leaderboard'} onClick={() => onTabChange?.('leaderboard')} />
                </ul>
              </nav>
            )}
          </div>,
          document.body
        )
      }

      {/* Banner */}
      <div className="relative" style={{ height: 'var(--bannerH)' }}>
        <div className={`absolute inset-0 bg-white/10 ${bannerLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity`} />
        <Image
          src={bannerSrc}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
          placeholder="blur"
          blurDataURL={BLUR_PIXEL}
          onLoad={() => setBannerLoaded(true)}
          onError={() => setBannerSrc(BANNER_PH)}
          fetchPriority="high"
          decoding="async"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/0 to-black/35" />
        <div className="absolute top-2 left-2 z-10">
          <BackButton
            fallbackHref={`/${locale}`}
            ariaLabel="Back"
            className="inline-flex items-center justify-center size-9 rounded-full border border-white/15
                      bg-black/40 backdrop-blur hover:bg-black/60 text-white"
          />
        </div>
        <div className="absolute top-2 right-2 z-10">
          <MoreMenu />
        </div>

        {/* Avatar am Banner andocken (halb überlappend) */}
        <div
          className="absolute left-4 bottom-0 translate-y-[60%] z-20"
          style={{ width: 'var(--avatar)' }}
        >
          <div className="inline-block w-fit rounded-full p-[2px] bg-gradient-to-br from-[var(--purple)]/70 via-fuchsia-500/50 to-sky-400/50">
            <div
              className="relative rounded-full overflow-hidden bg-white/10 ring-1 ring-white/20 shadow-[0_6px_30px_-10px_rgba(0,0,0,.8)]"
              style={{ width: 'var(--avatar)', height: 'var(--avatar)' }}
            >
              <div
                className={`absolute inset-0 bg-white/10 ${avatarLoaded ? 'opacity-0' : 'opacity-100'} transition-opacity`}
                aria-hidden
              />
              <Image
                src={avatarSrc}
                alt={`${profile.displayName} avatar (${profile.role === 'domme' ? 'Domme' : 'Sub'})`}
                fill
                className="object-cover"
                sizes="(min-width:1024px) 136px, (min-width:640px) 104px, 88px"
                placeholder="blur"
                blurDataURL={BLUR_PIXEL}
                onLoad={() => setAvatarLoaded(true)}
                onError={() => setAvatarSrc(AVATAR_PH)}
                decoding="async"
              />
            </div>
          </div>
          <div className="-mt-1 text-center">
            <Chip tone="purple" size="sm">{profile.role === 'domme' ? 'Dom' : 'Sub'}</Chip>
          </div>
        </div>
      </div>

      {/* ===== Action-Bar DIREKT UNTER dem Banner (außerhalb des Banners) ===== */}
      <div className="px-4 mt-2">
        <div
          className="grid gap-y-1 items-end"
          style={{ gridTemplateColumns: 'var(--avatar) 1fr' }}
        >
          {/* linke Spalte = Avatar-Breite als Spacer */}
          <div aria-hidden style={{ width: 'var(--avatar)' }} />

          {/* rechte Spalte = Buttons (unverändert) */}
          <div className="ml-auto flex items-center gap-2 flex-nowrap justify-end">
          {isOwner ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/${locale}/u/${profile.username}/edit`}
                className="px-3 sm:px-4 h-9 inline-flex items-center rounded-full border border-white/20 hover:bg-white/5 text-[12px] sm:text-[13px] whitespace-nowrap"
              >
                {tProf('editProfile')}
              </Link>

              {/* ⬇️ Nur Dommes dürfen Offers haben */}
              {profile.role === 'domme' && (
                <button
                  type="button"
                  onClick={handleOfferClick}
                  className="h-9 inline-flex items-center rounded-full bg-[var(--purple)]/95 text-white text-[12px] sm:text-[13px] font-semibold shadow-[0_8px_30px_-12px_rgba(139,92,246,.9)]
                            hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]/60 px-2 sm:px-4 shrink-0 whitespace-nowrap"
                  aria-label={tProf('offerMenu')}
                  title={tProf('offerMenu')}
                >
                  <GiftIcon className="w-[18px] h-[18px] sm:mr-1.5" />
                  <span className="hidden sm:inline">{tProf('offer')}</span>
                </button>
              )}
            </div>
          ) : (
            <>
              {/* TIP links vom Chat (nur für Dommes & wenn nicht geblockt) */}
              {profile.role === 'domme' && !blockedEither && (
                <>
                  <button
                    ref={tipBtnRef}
                    type="button"
                    onClick={openTipMenu}
                    className="inline-grid place-items-center rounded-full border border-white/20 hover:bg-white/5 h-9 w-9 shrink-0"
                    aria-label={tProf('tipActions')}
                    title={tProf('tipActions')}
                  >
                    <TipIcon className="w-[30px] h-[30px]" />
                  </button>

                  {/* Einmaliges ActionMenu – bleibt bestehen */}
                  {tipMenuOpen && tipAnchorRect && (
                    <ActionMenu anchorRect={tipAnchorRect} onClose={() => setTipMenuOpen(false)}>
                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => {
                          setTipMenuOpen(false);
                          onOpenTip?.();
                        }}
                      >
                        {tProf('sendTip')}
                      </button>

                      <button
                        type="button"
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/10"
                        onClick={() => {
                          setTipMenuOpen(false);
                          onOpenAutoDrain?.();
                        }}
                      >
                        {tProf('autodrain')}
                      </button>
                    </ActionMenu>
                  )}
                </>
              )}

              {/* Chat-Button direkt nach dem Tip-Button */}
              {!blockedEither ? (
                <button
                  type="button"
                  onClick={onMessageClick}
                  aria-label={tProf('message')}
                  title={tProf('message')}
                  className="inline-grid place-items-center rounded-full border border-white/20 hover:bg-white/5 h-9 w-9 text-white shrink-0"
                >
                  <ChatGlyphIcon className="w-[18px] h-[18px]" />
                  <span className="sr-only">{tProf('message')}</span>
                </button>
              ) : (
                <span
                  aria-hidden
                  title={tProf('messagingDisabled')}
                  className="inline-grid place-items-center rounded-full border border-white/20 text-white/60 h-9 w-9 cursor-not-allowed shrink-0"
                >
                  <ChatGlyphIcon className="w-[18px] h-[18px] opacity-60" />
                </span>
              )}

              {/* Offer */}
              {profile.role === 'domme' && !blockedEither && (
                <button
                  type="button"
                  onClick={handleOfferClick}
                  className="h-9 inline-flex items-center rounded-full bg-[var(--purple)]/95 text-white text-[12px] sm:text-[13px] font-semibold shadow-[0_8px_30px_-12px_rgba(139,92,246,.9)]
                            hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]/60 px-2 sm:px-4 shrink-0 whitespace-nowrap"
                  aria-label={tProf('offerMenu')}
                  title={tProf('offerMenu')}
                >
                  <GiftIcon className="w-[18px] h-[18px] sm:mr-1.5" />
                  <span className="hidden sm:inline">{tProf('offer')}</span>
                </button>
              )}

              {/* Follow / Unfollow */}
              {!blockedEither ? (
                <form
                  action={isFollowing ? unfollowAction : followAction}
                  onSubmit={() => startTransition(() => {
                    setIsFollowing(prev => !prev);
                  })}
                >
                  <input type="hidden" name="userId" value={profile.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    aria-busy={pending}
                    className={`px-3 sm:px-4 h-9 rounded-full inline-flex items-center gap-2 text-[12px] sm:text-[13px] font-semibold whitespace-nowrap shrink-0 ${
                      isFollowing
                        ? 'border border-white/25 hover:bg-white/5'
                        : 'bg-[var(--purple)] text-white hover:opacity-95'
                    }`}
                  >
                    {pending && (
                      <span className="inline-block h-3 w-3 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden />
                    )}
                    {isFollowing ? tProf('unfollow') : tProf('follow')}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  disabled
                  title={isBlockedByProfile ? tProf('blockedBy') : tProf('youBlocked')}
                  className="px-3 sm:px-4 h-9 rounded-full border border-white/20 text-white/60 cursor-not-allowed text-[12px] sm:text-[13px] whitespace-nowrap shrink-0"
                >
                  {tProf('follow')}
                </button>
              )}
            </>
          )}
        </div>
      {/* Zeile 2: Name + Badges + Handle direkt unter den Buttons */}
      <div className="col-start-2 min-w-0">
        <div className="flex items-center gap-1.5">
          <h1 className="text-[clamp(20px,2.6vw,24px)] font-semibold leading-none truncate">
            {profile.displayName}
          </h1>
          <UserBadges
            role={toDbRole(profile.role)}
            isPremium={premiumActive}
            isFirstAdopter={firstAdopter}
            size={18}
            className="-ml-0.5"
            premiumLabel={b('badges.verified')}
            firstAdopterLabel={b('badges.firstAdopter')}
          />
        </div>
        <span className="text-white/70 text-sm leading-tight truncate">
          @{profile.username}
        </span>
      </div>
    </div>
  </div>

      {/* Sentinel */}
      <div ref={sentinelRef} aria-hidden className="h-1" />

      {/* Content */}
      <div className="px-4 pb-0 pt-[calc(var(--avatar)*0.6+12px)]">
        {/* Header-Zeile: Avatar liegt absolut am Banner, hier nur Spacer */}
        <div className="flex gap-3 pt-2 items-start">
          <div className="shrink-0" style={{ width: 'var(--avatar)' }} aria-hidden />
          <div className="min-w-0 flex-1" />
        </div>

      {/* Bio & Meta */}
      {profile.bio && profile.bio.trim() && (
        <p className="mt-3 text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap">
          {profile.bio}
        </p>
      )}

      <div className="mt-3 flex items-center text-[12px] leading-[1.35] text-white/65 flex-wrap gap-x-3 gap-y-1">
        {profile.location && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 relative top-[0.5px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 21s-7-7.6-7-12a7 7 0 0 1 14 0c0 4.4-7 12-7 12Z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
            {profile.location}
          </span>
        )}
        {profile.createdAt && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 relative top-[0.5px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
              <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" />
            </svg>
            {tProf('joined')} {joinedMonthYear(profile.createdAt)}
          </span>
        )}
        {website && (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <LinkIcon className="w-3.5 h-3.5 relative top-[0.5px]" />
            <a
              href={ensureHttp(website)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-[var(--purple)] hover:underline truncate max-w-[50ch]"
              title={ensureHttp(website)}
            >
              {displayHost(website)}
            </a>
          </span>
        )}
      </div>

      {/* Follow-Stats unter Joined – größer & bold */}
      <div className="mt-2 flex gap-6 text-[clamp(14px,1.6vw,16px)]">
        <Link
          href={`/${locale}/u/${profile.username}/followers?tab=following`}
          className="group inline-flex items-baseline hover:opacity-95"
          prefetch={false}
          aria-label={`${stats.following.toLocaleString(locale)} ${t('statsFollowing')}`}
        >
          <span className="tabular-nums font-extrabold text-white">
            {stats.following.toLocaleString(locale)}
          </span>
          <span className="ml-1 text-white/70 font-medium group-hover:text-white/80">
            {t('statsFollowing')}
          </span>
        </Link>

        <Link
          href={`/${locale}/u/${profile.username}/followers?tab=followers`}
          className="group inline-flex items-baseline hover:opacity-95"
          prefetch={false}
          aria-label={`${displayFollowers.toLocaleString(locale)} ${t('statsFollowers')}`}
        >
          <span className="tabular-nums font-extrabold text-white">
            {displayFollowers.toLocaleString(locale)}
          </span>
          <span className="ml-1 text-white/70 font-medium group-hover:text-white/80">
            {t('statsFollowers')}
          </span>
        </Link>
      </div>

      <div className="mt-4" />
    </div>

    {/* Tabs (nur wenn nicht compact) */}
    {showTabs && (
      <nav className={`border-t border-white/10 ${compact ? 'hidden' : 'block'}`}>
        <ul className="grid grid-cols-3 text-center text-[14px] font-medium">
          <TabBtn label={tProf('tabs.posts')}       active={activeTab === 'posts'}       onClick={() => onTabChange?.('posts')} />
          <TabBtn label={tProf('tabs.gallery')}     active={activeTab === 'gallery'}     onClick={() => onTabChange?.('gallery')} />
          <TabBtn label={tProf('tabs.leaderboard')} active={activeTab === 'leaderboard'} onClick={() => onTabChange?.('leaderboard')} />
        </ul>
      </nav>
    )}
  </section>
);



}

const TabBtn = React.memo(function TabBtn({
  label, active, onClick
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full px-4 py-3 transition-colors ${active ? 'text-[var(--purple)]' : 'text-white'} hover:bg-white/[.04]`}
        aria-current={active ? 'page' : undefined}
      >
        {label}
      </button>
    </li>
  );
});
