// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'media.tenor.com' },
      { protocol: 'https', hostname: 'tenor.com' },
      { protocol: 'https', hostname: 'i.giphy.com' },
      { protocol: 'https', hostname: 'media.giphy.com' },
      // Google Profile Avatars (Next/Image Fehler fixen)
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  turbopack: {},
  experimental: {
    serverActions: { bodySizeLimit: '200mb' },
  },
};

export default withNextIntl(nextConfig);
