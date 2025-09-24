// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import createIntlMiddleware from 'next-intl/middleware';
import nextIntlConfig from './next-intl.config';

const intl = createIntlMiddleware(nextIntlConfig);

const SUPPORTED_LOCALES = new Set(
  (nextIntlConfig.locales ?? ['en']).map((l: string) => l.toLowerCase())
);
const DEFAULT_LOCALE = (nextIntlConfig.defaultLocale ?? 'en').toLowerCase();

// Lokalisierte ODER nicht-lokalisierte Auth-Routen erlauben
const AUTH_PATHS_NON_LOCALIZED = new Set(['/signin', '/signup']);
const AUTH_RE_LOCALIZED = /^\/[A-Za-z-]{2,5}(?:-[A-Za-z]{2})?\/(signin|signup)\/?$/i;

function hasLocalePrefix(pathname: string): boolean {
  const first = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return !!first && SUPPORTED_LOCALES.has(first);
}
function ensureLocaleUrl(req: NextRequest): URL | null {
  const { pathname, search } = req.nextUrl;
  if (!hasLocalePrefix(pathname)) {
    const url = new URL(`/${DEFAULT_LOCALE}${pathname}${search || ''}`, req.url);
    return url;
  }
  return null;
}
function isAuthRoute(pathname: string): boolean {
  if (AUTH_PATHS_NON_LOCALIZED.has(pathname.toLowerCase())) return true;
  return AUTH_RE_LOCALIZED.test(pathname);
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Skip assets & files
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  // 1) Falls kein Locale-Prefix => auf Default-Locale umschreiben
  const addLocale = ensureLocaleUrl(req);
  if (addLocale) return NextResponse.redirect(addLocale);

  // 2) Auth-Token lesen
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const onAuthPage = isAuthRoute(pathname);

  // 3) Nicht eingeloggt => ALLES sperren außer signin/signup (lokalisiert + nicht-lokalisiert)
  if (!token && !onAuthPage) {
    // baue lokalisierte Signin-URL + callbackUrl
    const locale = pathname.split('/').filter(Boolean)[0]!.toLowerCase();
    const url = new URL(`/${locale}/signin`, req.url);
    const search = req.nextUrl.search || '';
    url.searchParams.set('callbackUrl', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  // 4) Eingeloggt => signin/signup (alle Varianten) blocken -> Home
  if (token && onAuthPage) {
    const locale = pathname.split('/').filter(Boolean)[0]!.toLowerCase();
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }

  // 5) Locale-Handling an next-intl übergeben
  return intl(req);
}

export const config = {
  matcher: ['/((?!api|_next|uploads|.*\\..*).*)'],
};
