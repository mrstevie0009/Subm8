import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

export default async function GuidelinesPage() {
  const t = await getTranslations('common.legal.guidelines');

  return (
    <LegalArticle
      title={t('title')}
      subtitle={t('subtitle')}
      updated="30.08.2025"
    >
      <ol className="list-decimal pl-6 space-y-3 marker:font-semibold">
        <li>{t('list.li_1')}</li>
        <li>{t('list.li_2')}</li>
        <li>{t('list.li_3')}</li>
        <li>{t('list.li_4')}</li>
        <li>{t('list.li_5')}</li>
        <li>{t('list.li_6')}</li>
        <li>{t('list.li_7')}</li>
      </ol>

      <hr className="my-8 border-white/10" />

      <Callout tone="info" title={t('callout_title')}>
        {t('callout_body')}
      </Callout>
    </LegalArticle>
  );
}
