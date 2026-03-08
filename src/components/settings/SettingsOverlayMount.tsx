//src/components/settings/SettingsOverlayMount.tsx
'use client';

import * as React from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import SettingsDrawer from '@/components/settings/SettingsDrawer';

export default function SettingsOverlayMount() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const open = React.useMemo(() => {
    const v = searchParams.get('settings');
    return v === '' || v === '1' || v === 'true';
  }, [searchParams]);

  const handleClose = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('settings');

    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  // IMMER mounten (Drawer zeigt sich nur wenn open=true)
  return <SettingsDrawer open={open} onClose={handleClose} />;
}
