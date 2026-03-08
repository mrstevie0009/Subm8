//src/components/settings/SettingsDrawerMount.tsx
'use client';
import * as React from 'react';
import SettingsDrawer from '@/components/settings/SettingsDrawer';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function SettingsDrawerMount() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const open = search.get('settings') === '1';

  const handleClose = React.useCallback(() => {
    const params = new URLSearchParams(search);
    params.delete('settings');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, search]);

  React.useEffect(() => {
    if (!session?.user) return;

    // Sofortiges Fire-and-Forget Prefetching
    const prefetch = () => {
      fetch('/api/me/basic', { cache: 'no-store' }).catch(() => {});
      fetch('/api/me/stats', { cache: 'no-store' }).catch(() => {});
      fetch('/api/suggestions', { cache: 'no-store' }).catch(() => {});
      fetch('/api/account-links', { cache: 'no-store' }).catch(() => {});
    };

    // Starte Prefetch nach 2 Sekunden (damit Initial Page Load nicht blockiert wird)
    const timer = setTimeout(prefetch, 2000);
    return () => clearTimeout(timer);
  }, [session?.user]);

  return <SettingsDrawer open={open} onClose={handleClose} />;
}
