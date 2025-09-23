import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

export default async function PrivacyPage() {
  const t = await getTranslations('common.legal.privacy');

  return (
    <LegalArticle
      title={t('title')}
      subtitle={t('subtitle')}
      updated="30.08.2025"
    >
      <h3 className="font-bold">{t('sections.controller')}</h3>
      <p>{t('content.p_controller')}</p>

      <h3 className="font-bold">{t('sections.data')}</h3>
      <ul>
        <li>{t('content.data_li_1')}</li>
        <li>{t('content.data_li_2')}</li>
        <li>{t('content.data_li_3')}</li>
        <li>{t('content.data_li_4')}</li>
      </ul>

      <h3 className="font-bold">{t('sections.purpose')}</h3>
      <ul>
        <li>{t('content.purpose_li_1')}</li>
        <li>{t('content.purpose_li_2')}</li>
        <li>{t('content.purpose_li_3')}</li>
        <li>{t('content.purpose_li_4')}</li>
      </ul>

      <h3 className="font-bold">{t('sections.legal')}</h3>
      <ul>
        <li>{t('content.legal_li_1')}</li>
        <li>{t('content.legal_li_2')}</li>
        <li>{t('content.legal_li_3')}</li>
      </ul>

      <h3 className="font-bold">{t('sections.sharing')}</h3>
      <ul>
        <li>{t('content.sharing_li_1')}</li>
        <li>{t('content.sharing_li_2')}</li>
        <li>{t('content.sharing_li_3')}</li>
      </ul>

      <h3 className="font-bold">{t('sections.retention')}</h3>
      <p>{t('content.p_retention')}</p>

      <h3 className="font-bold">{t('sections.rights')}</h3>
      <ul>
        <li>{t('content.rights_li_1')}</li>
        <li>{t('content.rights_li_2')}</li>
        <li>{t('content.rights_li_3')}</li>
      </ul>

      <h3 className="font-bold">{t('sections.cookies')}</h3>
      <p>{t('content.p_cookies')}</p>

      <hr />
      <Callout tone="warn" title={t('content.callout_title')}>
        {t('content.callout_body')}
      </Callout>
    </LegalArticle>
  );
}
