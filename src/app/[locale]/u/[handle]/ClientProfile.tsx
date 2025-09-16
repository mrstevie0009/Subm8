// src/app/[locale]/u/[handle]/ClientProfile.tsx
'use client';

import * as React from 'react';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileTabsContent from '@/components/ProfileTabsContent';
import type { Profile } from '@/types/profile';

type Tab = 'posts' | 'gallery' | 'leaderboard';

type Props = {
  profile: Profile & { pinnedPostId?: string | null }; // optional erweitert
  isOwner: boolean;
  initialIsFollowing?: boolean;

  /** Viewer-Kontext */
  viewerHasBlocked?: boolean;
  isBlockedByProfile?: boolean;
};

/** Custom-Event für optimistisches Pinning (kommt aus PostCard) */
declare global {
  interface WindowEventMap {
    'profile:pinnedChange': CustomEvent<{ postId: string; pinned: boolean }>;
  }
}

/** Zusätzliche Props, die wir an ProfileTabsContent durchreichen möchten */
type TabsContentExtraProps = {
  canPin?: boolean;
  pinnedPostId?: string | null;
  pinVersion?: number;
};

/** Vollständige Props von ProfileTabsContent + unsere Erweiterungen */
type TabsContentProps = React.ComponentProps<typeof ProfileTabsContent> & TabsContentExtraProps;

// Getypter Alias (keine any-Nutzung)
const Tabs = ProfileTabsContent as React.ComponentType<TabsContentProps>;

export default function ClientProfile({
  profile,
  isOwner,
  initialIsFollowing = false,
  viewerHasBlocked = false,
  isBlockedByProfile = false,
}: Props) {
  const [tab, setTab] = React.useState<Tab>('posts');

  // aktueller Pin-Status (vom Server initial, danach über Event)
  const [pinnedPostId, setPinnedPostId] = React.useState<string | null>(
    profile.pinnedPostId ?? null
  );
  const [pinVersion, setPinVersion] = React.useState(0); // trigger für Re-render/Sortierung

  React.useEffect(() => {
    function handlePinnedChange(e: Event) {
      const ce = e as CustomEvent<{ postId: string; pinned: boolean }>;
      const { postId, pinned } = ce.detail ?? { postId: '', pinned: false };
      setPinnedPostId(pinned ? postId : null);
      setPinVersion((v) => v + 1);
      if (pinned) {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch {}
      }
    }

    window.addEventListener('profile:pinnedChange', handlePinnedChange);
    return () => window.removeEventListener('profile:pinnedChange', handlePinnedChange);
  }, []);

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

      {/* Inhalte der Tabs – zusätzliche Pin-Props durchreichen */}
      <Tabs
        handle={profile.username}
        activeTab={tab}
        showTabs={false}
        canPin={isOwner}
        pinnedPostId={pinnedPostId}
        pinVersion={pinVersion}
      />
    </div>
  );
}
