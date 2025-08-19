'use client';

import * as React from 'react';
import { SessionProvider } from 'next-auth/react';

export default function Providers({ children }: { children: React.ReactNode }) {
  // Keine Props nötig – SessionProvider holt die Session clientseitig
  return <SessionProvider>{children}</SessionProvider>;
}
