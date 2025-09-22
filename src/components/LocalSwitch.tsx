'use client';

import * as React from 'react';
import {usePathname} from 'next/navigation';
// i18n.ts liegt im Projekt-Root -> von src/components aus ist das ../../i18n
import {locales, type Locale} from '../../i18n';

function isLocale(x: string): x is Locale {
  return (locales as readonly string[]).includes(x);
}

export default function LocalSwitch() {
  const pathname = usePathname() || '/';

  const parts = pathname.split('/').filter(Boolean);
  const maybeLocale = parts[0] ?? '';
  const current: Locale | null = isLocale(maybeLocale) ? maybeLocale : null;
  const rest = current ? `/${parts.slice(1).join('/')}` : pathname;

  return (
    <div className="flex gap-2">
      {(locales as readonly Locale[]).map((l: Locale) => {
        const href = `/${l}${rest === '/' ? '' : rest}`;
        return (
          <a key={l} href={href} className={l === current ? 'font-bold' : ''}>
            {l.toUpperCase()}
          </a>
        );
      })}
    </div>
  );
}
