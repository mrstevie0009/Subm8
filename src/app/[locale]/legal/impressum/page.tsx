//src/app/[locale]/(protected)/legal/impressum/page.tsx
import { LegalArticle } from '@/components/legal/LegalArticle';
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
      namespace: 'legal.imprint'
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
      <p className="text-white/80">
        {t('content.line_1')}<br />
        Lyncora Media e.U.<br />
        Salzburg<br />
        5020, Österreich
      </p>
      <p className="mt-3">
        <strong>{t('content.contact_label')}:</strong> E-Mail: stephan.schmidbauer@subm8.com
      </p>
      <p>
        <strong>{t('content.represented_by_label')}:</strong> Stephan Schmidbauer
      </p>
      <p>
        <strong>{t('content.vat_label')}:</strong> Keine Umsatzsteuer gemäß § 6 Abs. 1 Z 27 UStG
      </p>
      <hr />
      <p className="text-sm text-white/70">
        {t('content.adult_note')}
      </p>
    </LegalArticle>
  );
}
