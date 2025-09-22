// next-intl.config.ts  (im Projekt-Root)
const nextIntlConfig = {
  locales: ['en', 'de', 'es', 'fr'],
  defaultLocale: 'en',
  localePrefix: 'always',
} as const;

export default nextIntlConfig;
