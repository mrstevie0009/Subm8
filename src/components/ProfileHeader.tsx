'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import type { Profile } from '@/types/profile';
import { followAction, unfollowAction } from '@/app/actions/follow';

const AVATAR_PH = '/images/avatar-placeholder.png';
const BANNER_PH = '/images/banner-placeholder.png';

function Chip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'purple' | 'success';
}) {
  const styles: Record<string, React.CSSProperties> = {
    neutral: { color: 'rgba(255,255,255,.9)', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)' },
    purple:  { color: 'var(--purple)', background: 'rgba(139,92,246,.15)', border: '1px solid rgba(139,92,246,.25)' },
    success: { color: '#4ade80', background: 'rgba(74,222,128,.12)', border: '1px solid rgba(74,222,128,.25)' },
  };
  return (
    <span className="px-2 py-1 rounded-full text-[11px] leading-none whitespace-nowrap" style={styles[tone]}>
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
};

export default function ProfileHeader({ profile, isOwner, initialIsFollowing = false }: Props) {
  const locale = useLocale();

  const avatarSize = 'clamp(80px, 18vw, 128px)';
  const bannerH    = 'clamp(160px, 26vw, 260px)';

  const [bannerSrc, setBannerSrc] = React.useState<string>(profile.bannerUrl || BANNER_PH);
  const [avatarSrc, setAvatarSrc] = React.useState<string>(profile.avatarUrl || AVATAR_PH);

  const [isFollowing, setIsFollowing] = React.useState<boolean>(!!initialIsFollowing);
  const [pending, startTransition] = React.useTransition();

  type CSSVars = React.CSSProperties & { ['--avatar']?: string };
  const avatarStyle: CSSVars = {
    width: avatarSize,
    height: avatarSize,
    marginTop: 'calc(-0.5 * var(--avatar))',
    '--avatar': avatarSize,
  };

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
      <div className="px-4 pb-4">
        <div className="grid grid-cols-[auto_1fr] gap-3 items-start">
          <div
            className="relative shrink-0 rounded-full overflow-hidden ring-2 ring-black/40 border border-white/20 bg-white/10"
            style={avatarStyle}
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

          <div className="flex justify-end pt-2">
            {isOwner ? (
              <Link
                href={`/${locale}/u/${profile.username}/edit`}
                className="px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/5 inline-block"
              >
                Edit Profile
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <form
                  action={isFollowing ? unfollowAction : followAction}
                  onSubmit={() => startTransition(() => setIsFollowing((v) => !v))}
                >
                  <input type="hidden" name="userId" value={profile.id} />
                  <button
                    type="submit"
                    disabled={pending}
                    className={`px-4 py-1.5 rounded-full ${isFollowing ? 'border border-white/25 hover:bg-white/5' : 'bg-[var(--purple)] text-white hover:opacity-95'}`}
                  >
                    {isFollowing ? 'Unfollow' : 'Follow'}
                  </button>
                </form>
                <Link href={`/${locale}/chat/new?to=${profile.username}`} className="px-3 py-1.5 rounded-full border border-white/20 hover:bg-white/5">
                  Message
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Name / Handle / Badges */}
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[22px] md:text-[24px] font-bold leading-tight">
              {profile.displayName}
            </h1>
            <Chip tone={profile.role === 'domme' ? 'purple' : 'neutral'}>
              {profile.role === 'domme' ? 'Domme' : 'Sub'}
            </Chip>
            {profile.ageVerifiedAt && <Chip tone="success">18+ Verified</Chip>}
          </div>
          <div className="mt-0.5 text-muted text-[13px]">@{profile.username}</div>
        </div>

        {/* Bio */}
        {profile.bio && <p className="mt-2 leading-relaxed">{profile.bio}</p>}

        {/* Meta */}
        <div className="mt-2 flex items-center text-[12px] leading-[1.35] text-muted">
          {profile.location && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 relative top-[0.5px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 relative top-[0.5px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3.5" y="5.5" width="17" height="15" rx="2" />
                <path d="M8 3.5v4M16 3.5v4M3.5 9.5h17" />
              </svg>
              Joined {joinedMonthYear(profile.createdAt)}
            </span>
          )}
        </div>

        {/* Following · Followers */}
        <div className="mt-3 text-[14px]">
          <span>
            <strong className="text-white/95">{profile.stats.following}</strong> Following
          </span>
          <span className="mx-2 text-muted">·</span>
          <span>
            <strong className="text-white/95">{profile.stats.followers}</strong> Followers
          </span>
        </div>
      </div>
    </section>
  );
}
