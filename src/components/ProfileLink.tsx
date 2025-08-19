'use client';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import * as React from 'react';

export default function ProfileLink({
  handle,
  children,
  className,
  prefetch = true,
}: {
  handle: string;              // darf @ und Großbuchstaben enthalten
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
}) {
  const locale = useLocale();
  const h = (handle.startsWith('@') ? handle.slice(1) : handle).toLowerCase();
  return (
    <Link href={`/${locale}/u/${h}`} className={className} prefetch={prefetch}>
      {children}
    </Link>
  );
}
