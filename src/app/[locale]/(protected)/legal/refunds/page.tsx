import { LegalArticle, Callout } from '@/components/legal/LegalArticle';
import { createTranslator } from 'next-intl';
import { notFound } from 'next/navigation';

export const dynamic = 'force-static';

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
      namespace: 'legal.refund'
    });
  } catch {
    notFound();
  }
  const updated = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date());

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
