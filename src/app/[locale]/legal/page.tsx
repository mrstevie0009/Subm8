import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

type Params = { locale: string };

export default async function LegalPage({ params }: { params: Params }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'common.legal.overview'});
  const updated = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date());

  return (
    <LegalArticle
      title={t('title')}
      subtitle={t('subtitle')}
      updated={updated}
    >
      <h3 id="geltungsbereich" className="font-bold">{t('sections.scope')}</h3>
      <p>{t('content.p_scope')}</p>

      <h3 id="zielgruppe" className="font-bold">{t('sections.audience')}</h3>
      <ul>
        <li>{t('content.audience_li_1')}</li>
        <li>{t('content.audience_li_2')}</li>
        <li>{t('content.audience_li_3')}</li>
      </ul>

      <h3 id="rollen-inhalte" className="font-bold">{t('sections.roles')}</h3>
      <p>{t('content.p_roles')}</p>
      <ul>
        <li>{t('content.roles_li_1')}</li>
        <li>{t('content.roles_li_2')}</li>
        <li>{t('content.roles_li_3')}</li>
      </ul>

      <h3 id="zahlungen-wallet" className="font-bold">{t('sections.payments')}</h3>
      <ul>
        <li>{t('content.payments_li_1')}</li>
        <li>{t('content.payments_li_2')}</li>
        <li>{t('content.payments_li_3')}</li>
        <li>{t('content.payments_li_4')}</li>
      </ul>

      <h3 id="kündigung-sperre" className="font-bold">{t('sections.termination')}</h3>
      <ul>
        <li>{t('content.termination_li_1')}</li>
        <li>{t('content.termination_li_2')}</li>
      </ul>

      <h3 id="haftung" className="font-bold">{t('sections.liability')}</h3>
      <ul>
        <li>{t('content.liability_li_1')}</li>
        <li>{t('content.liability_li_2')}</li>
      </ul>

      <h3 id="änderungen" className="font-bold">{t('sections.changes')}</h3>
      <p>{t('content.p_changes')}</p>

      <hr />
      <Callout tone="info" title={t('content.callout_title')}>
        {t('content.callout_body')}
      </Callout>
    </LegalArticle>
  );
}
