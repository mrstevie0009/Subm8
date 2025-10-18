// src/app/[locale]/(protected)/legal/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

type Params = { locale: string };

export default async function LegalPage({ params }: { params: Params }) {
  const { locale } = await params;

  // Beide (overview & terms) sollen den längeren "terms"-Text nutzen
  let t: ReturnType<typeof createTranslator>;
  try {
    const legalFile = (await import(`@/messages/${locale}/legal.json`)).default;
    t = createTranslator({
      locale,
      messages: legalFile,
      namespace: 'legal.terms'
    });
  } catch {
    notFound();
  }

  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date());

  return (
    <LegalArticle title={t('title')} subtitle={t('subtitle')} updated={updated}>
      {/* 1. Scope */}
      <h3 id="geltungsbereich" className="font-bold">{t('sections.scope')}</h3>
      <p>{t('content.p_scope')}</p>

      {/* 2. Audience */}
      <h3 id="zielgruppe" className="font-bold">{t('sections.audience')}</h3>
      <ul>
        <li>{t('content.audience_li_1')}</li>
        <li>{t('content.audience_li_2')}</li>
      </ul>

      {/* 3. Roles & content */}
      <h3 id="rollen-inhalte" className="font-bold">{t('sections.roles')}</h3>
      <p>{t('content.p_roles')}</p>
      <ul>
        <li>{t('content.roles_li_1')}</li>
        <li>{t('content.roles_li_2')}</li>
        <li>{t('content.roles_li_3')}</li>
      </ul>

      {/* 4. Tips (“gifts”) */}
      <h3 id="tips-gifts" className="font-bold">{t('sections.tips')}</h3>
      <ul>
        <li><strong>{t('content.tips_li_1').split(':')[0]}</strong>: {t('content.tips_li_1').split(':').slice(1).join(':').trim()}</li>
        <li><strong>{t('content.tips_li_2').split(':')[0]}</strong>: {t('content.tips_li_2').split(':').slice(1).join(':').trim()}</li>
        <li><strong>{t('content.tips_li_3').split(':')[0]}</strong>: {t('content.tips_li_3').split(':').slice(1).join(':').trim()}</li>
        <li><strong>{t('content.tips_li_4').split(':')[0]}</strong>: {t('content.tips_li_4').split(':').slice(1).join(':').trim()}</li>
        <li><strong>{t('content.tips_li_5').split(':')[0]}</strong>: {t('content.tips_li_5').split(':').slice(1).join(':').trim()}</li>
      </ul>

      {/* 5. Payments, fees & payouts */}
      <h3 id="zahlungen-wallet" className="font-bold">{t('sections.fees')}</h3>
      <ul>
        <li>{t('content.fees_li_1')}</li>
        <li>{t('content.fees_li_2')}</li>
        <li>{t('content.fees_li_3')}</li>
        <li>{t('content.fees_li_4')}</li>
      </ul>

      {/* 6. Taxes */}
      <h3 id="steuern" className="font-bold">{t('sections.tax')}</h3>
      <ul>
        <li>{t('content.tax_li_1')}</li>
        <li>{t('content.tax_li_2')}</li>
        <li>{t('content.tax_li_3')}</li>
      </ul>

      {/* 7. Termination & enforcement */}
      <h3 id="kündigung-sperre" className="font-bold">{t('sections.termination')}</h3>
      <ul>
        <li>{t('content.termination_li_1')}</li>
        <li>{t('content.termination_li_2')}</li>
      </ul>

      {/* 8. Liability */}
      <h3 id="haftung" className="font-bold">{t('sections.liability')}</h3>
      <ul>
        <li>{t('content.liability_li_1')}</li>
        <li>{t('content.liability_li_2')}</li>
      </ul>

      {/* 9. Changes */}
      <h3 id="änderungen" className="font-bold">{t('sections.changes')}</h3>
      <p>{t('content.p_changes')}</p>

      {/* 10. Applicable law */}
      <h3 id="recht" className="font-bold">{t('sections.law')}</h3>
      <p>{t('content.p_law')}</p>

      <hr />
      <Callout tone="info" title={t('content.callout_title')}>
        {t('content.callout_body')}
      </Callout>
    </LegalArticle>
  );
}
