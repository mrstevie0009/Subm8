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

  // ⬇⬇ WICHTIG: .next/cache NIE in irgendeine Serverless Function mit reinpacken
  outputFileTracingExcludes: {
    // Glob matcht alle Routen ('/[locale]/compose', '/api/…', usw.)
    '/**': ['.next/cache/**'],
  },
}

export default withAnalyzer(withNextIntl(nextConfig))
