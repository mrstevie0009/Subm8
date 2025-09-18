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
    ],
  },
  turbopack: {},
  experimental: {
    serverActions: { bodySizeLimit: '200mb' },
  },
};

export default withNextIntl(nextConfig);
