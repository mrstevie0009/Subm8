// src/components/ProfileHeader.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import type { Profile } from '@/types/profile';
import { followAction, unfollowAction } from '@/app/actions/follow';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import { reportUserAction } from '@/app/actions/reports';
import OfferViewerModal from '@/components/OfferViewerModal';

const AVATAR_PH = '/images/avatar-placeholder.png';
const BANNER_PH = '/images/banner-placeholder.png';

function Chip({
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
}

function joinedMonthYear(iso?: string | Date) {
  if (!iso) return undefined;
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return undefined;
  return new Intl.DateTimeFormat(
    typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    { month: 'long', year: 'numeric' }
  ).format(d);
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
}: Props) {
  const locale = useLocale();

  const AVATAR_BIG   = 'clamp(88px, 18vw, 136px)';
  const AVATAR_SMALL = '40px';
  const BANNER_H     = 'clamp(160px, 26vw, 260px)';

  const [bannerSrc, setBannerSrc] = React.useState<string>(profile.bannerUrl || BANNER_PH);
  const [avatarSrc, setAvatarSrc] = React.useState<string>(profile.avatarUrl || AVATAR_PH);

  const [isFollowing, setIsFollowing] = React.useState<boolean>(!!initialIsFollowing);
  const [pending, startTransition] = React.useTransition();

  const [hasBlocked, setHasBlocked] = React.useState<boolean>(viewerHasBlocked);
  const blockedEither = hasBlocked || isBlockedByProfile;

  const [offerOpen, setOfferOpen] = React.useState(false);
  const handleOfferClick = onInlineButtonClick ?? (() => setOfferOpen(true));

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
  const rootVars: CSSVars = { ['--avatar']: compact ? AVATAR_SMALL : AVATAR_BIG, ['--bannerH']: BANNER_H };
  const avatarStyle: React.CSSProperties = {
    width: 'var(--avatar)',
    height: 'var(--avatar)',
    transition: 'width .2s ease, height .2s ease',
  };

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
  function MessageIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} {...props}>
        <path d="M7 8h10M7 12h6" />
        <path d="M20 12a8 8 0 1 0-3.08 6.3L20 20l-.7-2.92A7.96 7.96 0 0 0 20 12Z" />
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
    } catch {}
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
            <div className="text-[18px] font-semibold">Per Direktnachricht senden</div>
            <div className="mt-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nach Personen/Chats suchen"
                className="w-full rounded-xl bg-white/[.06] border border-white/10 px-3 py-2 outline-none"
              />
            </div>
          </div>

          <div className="mt-2 overflow-y-auto" style={{ maxHeight: '50vh' }}>
            {loading && <div className="px-3 py-6 text-sm text-white/70">Lade Chats…</div>}
            {!loading && error && <div className="px-3 py-3 text-sm text-red-400">{error}</div>}
            {!loading && !error && filtered.length === 0 && (
              <div className="px-3 py-6 text-sm text-white/70">Keine Konversationen gefunden.</div>
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
                          src={c.other.avatarUrl || AVATAR_PH}
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
              placeholder="Kommentar hinzufügen (optional)…"
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
              Abbrechen
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void send(); }}
              disabled={sending || selected.size === 0}
              className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-50"
            >
              {sending ? 'Senden…' : 'Senden'}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  function MoreMenu() {
    const [open, setOpen] = React.useState(false);
    const [shareOpen, setShareOpen] = React.useState(false);
    return (
      <div className="relative">
        <button
          type="button"
          aria-label="More"
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
              Share profile via DM
            </button>

            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={() => { copyProfileLink(); setOpen(false); }}
            >
              Copy profile link
            </button>

            {!hasBlocked ? (
              <form action={blockUserAction} onSubmit={() => { setHasBlocked(true); setOpen(false); }} >
                <input type="hidden" name="blockedHandle" value={profile.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">Block User</button>
              </form>
            ) : (
              <form action={unblockUserAction} onSubmit={() => { setHasBlocked(false); setOpen(false); }} >
                <input type="hidden" name="blockedHandle" value={profile.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">Unblock User</button>
              </form>
            )}

            <form action={reportUserAction} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="handle" value={profile.username} />
              <input type="hidden" name="reason" value="OTHER" />
              <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">Report User</button>
            </form>
          </div>
        )}

        {/* DM-Overlay */}
        <DMShareOverlay open={shareOpen} onClose={() => setShareOpen(false)} />
      </div>
    );
  }

  const roleFull  = profile.role === 'domme' ? 'Domme' : 'Sub';
  const roleShort = profile.role === 'domme' ? 'Dom'   : 'Sub';

  const website = (profile.websiteUrl ?? '').trim();

  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app relative" style={rootVars}>
      {/* FIXED MINI HEADER */}
      <div
        className={`
          fixed top-0 left-0 right-0 z-[60]
          border-b border-white/10
          backdrop-blur bg-black/55
          transition-all duration-200
          ${compact ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-3 pointer-events-none'}
        `}
        role="banner"
      >
        <div className="max-w-screen-xl mx-auto">
          <div className="h-[56px] px-3 flex items-center gap-2">
            <div className="rounded-full overflow-hidden shrink-0" style={{ width: 32, height: 32 }}>
              <Image src={avatarSrc} alt="" width={32} height={32} className="object-cover" />
            </div>
            <div className="min-w-0 mr-auto">
              <div className="text-[15px] font-semibold truncate">{profile.displayName}</div>
              <div className="text-[12px] text-white/60 truncate">@{profile.username}</div>
            </div>
            {!isOwner && !blockedEither && (
              <Link
                href={`/${locale}/chat/new?to=${profile.username}`}
                prefetch={false}
                aria-label="Message"
                title="Message"
                className="inline-grid place-items-center rounded-full border border-white/20 hover:bg-white/5 h-8 w-8"
              >
                <MessageIcon className="w-[16px] h-[16px]" />
              </Link>
            )}
            <MoreMenu />
          </div>

          {showTabs && (
            <nav className="px-1 border-t border-white/10">
              <ul className="grid grid-cols-3 text-center text-[14px] font-medium">
                <TabBtn label="Posts"       active={activeTab === 'posts'}       onClick={() => onTabChange?.('posts')} />
                <TabBtn label="Galerie"     active={activeTab === 'gallery'}     onClick={() => onTabChange?.('gallery')} />
                <TabBtn label="Leaderboard" active={activeTab === 'leaderboard'} onClick={() => onTabChange?.('leaderboard')} />
              </ul>
            </nav>
          )}
        </div>
      </div>

      {/* Banner */}
      <div className="relative" style={{ height: 'var(--bannerH)' }}>
        <Image src={bannerSrc} alt="" fill className="object-cover" sizes="100vw" onError={() => setBannerSrc(BANNER_PH)} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/30 via-black/0 to-black/35" />
        <div className="absolute top-2 right-2 z-10">
          <MoreMenu />
        </div>
      </div>

      {/* Sentinel */}
      <div ref={sentinelRef} aria-hidden className="h-1" />

      {/* Content */}
      <div className="px-4 pb-0">
        {/* Top-Zeile */}
        <div className="flex items-center justify-between gap-2 pt-2 sm:pt-3" style={{ paddingLeft: 'calc(var(--avatar) + 16px)' }}>
          <Chip tone="purple" size="lg">
            <span className="sm:hidden">{roleShort}</span>
            <span className="hidden sm:inline">{roleFull}</span>
          </Chip>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isOwner ? (
              <Link
                href={`/${locale}/u/${profile.username}/edit`}
                className="px-3 sm:px-4 h-9 inline-flex items-center rounded-full border border-white/20 hover:bg-white/5 text-[12px] sm:text-[13px]"
              >
                Edit Profile
              </Link>
            ) : (
              <>
                {!blockedEither ? (
                  <form
                    action={isFollowing ? unfollowAction : followAction}
                    onSubmit={() => startTransition(() => setIsFollowing(v => !v))}
                  >
                    <input type="hidden" name="userId" value={profile.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className={`px-3 sm:px-4 h-9 rounded-full inline-flex items-center text-[12px] sm:text-[13px] ${
                        isFollowing
                          ? 'border border-white/25 hover:bg-white/5'
                          : 'bg-[var(--purple)] text-white hover:opacity-95'
                      }`}
                    >
                      {isFollowing ? 'Unfollow' : 'Follow'}
                    </button>
                  </form>
                ) : (
                  <button
                    type="button"
                    disabled
                    title={isBlockedByProfile ? 'This user has blocked you' : 'You have blocked this user'}
                    className="px-3 sm:px-4 h-9 rounded-full border border-white/20 text-white/60 cursor-not-allowed text-[12px] sm:text-[13px]"
                  >
                    Follow
                  </button>
                )}

                {!blockedEither ? (
                  <Link
                    href={`/${locale}/chat/new?to=${profile.username}`}
                    prefetch={false}
                    aria-label="Message"
                    title="Message"
                    className="inline-grid place-items-center rounded-full border border-white/20 hover:bg-white/5 h-9 w-9"
                  >
                    <MessageIcon className="w-[18px] h-[18px]" />
                    <span className="sr-only">Message</span>
                  </Link>
                ) : (
                  <span
                    aria-hidden
                    title="Messaging is disabled due to blocking"
                    className="inline-grid place-items-center rounded-full border border-white/20 text-white/60 h-9 w-9 cursor-not-allowed"
                  >
                    <MessageIcon className="w-[18px] h-[18px] opacity-60" />
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleOfferClick}
                  className="h-9 inline-flex items-center rounded-full bg-[var(--purple)]/95 text-white text-[12px] sm:text-[13px] font-semibold shadow-[0_8px_30px_-12px_rgba(139,92,246,.9)]
                             hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--purple)]/60 px-2 sm:px-4"
                  aria-label="Offer Menu"
                  title="Offer Menu"
                >
                  <GiftIcon className="w-[18px] h-[18px] sm:mr-1.5" />
                  <span className="hidden sm:inline">Offer</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Avatar + Name/Handle */}
        <div className="grid grid-cols-[auto_1fr] gap-x-3 items-start">
          <div className="col-start-1">
            <div
              className="inline-block w-fit rounded-full p-[2px] bg-gradient-to-br from-[var(--purple)]/70 via-fuchsia-500/50 to-sky-400/50"
              style={{ marginTop: 'calc(var(--avatar) * -0.5)' }}
            >
              <div
                className="relative rounded-full overflow-hidden bg-white/10 ring-1 ring-white/20 shadow-[0_6px_30px_-10px_rgba(0,0,0,.8)]"
                style={avatarStyle}
                aria-hidden="true"
              >
                <Image
                  src={avatarSrc}
                  alt={`${profile.displayName} avatar`}
                  fill
                  className="object-cover"
                  sizes="(min-width:1024px) 136px, (min-width:640px) 104px, 88px"
                  onError={() => setAvatarSrc(AVATAR_PH)}
                />
              </div>
            </div>
          </div>

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
              Joined {joinedMonthYear(profile.createdAt)}
            </span>
          )}

          {/* Website-Link (lila) */}
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

        <div className="mt-4" />
      </div>

      {/* Tabs */}
      {showTabs && (
        <nav className={`border-t border-white/10 ${compact ? 'hidden' : 'block'}`}>
          <ul className="grid grid-cols-3 text-center text-[14px] font-medium">
            <TabBtn label="Posts"       active={activeTab === 'posts'}       onClick={() => onTabChange?.('posts')} />
            <TabBtn label="Galerie"     active={activeTab === 'gallery'}     onClick={() => onTabChange?.('gallery')} />
            <TabBtn label="Leaderboard" active={activeTab === 'leaderboard'} onClick={() => onTabChange?.('leaderboard')} />
          </ul>
        </nav>
      )}

      <OfferViewerModal open={offerOpen} onClose={() => setOfferOpen(false)} handle={profile.username} />
    </section>
  );
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
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
}
