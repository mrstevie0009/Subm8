'use client';

import SettingsDrawer from '@/components/SettingsDrawer';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function SettingsDrawerMount() {
  const search = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const open = search.get('settings') === '1';

  const handleClose = () => {
    const params = new URLSearchParams(search); // clone (search ist read-only)
    params.delete('settings');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  return <SettingsDrawer open={open} onClose={handleClose} />;
}
