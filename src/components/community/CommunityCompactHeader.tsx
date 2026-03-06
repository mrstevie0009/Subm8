// src/components/CommunityCompactHeader.tsx
'use client';

import * as React from 'react';
import CommunityJoinButton from '@/components/community/CommunityJoinButton';
import BackButton from '@/components/BackButton';

type Props = {
  locale: string;
  name: string;
  slug: string;
  initialJoined: boolean;
  initialMembers: number;
  /** ID des Sentinels unter dem großen Header (optional) */
  sentinelId?: string; // default: 'community-top-sentinel'
};

export default function CommunityCompactHeader({
  locale,
  name,
  slug,
  initialJoined,
  initialMembers,
  sentinelId = 'community-top-sentinel',
}: Props) {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const el = document.getElementById(sentinelId);
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sentinelId]);

  return (
    <div
      id="community-compact-header"
      className={`
        fixed top-0 left-0 right-0 z-[58]
        border-b border-white/10
        backdrop-blur bg-black/55
        transition-all duration-200
        ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-3 pointer-events-none'}
      `}
      role="banner"
      aria-hidden={!visible}
    >
      <div className="max-w-2xl mx-auto">
        <div className="h-[56px] px-3 flex items-center gap-3">
          {/* Back */}
          <div className="shrink-0">
            <BackButton fallbackHref={`/${locale}/communities`} />
          </div>

          {/* Name + Handle */}
          <div className="min-w-0 mr-auto">
            <div className="text-[15px] font-semibold truncate">{name}</div>
            <div className="text-[12px] text-white/60 truncate">@{slug}</div>
          </div>

          {/* Join/Leave (ohne size-Prop) – optional etwas kleiner skaliert */}
          <div className="shrink-0 scale-90 origin-right">
            <CommunityJoinButton
              slug={slug}
              initialJoined={initialJoined}
              initialMembers={initialMembers}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
