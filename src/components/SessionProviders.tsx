'use client';

import * as React from 'react';
import { SessionProvider } from 'next-auth/react';

export default function SessionProviders({ children }: { children: React.ReactNode }) {
  // Optional kannst du hier <Suspense> o.Ä. verwenden, aber nicht nötig
  return <SessionProvider>{children}</SessionProvider>;
}
