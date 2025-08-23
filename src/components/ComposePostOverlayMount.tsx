// src/components/ComposePostOverlayMount.tsx
'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import ComposePostModal from '@/components/ComposePostModal';

export default function ComposePostOverlayMount() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  // Offen, wenn ?compose=1 in der URL steht
  const open = search.get('compose') === '1';

  const close = React.useCallback(() => {
    const qs = new URLSearchParams(search);
    qs.delete('compose');
    const next = qs.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  }, [router, pathname, search]);

  // ESC schließt
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open) return null;

  return <ComposePostModal open={open} onClose={close} />;
}
