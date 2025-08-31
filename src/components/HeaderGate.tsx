// src/components/HeaderGate.tsx
'use client';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';

export default function HeaderGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const locale = useLocale();
  const hide = pathname?.startsWith(`/${locale}/chat`);
  if (hide) return null;          // auf Chat-Seiten keinen globalen Header
  return <>{children}</>;         // sonst den übergebenen Header rendern
}
