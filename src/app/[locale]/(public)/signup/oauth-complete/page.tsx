// src/app/[locale]/signup/oauth-complete/page.tsx
'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { signIn } from 'next-auth/react';

export default function OAuthCompletePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const locale = useLocale();

  const handle = sp.get('handle') ?? '';
  const role = sp.get('role') ?? '';

  React.useEffect(() => {
    if (!handle || !role) {
      router.replace(`/${locale}/signup`);
      return;
    }

    // ✅ Auto-complete signup + Sign in with Google
    (async () => {
      try {
        // 1. Complete signup
        const res = await fetch('/api/signup/oauth-complete', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ handle, role }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(json?.error || 'Signup failed');
        }

        // 2. Sign in with Google
        await signIn('google', { callbackUrl: `/${locale}` });
      } catch (e) {
        console.error(e);
        router.replace(`/${locale}/signup?error=oauth_failed`);
      }
    })();
  }, [handle, role, router, locale]);

  return (
    <div className="grid min-h-screen place-items-center">
      <div className="text-white">Completing signup...</div>
    </div>
  );
}