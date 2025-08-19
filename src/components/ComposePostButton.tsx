'use client';

import * as React from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import ComposePostModal from '@/components/ComposePostModal';

export default function ComposePostButton({ locale }: { locale: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const { data: session } = useSession();

  const isOpen = search.get('compose') === '1';

  const open = React.useCallback(() => {
    const params = new URLSearchParams(search.toString());
    params.set('compose', '1');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, search]);

  const close = React.useCallback(() => {
    const params = new URLSearchParams(search.toString());
    params.delete('compose');
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, search]);

  const onClick = React.useCallback(() => {
    if (!session?.user) {
      // zurück zur selben Seite nach Sign-in
      const cb = `${pathname}${search.toString() ? `?${search.toString()}` : ''}`;
      router.push(`/${locale}/signin?callbackUrl=${encodeURIComponent(cb)}`);
      return;
    }
    open();
  }, [session?.user, pathname, search, router, locale, open]);

  const iconSize = 'clamp(24px, 2.8vw, 50px)';

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="justify-self-end p-2 rounded hover:bg-white/5 shrink-0 relative inline-grid place-items-center"
        aria-label={session ? 'New Post' : 'Sign in to post'}
        style={{ width: iconSize, height: iconSize, cursor: 'pointer' }}
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          className="pointer-events-none"
          style={{
            color: 'var(--purple)',
            position: 'absolute',
            inset: 0,
            width: '70%',
            height: '70%',
            margin: 'auto',
          }}
        >
          <path d="M11 5a1 1 0 0 1 2 0v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5z" />
        </svg>
      </button>

      {/* Wichtig: KEIN locale-Prop mehr übergeben */}
      <ComposePostModal open={isOpen} onClose={close} />
    </>
  );
}
