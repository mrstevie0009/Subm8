// src/app/[locale]/u/[handle]/ClientProfile.tsx
'use client';

import * as React from 'react';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileTabsContent from '@/components/ProfileTabsContent';
import type { Profile } from '@/types/profile';

type Tab = 'posts' | 'gallery' | 'leaderboard';

type Props = {
  profile: Profile;
  isOwner: boolean;
  initialIsFollowing?: boolean;

  /** Vom Server berechnete Block-Flags (Viewer-Kontext) */
  viewerHasBlocked?: boolean;   // ich blockiere dieses Profil
  isBlockedByProfile?: boolean; // dieses Profil blockiert mich
};

export default function ClientProfile({
  profile,
  isOwner,
  initialIsFollowing = false,
  viewerHasBlocked = false,
  isBlockedByProfile = false,
}: Props) {
  const [tab, setTab] = React.useState<Tab>('posts');

  return (
    <div className="space-y-4">
      <ProfileHeader
        profile={profile}
        isOwner={isOwner}
        initialIsFollowing={initialIsFollowing}
        viewerHasBlocked={viewerHasBlocked}
        isBlockedByProfile={isBlockedByProfile}
        activeTab={tab}
        onTabChange={setTab}
        showTabs={true}
      />

      {/* Tabs-Inhalte – Header rendert die Tab-Leiste, hier nur Content je aktivem Tab */}
      <ProfileTabsContent
        handle={profile.username}
        activeTab={tab}
        showTabs={false}
      />
    </div>
  );
}
