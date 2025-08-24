import createMiddleware from 'next-intl/middleware';
import {locales, defaultLocale} from './i18n';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';


export default createMiddleware({
locales,
defaultLocale,
localePrefix: 'always'
});

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // API, _next, statische Dateien bypassen
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.match(/\.[a-zA-Z0-9]+$/)
  ) {
    return NextResponse.next();
  }

  // ... dein bestehendes Locale-Handling ...
  return NextResponse.next();
}

export const config = {
matcher: ['/((?!api|_next|uploads|.*\\..*).*)'],
};