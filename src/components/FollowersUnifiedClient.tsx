// src/components/FollowersUnifiedClient.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FollowInlineButton from '@/components/FollowInlineButton';
import FollowTabsInline from '@/components/FollowTabsInline';
import { UserBadges } from '@/components/UserBadges';

const AVATAR_PH = '/images/avatar-placeholder.png';

// Rollen normalisieren
const toDbRole = (r: UserLite['role']): 'DOMME' | 'SUBMISSIVE' =>
  String(r).toUpperCase() === 'DOMME' ? 'DOMME' : 'SUBMISSIVE';

export type UserLite = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  premiumUntil: string | Date | null;
  isFirstAdopter?: boolean | null;
  role: 'DOMME' | 'SUBMISSIVE' | string;
};

export type FollowersUnifiedClientProps = {
  locale: string;
  meId: string | null;
  counts: {
    followers: number;
    following: number;
    vFollowing: number;   // Verified Following
    vFollowers: number;   // Verified Followers
  };
  followers: UserLite[];
  following: UserLite[];
  verifiedFollowing: UserLite[];
  verifiedFollowers: UserLite[];
  viewerFollows: string[];
  initialTab?: 'followers' | 'following' | 'vFollowing' | 'vFollowers';
};

const isPremiumActive = (u: UserLite) => {
  const until = u.premiumUntil ? new Date(u.premiumUntil) : null;
  return !!until && until.getTime() > Date.now();
};

function ListItem({
  locale, u, initialFollowing, meId,
}: {
  locale: string; u: UserLite; initialFollowing: boolean; meId: string | null;
}) {
  const firstAdopter  = !!u.isFirstAdopter;
  const premiumActive = isPremiumActive(u);
  const showFirstAdopter = firstAdopter && !premiumActive;
  const showPremium      = premiumActive && !firstAdopter;

  return (
    <li className="px-3 py-3 sm:px-4 sm:py-3 flex items-center justify-between gap-3">
      <Link href={`/${locale}/u/${u.handle}`} className="flex items-center gap-3 min-w-0">
        <Image
          src={u.avatarUrl || AVATAR_PH}
          alt=""
          width={44}
          height={44}
          className="rounded-full object-cover border border-white/15"
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium truncate">{u.displayName}</span>
            <UserBadges
              role={toDbRole(u.role)}
              isPremium={showPremium}
              isFirstAdopter={showFirstAdopter}
              size={16}
              className="-ml-0.5 shrink-0"
            />
          </div>
          <div className="text-sm opacity-70 truncate">@{u.handle}</div>
        </div>
      </Link>

      <div className="shrink-0">
        {meId && meId !== u.id ? (
          <FollowInlineButton targetUserId={u.id} initialFollowing={initialFollowing} />
        ) : null}
      </div>
    </li>
  );
}

export default function FollowersUnifiedClient(props: FollowersUnifiedClientProps) {
  type Tab = 'followers' | 'following' | 'vFollowing' | 'vFollowers';
  const [tab, setTab] = React.useState<Tab>(props.initialTab ?? 'followers');

  const followSet = React.useMemo(() => new Set(props.viewerFollows), [props.viewerFollows]);

  const list =
    tab === 'followers'  ? props.followers :
    tab === 'following'  ? props.following :
    tab === 'vFollowing' ? props.verifiedFollowing :
                           props.verifiedFollowers;

  return (
    <>
      <FollowTabsInline active={tab} setActive={setTab} counts={props.counts} />

      <ul className="divide-y divide-white/10">
        {list.map((u) => (
          <ListItem
            key={u.id}
            locale={props.locale}
            u={u}
            meId={props.meId}
            initialFollowing={followSet.has(u.id)}
          />
        ))}

        {list.length === 0 && (
          <li className="px-4 py-10 text-center opacity-70">
            {tab === 'followers'
              ? 'No followers yet.'
              : tab === 'following'
              ? 'Not following anyone yet.'
              : tab === 'vFollowing'
              ? 'No verified following yet.'
              : 'No verified followers yet.'}
          </li>
        )}
      </ul>
    </>
  );
}
