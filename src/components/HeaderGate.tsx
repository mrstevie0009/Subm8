// src/components/HeaderGate.tsx
'use client';
import { usePathname } from 'next/navigation';
import { useLocale } from 'next-intl';
import ChatHeader from './ChatHeader';

export default function HeaderGate() {
  const pathname = usePathname();
  const locale = useLocale();
  const hide = pathname?.startsWith(`/${locale}/chat`);
  if (hide) return null;
  return <ChatHeader/>;
}
