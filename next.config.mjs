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
    serverActions: { bodySizeLimit: '10mb' },
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
          // Content-Security-Policy wird pro Request in middleware.ts gesetzt
          // (Nonce-basiert). Hier NICHT mehr statisch setzen.
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