import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

export default async function RefundPage() {
  const t = await getTranslations('common.legal.refund');
  const updated = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date());

  return (
    <LegalArticle
      title={t('title')}
      subtitle={t('subtitle')}
      updated={updated}
    >
      <h3>{t('sections.gifts')}</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li>{t('content.gifts_li_1')}</li>
        <li>{t('content.gifts_li_2')}</li>
      </ol>

      <h3 className="mt-8">{t('sections.subs')}</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li>{t('content.subs_li_1')}</li>
        <li>{t('content.subs_li_2')}</li>
      </ol>

      <h3 className="mt-8">{t('sections.tech')}</h3>
      <p className="mb-3">{t('content.p_tech')}</p>

      <h3 className="mt-8">{t('sections.unauth')}</h3>
      <p>{t('content.p_chargebacks')}</p>

      <h3 className="mt-8">{t('sections.process')}</h3>
      <ul className="list-disc pl-6 space-y-1">
        <li>{t('content.process_li_1')}</li>
        <li>{t('content.process_li_2')}</li>
        <li>{t('content.process_li_3')}</li>
      </ul>

      <hr className="my-8 border-white/10" />
      <Callout tone="warn" title={t('content.callout_title')}>
        {t('content.callout_body')}
      </Callout>
    </LegalArticle>
  );
}
