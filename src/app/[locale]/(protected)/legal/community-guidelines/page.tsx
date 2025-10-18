import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

type Params = { locale: string };

export default async function LegalPage({ params }: { params: Params }) {
  const { locale } = await params;

  // i18n-Datei manuell laden und Translator erstellen
  let t: ReturnType<typeof createTranslator>;
  try {
    const legalFile = (await import(`@/messages/${locale}/legal.json`)).default;

    // WICHTIG: legalFile hat bereits die richtige Struktur (z.B. { legal: { legal: { overview: {...} } } })
    t = createTranslator({
      locale,
      messages: legalFile,
      namespace: 'legal.guidelines'
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
