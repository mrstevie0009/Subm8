//src/components/CommunityMembersClient.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FollowInlineButton from '@/components/FollowInlineButton';
import { UserBadges } from '@/components/UserBadges';

const AVATAR_PH = '/images/avatar-placeholder.png';

export type UserLite = {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  premiumUntil: string | Date | null;
  isFirstAdopter?: boolean | null;
  role: 'DOMME' | 'SUBMISSIVE' | string;
};

export type CommunityMembersClientProps = {
  locale: string;
  meId: string | null;
  counts: { members: number; verified: number };
  members: UserLite[];
  verified: UserLite[];
  viewerFollows: string[];
  initialTab?: 'members' | 'verified';
};

const toDbRole = (r: UserLite['role']): 'DOMME' | 'SUBMISSIVE' =>
  String(r).toUpperCase() === 'DOMME' ? 'DOMME' : 'SUBMISSIVE';

const isPremiumActive = (u: UserLite) => {
  const until = u.premiumUntil ? new Date(u.premiumUntil) : null;
  return !!until && until.getTime() > Date.now();
};

function TabsInline({
  active, setActive, counts,
}: {
  active: 'members' | 'verified';
  setActive: (t: 'members' | 'verified') => void;
  counts: { members: number; verified: number };
}) {
  const tabs: Array<{ key: 'members' | 'verified'; label: string; count: number }> = [
    { key: 'members',  label: 'Members',          count: counts.members },
    { key: 'verified', label: 'Verified Members', count: counts.verified },
  ];

  return (
    <div className="px-3 sm:px-4 pb-2">
      <div className="w-full">
        <div className="flex w-full rounded-full border border-white/12 bg-white/[.04] p-1 backdrop-blur">
          {tabs.map(t => {
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                className={`flex-1 px-3 sm:px-4 py-1.5 text-sm rounded-full transition
                  ${isActive
                    ? 'bg-[var(--purple)] text-white shadow-[0_6px_20px_-10px_rgba(139,92,246,.9)]'
                    : 'text-white/80 hover:bg-white/[.08]'}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span className="inline-flex items-center gap-1">
                  {t.label}
                  <span className={`text-[11px] tabular-nums ${isActive ? 'text-white/95' : 'text-white/60'}`}>
                    {t.count.toLocaleString()}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

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

export default function CommunityMembersClient(props: CommunityMembersClientProps) {
  const [tab, setTab] = React.useState<'members' | 'verified'>(props.initialTab ?? 'members');
  const followSet = React.useMemo(() => new Set(props.viewerFollows), [props.viewerFollows]);
  const list = tab === 'members' ? props.members : props.verified;

  return (
    <>
      <TabsInline active={tab} setActive={setTab} counts={props.counts} />

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
            {tab === 'members' ? 'No members yet.' : 'No verified members yet.'}
          </li>
        )}
      </ul>
    </>
  );
}
