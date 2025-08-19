// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: { rules: {} },
    serverActions: {
      // Erhöht das erlaubte Request-Body-Limit für Server Actions (Multipart/FormData)
      bodySizeLimit: '20mb',
    },
  },
};

export default withNextIntl(nextConfig);
