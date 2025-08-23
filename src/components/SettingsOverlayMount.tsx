'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import SettingsDrawer from '@/components/SettingsDrawer';

export default function SettingsOverlayMount() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const open = React.useMemo(() => {
    // akzeptiert ?settings, ?settings=1, ?settings=true etc.
    const v = searchParams.get('settings');
    return v === '' || v === '1' || v === 'true';
  }, [searchParams]);

  const handleClose = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('settings');

    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // Mounten nur, wenn nötig – SettingsDrawer portaliert ohnehin in document.body
  if (!open) return null;

  return <SettingsDrawer open={open} onClose={handleClose} />;
}
