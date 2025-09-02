// src/components/ProfileHeader.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import type { Profile } from '@/types/profile';
import { followAction, unfollowAction } from '@/app/actions/follow';
import { blockUserAction, unblockUserAction } from '@/app/actions/blocks';
import { reportUserAction } from '@/app/actions/reports';

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
    lg: 'text-[14px] px-3 py-[3px]',
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

type Props = {
  profile: Profile;
  isOwner: boolean;
  initialIsFollowing?: boolean;
  activeTab?: 'posts' | 'gallery' | 'leaderboard';
  onTabChange?: (t: 'posts' | 'gallery' | 'leaderboard') => void;
  showTabs?: boolean;
  viewerHasBlocked?: boolean;
  isBlockedByProfile?: boolean;

  /** Optional: Callback für den runden Inline-Button neben dem Display-Namen */
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

  const avatarSize = 'clamp(80px, 18vw, 128px)';
  const bannerH    = 'clamp(160px, 26vw, 260px)';

  const [bannerSrc, setBannerSrc] = React.useState<string>(profile.bannerUrl || BANNER_PH);
  const [avatarSrc, setAvatarSrc] = React.useState<string>(profile.avatarUrl || AVATAR_PH);

  const [isFollowing, setIsFollowing] = React.useState<boolean>(!!initialIsFollowing);
  const [pending, startTransition] = React.useTransition();

  const [hasBlocked, setHasBlocked] = React.useState<boolean>(viewerHasBlocked);
  const blockedEither = hasBlocked || isBlockedByProfile;

  type CSSVars = React.CSSProperties & { ['--avatar']?: string };
  const avatarStyle: CSSVars = {
    width: avatarSize,
    height: avatarSize,
    marginTop: 'calc(-0.5 * var(--avatar))',
    '--avatar': avatarSize,
  };

  function BanIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8 8l8 8" />
      </svg>
    );
  }

  /** Kreis-Icon mit Geschenk (als "Offers"-Symbol) für den Inline-Button */
  function OfferCircleIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={35}
        height={35}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        {...props}
      >
        <circle cx="12" cy="12" r="9" />
        <rect x="7.5" y="9" width="9" height="2.6" rx="0.8" />
        <rect x="8" y="11" width="8" height="6" rx="1.2" />
        <line x1="12" y1="9" x2="12" y2="17" />
        <path d="M12 9c-1-2-4-2-4 0" strokeLinecap="round" />
        <path d="M12 9c1-2 4-2 4 0"  strokeLinecap="round" />
      </svg>
    );
  }

  function DotIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
        <circle cx="5" cy="12" r="1.6" />
        <circle cx="12" cy="12" r="1.6" />
        <circle cx="19" cy="12" r="1.6" />
      </svg>
    );
  }

  async function copyProfileLink() {
    try {
      const href = `${window.location.origin}/${locale}/u/${profile.username}`;
      await navigator.clipboard.writeText(href);
    } catch {
      /* ignore */
    }
  }

  /** 3-Punkte-Menü rechts in der Action-Leiste */
  function MoreMenu() {
    const [open, setOpen] = React.useState(false);
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
            className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-white/10 bg-black/85 backdrop-blur shadow-lg p-1"
            role="menu"
          >
            <button
              type="button"
              className="w-full text-left px-3 py-2 rounded hover:bg-white/10"
              onClick={() => {
                copyProfileLink();
                setOpen(false);
              }}
            >
              Copy profile link
            </button>

            {!hasBlocked ? (
              <form
                action={blockUserAction}
                onSubmit={() => {
                  setHasBlocked(true);
                  setOpen(false);
                }}
              >
                <input type="hidden" name="blockedHandle" value={profile.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                  Block User
                </button>
              </form>
            ) : (
              <form
                action={unblockUserAction}
                onSubmit={() => {
                  setHasBlocked(false);
                  setOpen(false);
                }}
              >
                <input type="hidden" name="blockedHandle" value={profile.username} />
                <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                  Unblock User
                </button>
              </form>
            )}

            <form action={reportUserAction} onSubmit={() => setOpen(false)}>
              <input type="hidden" name="handle" value={profile.username} />
              <input type="hidden" name="reason" value="OTHER" />
              <button className="w-full text-left px-3 py-2 rounded hover:bg-white/10 text-red-300">
                Report User
              </button>
            </form>
          </div>
        )}
      </div>
    );
  }

  return (
    <section className="rounded-app border border-sub overflow-hidden shadow-app relative">
      {/* Banner */}
      <div className="relative" style={{ height: bannerH }}>
        <Image
          src={bannerSrc}
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          onError={() => setBannerSrc(BANNER_PH)}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
      </div>

      {/* Content */}
      <div className="px-4 pb-0">
        <div className="grid grid-cols-[auto_1fr_auto] items-start gap-3">
          {/* Avatar + Role */}
          <div className="flex flex-col items-center">
            <div
              className="relative shrink-0 rounded-full overflow-hidden ring-2 ring-black/40 border border-white/20 bg-white/10"
              style={avatarStyle}
              aria-hidden="true"
            >
              <Image
                src={avatarSrc}
                alt={`${profile.displayName} avatar`}
                fill
                className="object-cover"
                sizes="(min-width:1024px) 128px, (min-width:640px) 96px, 80px"
                onError={() => setAvatarSrc(AVATAR_PH)}
              />
            </div>
            <div className="mt-2">
              <Chip tone="purple" size="lg">
                {profile.role === 'domme' ? 'Domme' : 'Sub'}
              </Chip>
            </div>
          </div>

          {/* Name + Handle + Badges + INLINE-BUTTON */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[22px] md:text-[24px] font-bold leading-tight truncate">
                {profile.displayName}
              </h1>

              {/* Runder Offer-Button – fixierte Größe + rein visuell nach unten versetzt */}
              <button
                type="button"
                onClick={onInlineButtonClick}
                className="ml-1.5 inline-grid place-items-center rounded-full border border-white/15 hover:bg-white/5 w-10 h-10 translate-y-[10px]"
                aria-label="Offers"
                title="Offers"
              >
                <OfferCircleIcon />
              </button>

              {isBlockedByProfile && (
                <Chip tone="danger" size="sm">
                  <span className="inline-flex items-center gap-1"><BanIcon /> Blocked you</span>
                </Chip>
              )}
              {!isBlockedByProfile && hasBlocked && (
                <Chip tone="danger" size="sm">
                  <span className="inline-flex items-center gap-1"><BanIcon /> You blocked</span>
                </Chip>
              )}
            </div>

            <div className="mt-0.5 text-muted text-[13px] truncate">
              @{profile.username}
            </div>

            {/* Schlanke Bio */}
            {profile.bio && profile.bio.trim() && (
              <p className="mt-2 text-[15px] leading-relaxed text-white/90 whitespace-pre-wrap max-w-[65ch]">
                {profile.bio}
              </p>
            )}
          </div>

          {/* Actions – inkl. 3-Punkte-Menü */}
          <div className="flex items-center gap-2 justify-end">
            {isOwner ? (
              <Link
                href={`/${locale}/u/${profile.username}/edit`}
                className="px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/5 inline-block"
              >
                Edit Profile
              </Link>
            ) : (
              <>
                {!blockedEither ? (
                  <form
                    action={isFollowing ? unfollowAction : followAction}
                    onSubmit={() => startTransition(() => setIsFollowing((v) => !v))}
                  >
                    <input type="hidden" name="userId" value={profile.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className={`px-4 py-1.5 rounded-full ${
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
                    className="px-4 py-1.5 rounded-full border border-white/20 text-white/60 cursor-not-allowed"
                  >
                    Follow
                  </button>
                )}

                {!blockedEither ? (
                  <Link
                    href={`/${locale}/chat/new?to=${profile.username}`}
                    className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5"
                  >
                    Message
                  </Link>
                ) : (
                  <span
                    className="px-3 py-1.5 rounded-full border border-white/20 text-white/60 cursor-not-allowed"
                    title="Messaging is disabled due to blocking"
                    aria-disabled="true"
                  >
                    Message
                  </span>
                )}

                {/* 3-Punkte-Menü */}
                <MoreMenu />
              </>
            )}
          </div>
        </div>

        <div className="mt-6" />

        {/* Meta */}
        <div className="flex items-center text-[12px] leading-[1.35] text-muted">
          {profile.location && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 relative top-[0.5px]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 21s-7-7.6-7-12a7 7 0 0 1 14 0c0 4.4-7 12-7 12Z" />
                <circle cx="12" cy="9" r="2.5" />
              </svg>
              {profile.location}
            </span>
          )}

          {profile.location && profile.createdAt && (
            <span className="mx-3 select-none" aria-hidden="true">·</span>
          )}

          {profile.createdAt && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <svg
                viewBox="0 0 24 24"
                className="w-3.5 h-3.5 relative top-[0.5px]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
                <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" />
              </svg>
              Joined {joinedMonthYear(profile.createdAt)}
            </span>
          )}
        </div>

        {/* Following · Followers */}
        <div className="mt-3 text-[14px]">
          <Link href={`/${locale}/u/${profile.username}/following`} className="hover:underline" prefetch={false}>
            <strong className="text-white/95">{profile.stats.following}</strong> Following
          </Link>
          <span className="mx-2 text-muted">·</span>
          <Link href={`/${locale}/u/${profile.username}/followers`} className="hover:underline" prefetch={false}>
            <strong className="text-white/95">{profile.stats.followers}</strong> Followers
          </Link>
        </div>

        <div className="mt-6" />
      </div>

      {showTabs && (
        <nav className="border-t border-white/10">
          <ul className="grid grid-cols-3 text-center text-[14px] font-medium">
            <TabBtn label="Posts"       active={activeTab === 'posts'}       onClick={() => onTabChange?.('posts')} />
            <TabBtn label="Galerie"     active={activeTab === 'gallery'}     onClick={() => onTabChange?.('gallery')} />
            <TabBtn label="Leaderboard" active={activeTab === 'leaderboard'} onClick={() => onTabChange?.('leaderboard')} />
          </ul>
        </nav>
      )}
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
