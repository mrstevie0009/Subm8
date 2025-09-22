import {getRequestConfig} from 'next-intl/server';

export const locales = ['en', 'de', 'es', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

export default getRequestConfig(async ({locale}) => {
  const activeLocale = (locale ?? defaultLocale) as Locale;
  // deine bestehende Struktur beibehalten
  const messages = (await import(`./src/messages/${activeLocale}/common.json`)).default;
  return {locale: activeLocale, messages};
});
