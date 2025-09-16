// src/app/[locale]/u/[handle]/ClientProfile.tsx
'use client';

import * as React from 'react';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileTabsContent from '@/components/ProfileTabsContent';
import type { Profile } from '@/types/profile';

type Tab = 'posts' | 'gallery' | 'leaderboard';

type Props = {
  profile: Profile & { pinnedPostId?: string | null }; // server muss dieses Feld mitliefern!
  isOwner: boolean;
  initialIsFollowing?: boolean;

  /** Viewer-Kontext */
  viewerHasBlocked?: boolean;
  isBlockedByProfile?: boolean;
};

/** Custom-Event für Pinning – wird von PostCard konsumiert */
declare global {
  interface WindowEventMap {
    'profile:pinnedChange': CustomEvent<{ postId: string; pinned: boolean }>;
  }
}

/** Zusätzliche Props, die wir an die Tabs weitergeben möchten (ohne any) */
type TabsExtraProps = {
  canPin?: boolean;
  pinnedPostId?: string | null;
  pinVersion?: number;
};
type TabsWithPinProps = React.ComponentProps<typeof ProfileTabsContent> & TabsExtraProps;
const Tabs = ProfileTabsContent as unknown as React.ComponentType<TabsWithPinProps>;

export default function ClientProfile({
  profile,
  isOwner,
  initialIsFollowing = false,
  viewerHasBlocked = false,
  isBlockedByProfile = false,
}: Props) {
  const [tab, setTab] = React.useState<Tab>('posts');

  // Pin-Status vom Server (wird per Events synchron mit Karten gehalten)
  const [pinnedPostId, setPinnedPostId] = React.useState<string | null>(
    profile.pinnedPostId ?? null
  );
  const [pinVersion, setPinVersion] = React.useState(0);

  // Reagiere auf Änderungen, die von PostCard gesendet werden (optimistisches Update)
  React.useEffect(() => {
    const onPinChange = (e: WindowEventMap['profile:pinnedChange']) => {
      const { postId, pinned } = e.detail ?? { postId: '', pinned: false };
      setPinnedPostId(pinned ? postId : null);
      setPinVersion((v) => v + 1);
      if (pinned) {
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
      }
    };
    window.addEventListener('profile:pinnedChange', onPinChange as unknown as EventListener);
    return () =>
      window.removeEventListener('profile:pinnedChange', onPinChange as unknown as EventListener);
  }, []);

  // WICHTIG: Initialen (und jeden geänderten) Pin-Status an alle Karten broadcasten.
  // So wissen PostCards nach Navigation/Reload, welche Karte gepinnt ist.
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pinnedPostId) {
      window.dispatchEvent(
        new CustomEvent('profile:pinnedChange', { detail: { postId: pinnedPostId, pinned: true } })
      );
    } else {
      // Spezialfall: nichts gepinnt → ein "true"-Event mit Dummy-ID sorgt dafür,
      // dass alle Karten sich selbst auf "nicht gepinnt" setzen.
      window.dispatchEvent(
        new CustomEvent('profile:pinnedChange', { detail: { postId: '__none__', pinned: true } })
      );
    }
  }, [pinnedPostId]);

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

      {/* Inhalte der Tabs – zusätzliche Pin-Props sauber typisiert durchreichen */}
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
