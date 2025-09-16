// src/components/SettingsHost.tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SettingsDrawer from './SettingsDrawer';

/**
 * Host-Komponente: liest ?settings=1 und öffnet den Drawer
 * Schließen entfernt NUR den Param, ohne die Route zu wechseln.
 *
 * In euer (locale-)Layout einbauen, z.B. ganz unten:
 *   <SettingsHost />
 */
export default function SettingsHost() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const open = searchParams.get('settings') === '1';

  const close = React.useCallback(() => {
    const sp = new URLSearchParams(searchParams);
    sp.delete('settings');
    const qs = sp.toString();
    // gleiche Seite behalten
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return <SettingsDrawer open={open} onClose={close} />;
}
