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
};

export default function ClientProfile({ profile, isOwner, initialIsFollowing = false }: Props) {
  const [tab, setTab] = React.useState<Tab>('posts');

  return (
    <div className="space-y-4">
      <ProfileHeader
        profile={profile}
        isOwner={isOwner}
        initialIsFollowing={initialIsFollowing}
        activeTab={tab}
        onTabChange={setTab}
        showTabs={true}         // Tabs NUR im Header anzeigen
      />

      {/* Inhalte – Tabs hier NICHT rendern, nur Content nach aktivem Tab */}
      <ProfileTabsContent
        handle={profile.username}
        activeTab={tab}
        showTabs={false}
      />
    </div>
  );
}
