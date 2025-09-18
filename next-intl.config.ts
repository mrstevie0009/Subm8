// next-intl.config.ts  (im Projekt-Root)
const nextIntlConfig = {
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'always',
} as const;

export default nextIntlConfig;
