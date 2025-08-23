// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    turbopack: {}, // Turbopack ist jetzt stable
    experimental: {
    serverActions: {
      bodySizeLimit: '16mb', // z.B. 10mb, 16mb, 25mb …
    },
  },
};

export default withNextIntl(nextConfig);
