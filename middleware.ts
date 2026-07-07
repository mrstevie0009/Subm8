// middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import createIntlMiddleware from 'next-intl/middleware';
import nextIntlConfig from './next-intl.config';
import { buildCsp } from './src/lib/csp';

const intl = createIntlMiddleware(nextIntlConfig);

const SUPPORTED_LOCALES = new Set(
  (nextIntlConfig.locales ?? ['en']).map((l: string) => l.toLowerCase())
);
const DEFAULT_LOCALE = (nextIntlConfig.defaultLocale ?? 'en').toLowerCase();

// Öffentliche Auth-Routen (lokalisiert + nicht-lokalisiert)
const AUTH_PATHS_NON_LOCALIZED = new Set(['/signin', '/signup', '/signin-bridge']);
const AUTH_RE_LOCALIZED =
  /^\/[A-Za-z-]{2,5}(?:-[A-Za-z]{2})?\/(signin|signup|signin-bridge)\/?$/i;

// 18+ geschützte Pfade NACH dem Locale-Segment
const PROTECTED_PREFIXES = ['chat', 'messages', 'images']; // ggf. erweitern

function hasLocalePrefix(pathname: string): boolean {
  const first = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return !!first && SUPPORTED_LOCALES.has(first);
}

function isAuthRoute(pathname: string): boolean {
  if (AUTH_PATHS_NON_LOCALIZED.has(pathname.toLowerCase())) return true;
  return AUTH_RE_LOCALIZED.test(pathname);
}

function needsAgeVerification(req: NextRequest): boolean {
  const { pathname, searchParams } = req.nextUrl;

  // 1) Post-Composer über Query (?compose=1)
  if (searchParams.get('compose') === '1') return true;

  // 2) Präfixe nach Locale schützen: /<locale>/<prefix>...
  const parts = pathname.split('/').filter(Boolean);
  const afterLocale = parts.slice(1); // alles nach dem ersten Segment (Locale)
  const firstAfterLocale = (afterLocale[0] ?? '').toLowerCase();

  if (PROTECTED_PREFIXES.includes(firstAfterLocale)) return true;
  return false;
}

// Robustes Token-Reading: unterstützt HTTP (dev) & HTTPS (__Secure-…)
async function readAuthToken(req: NextRequest) {
  // Versuch 1: HTTPS-Cookie (__Secure-…)
  let token =
    await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: '__Secure-next-auth.session-token',
    });

  // Versuch 2: HTTP-Dev-Cookie (next-auth.session-token)
  if (!token) {
    token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: 'next-auth.session-token',
    });
  }

  // Versuch 3: Standard (getToken entscheidet selbst über den Namen)
  if (!token) {
    token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  }

  return token;
}

export default async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 0) Skip: API, Next assets, Uploads, statische Dateien
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/uploads') ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const isLocalized = hasLocalePrefix(pathname);
  const onAuthPage = isAuthRoute(pathname);

  // 1) Nicht-lokalisierte Auth-Routen → auf lokalisierte umbiegen (z. B. /signin → /en/signin)
  if (!isLocalized && AUTH_PATHS_NON_LOCALIZED.has(pathname.toLowerCase())) {
    const url = new URL(`/${DEFAULT_LOCALE}${pathname}${search || ''}`, req.url);
    return NextResponse.redirect(url);
  }

  // 2) Kein Locale-Prefix? → Default-Locale injizieren
  if (!isLocalized) {
    const url = new URL(`/${DEFAULT_LOCALE}${pathname}${search || ''}`, req.url);
    return NextResponse.redirect(url);
  }

  // 3) Auth-Token robust lesen (HTTP/HTTPS)
  const token = await readAuthToken(req);

  // 4) Nicht eingeloggt → alles sperren außer Auth-Seiten
  if (!token && !onAuthPage) {
    const locale = pathname.split('/').filter(Boolean)[0]!.toLowerCase();
    const url = new URL(`/${locale}/signin`, req.url);
    url.searchParams.set('callbackUrl', `${pathname}${search || ''}`);
    return NextResponse.redirect(url);
  }

  // 5) Eingeloggt → Auth-Seiten blocken → Home
  if (token && onAuthPage) {
    const locale = pathname.split('/').filter(Boolean)[0]!.toLowerCase();
    return NextResponse.redirect(new URL(`/${locale}`, req.url));
  }

  // 6) Altersgate: eingeloggt & nicht verifiziert & Route erfordert 18+
  if (token && !token.ageVerified && needsAgeVerification(req)) {
    const locale = pathname.split('/').filter(Boolean)[0]!.toLowerCase();
    const back = `${pathname}${search || ''}`;
    const url = new URL(`/${locale}/verify/complete`, req.url);
    url.searchParams.set('back', back);
    return NextResponse.redirect(url);
  }

  // 7) Locale-Handling (next-intl) + CSP-Nonce
  const isDev = process.env.NODE_ENV !== 'production';

  // Pro-Request-Nonce (Edge-tauglich: Web-Crypto + btoa)
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, isDev);

  // Nonce + CSP auf die REQUEST-Header:
  // - x-nonce: damit unser eigenes Inline-Skript den Wert lesen kann
  // - Content-Security-Policy: damit Next.js seine Hydration-Skripte automatisch nonce't
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  // next-intl mit einer Anfrage laufen lassen, die die angereicherten Header trägt.
  const intlReq = new NextRequest(req.nextUrl, {
    headers: requestHeaders,
  });
  const res = intl(intlReq);

  // CSP zusätzlich auf die RESPONSE (für den Browser).
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  // Deckt die App-Router-Routen ab, excl. API/Assets/Dateien
  matcher: ['/((?!api|_next|uploads|.*\\..*).*)'],
};
