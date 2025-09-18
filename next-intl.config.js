import {defineConfig} from 'next-intl';

export default defineConfig({
  locales: ['en', 'de'],
  defaultLocale: 'en',
  localePrefix: 'always'
});
