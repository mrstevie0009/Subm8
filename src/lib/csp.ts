// src/lib/csp.ts
// Zentraler CSP-Builder. Pro Request mit frischem Nonce aufgerufen.
// Edge-tauglich: keine Node-only-Imports hier verwenden.

const mediaSrcs = [
  'cdn.subm8.com',
  '*.r2.cloudflarestorage.com',
  '*.s3.amazonaws.com',
  'media.tenor.com',
  'c.tenor.com',
  'media1.tenor.com',
  'media2.tenor.com',
  'media3.tenor.com',
  'i.giphy.com',
  'media.giphy.com',
  'lh3.googleusercontent.com',
  process.env.NEXT_PUBLIC_CDN_HOST ?? '',
].filter(Boolean).join(' ');

export function buildCsp(nonce: string, isDev: boolean): string {
  return [
    "default-src 'self'",

    // nonce statt unsafe-inline.
    // Dev braucht unsafe-eval (HMR). js.stripe.com bleibt als Host-Source erlaubt.
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://js.stripe.com`
      : `script-src 'self' 'nonce-${nonce}' https://js.stripe.com`,

    // Styles: Next.js CSS-in-JS braucht weiterhin unsafe-inline (Style-Injection
    // ist deutlich weniger gefährlich als Script-Injection; Nonce für Styles
    // wäre ein separates, größeres Projekt).
    "style-src 'self' 'unsafe-inline'",

    `img-src 'self' blob: data: ${mediaSrcs}`,
    `media-src 'self' blob: ${mediaSrcs}`,

    [
      "connect-src 'self'",
      'https://api.stripe.com',
      'https://stationapi.veriff.com',
      'https://*.r2.cloudflarestorage.com',
      'https://*.s3.amazonaws.com',
      'https://cdn.subm8.com',
      'https://media.tenor.com',
      'https://c.tenor.com',
      'https://media1.tenor.com',
      'https://media2.tenor.com',
      'https://media3.tenor.com',
      'https://i.giphy.com',
      'https://media.giphy.com',
      'https://g.tenor.com',
      isDev ? 'ws://localhost:* http://localhost:3000 http://localhost:3001' : '',
    ].filter(Boolean).join(' '),

    "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://stationapi.veriff.com",
    "font-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ].join('; ');
}