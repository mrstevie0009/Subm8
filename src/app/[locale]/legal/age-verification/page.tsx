import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

type Params = { locale: string };

export default async function AgeVerificationPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.legal.age'});

  return (
    <LegalArticle
      title={t('title')}
      subtitle={t('subtitle')}
      updated="30.08.2025"
    >
      <h3>{t('sections.access')}</h3>
      <p>{t('content.p_access')}</p>

      <h3 className="mt-8">{t('sections.proof')}</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>{t('content.proof_li_1')}</li>
        <li>{t('content.proof_li_2')}</li>
      </ul>

      <h3 className="mt-8">{t('sections.protection')}</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li>{t('content.protection_li_1')}</li>
        <li>{t('content.protection_li_2')}</li>
      </ol>

      <hr className="my-8 border-white/10" />
      <Callout tone="danger" title={t('content.callout_title')}>
        {t('content.callout_body')}
      </Callout>
    </LegalArticle>
  );
}
