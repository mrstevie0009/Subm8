// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin'
import bundleAnalyzer from '@next/bundle-analyzer'

const withNextIntl = createNextIntlPlugin('./i18n.ts')
const withAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: true,
  analyzerMode: 'server',
  analyzerPort: Number(process.env.ANALYZE_PORT || 8889), // ⬅ Port wechseln
  generateStatsFile: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      // your CDN
      { protocol: 'https', hostname: 'cdn.subm8.com' },

      // (optional) fallback hosts you *might* produce from older rows/configs
      // R2 custom/public endpoints (only if you ever use them)
      { protocol: 'https', hostname: '*.r2.cloudflarestorage.com' },
      // S3-style URLs (only if your publicBaseUrl ever points there)
      { protocol: 'https', hostname: '*.s3.amazonaws.com' },

      // existing providers
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
}

export default withAnalyzer(withNextIntl(nextConfig))
