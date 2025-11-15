//src/app/[locale]/legal/privacy/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

type Params = { locale: string };

export default async function LegalPage({ params }: { params: Promise<Params> }) {
  const { locale } = await params;

  // i18n-Datei manuell laden und Translator erstellen
  let t: ReturnType<typeof createTranslator>;
  try {
    const legalFile = (await import(`@/messages/${locale}/legal.json`)).default;

    // WICHTIG: legalFile hat bereits die richtige Struktur (z.B. { legal: { legal: { overview: {...} } } })
    t = createTranslator({
      locale,
      messages: legalFile,
      namespace: 'legal.privacy'
    });
  } catch {
    notFound();
  }

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
