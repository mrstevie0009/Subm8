// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin'
import bundleAnalyzer from '@next/bundle-analyzer'

const withNextIntl = createNextIntlPlugin('./i18n.ts')
const withAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
  analyzerMode: 'server',
  analyzerPort: Number(process.env.ANALYZE_PORT || 8889),
  generateStatsFile: true,
})

const isDev = process.env.NODE_ENV === 'development'

// ✅ Externe CDN-Domain aus ENV lesen (R2/S3 CDN)
const cdnHost = process.env.NEXT_PUBLIC_CDN_HOST ?? ''
const s3PublicHost = (() => {
  try {
    return process.env.S3_PUBLIC_BASE_URL
      ? new URL(process.env.S3_PUBLIC_BASE_URL).hostname
      : ''
  } catch {
    return ''
  }
})()

// Alle erlaubten Medien-Hosts (Bilder, Videos, GIFs)
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
  cdnHost,
  s3PublicHost,
].filter(Boolean).join(' ')

// ✅ Content Security Policy
const cspHeader = [
  // Standardmäßig nichts erlauben
  "default-src 'self'",

  // Skripte: same-origin + Next.js braucht unsafe-inline für Hydration
  // Dev: zusätzlich unsafe-eval für HMR
  isDev
    ? "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com"
    : "script-src 'self' 'unsafe-inline' https://js.stripe.com",

  // Styles: Next.js CSS-in-JS braucht unsafe-inline
  "style-src 'self' 'unsafe-inline'",

  // Bilder: same-origin + externe Medien + blob (Previews) + data (kleine Inline-Bilder)
  `img-src 'self' blob: data: ${mediaSrcs}`,

  // Medien (Video/Audio): same-origin + blob + CDN
  `media-src 'self' blob: ${mediaSrcs}`,

  // API-Verbindungen
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

  // Stripe + Veriff iframes
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://stationapi.veriff.com",

  // Fonts: nur same-origin
  "font-src 'self'",

  // Kein Framing von außen (Clickjacking)
  "frame-ancestors 'none'",

  // Formulare nur an same-origin
  "form-action 'self'",

  // HTTPS erzwingen (nur Prod)
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.subm8.com' },
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },
      { protocol: 'https', hostname: 'media.tenor.com' },
      { protocol: 'https', hostname: 'tenor.com' },
      { protocol: 'https', hostname: 'i.giphy.com' },
      { protocol: 'https', hostname: 'media.giphy.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  turbopack: {},
  experimental: {
    serverActions: { bodySizeLimit: '200mb' },
  },
  outputFileTracingExcludes: {
    '/**': ['.next/cache/**'],
  },

  // Security Headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: cspHeader,
          },
          // Clickjacking-Schutz
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // MIME-Sniffing verhindern
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          // Referrer nicht leaken
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          // HSTS nur in Prod
          ...(isDev ? [] : [
            {
              key: 'Strict-Transport-Security',
              value: 'max-age=63072000; includeSubDomains; preload',
            },
          ]),
          // Permissions – Kamera/Mikro nur wenn explizit erlaubt
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ]
  },
}

export default withAnalyzer(withNextIntl(nextConfig))