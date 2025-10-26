// src/app/[locale]/u/[handle]/ClientProfile.tsx
'use client';

import * as React from 'react';
import ProfileHeader from '@/components/ProfileHeader';
import ProfileTabsContent from '@/components/ProfileTabsContent';
import type { Profile } from '@/types/profile';
import dynamic from 'next/dynamic';

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { toast } from '@/lib/toast';

const OfferViewerModal = dynamic(() => import('@/components/OfferViewerModal'), {
  ssr: false,
  loading: () => null,
});

const TipModal = dynamic(() => import('@/components/TipModal'), {
  ssr: false,
  loading: () => null,
});
const AutoDrainEnableModal = dynamic(() => import('@/components/AutoDrainEnableModal'), {
  ssr: false,
  loading: () => null,
});

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
  const [offerOpen, setOfferOpen] = React.useState(false);

  const [tipOpen, setTipOpen] = React.useState(false);
  const [autoDrainOpen, setAutoDrainOpen] = React.useState(false);
  const [verifyOpen, setVerifyOpen] = React.useState(false);

  const router = useRouter();
  const locale = useLocale();
  const tVerify = useTranslations('verify');
  const { data: session } = useSession();

  const TIPPAID_PREFIX = 'TIPPAID::';
  const ADACC_PREFIX = 'ADACC::';

  const tipModalRole: 'domme' | 'submissive' =
    profile.role === 'domme' ? 'domme' : 'submissive';

  const startAgeVerification = React.useCallback(async () => {
    try {
      const back = `/${locale}/u/${profile.username}`;
      if (!session) {
        router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`);
        return;
      }
      const res = await fetch(
        `/api/veriff/start?back=${encodeURIComponent(back)}&locale=${locale}`,
        { method: 'POST' }
      );
      const j = await res.json().catch(() => null);
      if (!res.ok || !j?.url) throw new Error(j?.details || j?.error || `HTTP ${res.status}`);
      router.push(j.url as string);
    } catch {
      toast.error('Die Verifikation konnte nicht gestartet werden.', 'Fehler');
    }
  }, [locale, profile.username, router, session]);


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
        onInlineButtonClick={() => setOfferOpen(true)}
        onOpenTip={() => setTipOpen(true)}
        onOpenAutoDrain={() => setAutoDrainOpen(true)}
        onOpenVerify={() => setVerifyOpen(true)}
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
      <OfferViewerModal
        open={offerOpen}
        onClose={() => setOfferOpen(false)}
        handle={profile.username}
      />

      <TipModal
        open={tipOpen}
        onClose={() => setTipOpen(false)}
        toUserId={profile.id}
        toDisplayName={profile.displayName}
        toRole={tipModalRole}
        toAvatarUrl={profile.avatarUrl || undefined}
        onSuccess={({ paymentId, amountCents, currency, note }) => {
          const payload = { id: paymentId, amountCents, currency, note: note?.trim() || undefined };
          const envelope = `${TIPPAID_PREFIX}${JSON.stringify(payload)}`;
          setTipOpen(false);
          router.push(`/${locale}/chat/new?to=${profile.username}&text=${encodeURIComponent(envelope)}`);
        }}
      />

      <AutoDrainEnableModal
        open={autoDrainOpen}
        onClose={() => setAutoDrainOpen(false)}
        toUserId={profile.id}
        toDisplayName={profile.displayName}
        toAvatarUrl={profile.avatarUrl || undefined}
        defaultCurrency="EUR"
        onSuccess={({ autoDrainId, amountCents, currency, cadence }) => {
          const payload = { id: autoDrainId, amountCents, currency, cadence };
          const envelope = `${ADACC_PREFIX}${JSON.stringify(payload)}`;
          setAutoDrainOpen(false);
          router.push(`/${locale}/chat/new?to=${profile.username}&text=${encodeURIComponent(envelope)}`);
        }}
      />

      {/* Verify Prompt jetzt auf der Page */}
      {verifyOpen && (
        <div
          className="fixed inset-0 z-[2147483604] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setVerifyOpen(false)}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-[min(520px,92vw)] rounded-2xl border border-white/12 bg-[#0b0b0d] p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-[18px] font-semibold">{tVerify('modal.title')}</h2>
            <p className="mt-2 text-white/80">{tVerify('modal.message')}</p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded-lg border border-white/15 hover:bg-white/10"
                onClick={() => setVerifyOpen(false)}
              >
                {tVerify('modal.cancel')}
              </button>
              <button
                type="button"
                className="px-4 py-2 rounded-lg bg-[var(--purple)] hover:opacity-95 text-white"
                onClick={() => void startAgeVerification()}
              >
                {tVerify('modal.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
