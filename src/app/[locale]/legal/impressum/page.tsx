import { LegalArticle } from '@/components/legal/LegalArticle';
import { getTranslations } from 'next-intl/server';

export const dynamic = 'force-static';

export default async function ImprintPage() {
  const t = await getTranslations('common.legal.imprint');

  return (
    <LegalArticle
      title={t('title')}
      subtitle={t('subtitle')}
      updated="30.08.2025"
    >
      <p className="text-white/80">
        {t('content.line_1')}<br />
        [Dein Firmenname oder bürgerlicher Name]<br />
        [Straße Hausnummer]<br />
        [PLZ, Stadt, Land]
      </p>
      <p className="mt-3">
        <strong>{t('content.contact_label')}:</strong> E-Mail: [deine Mailadresse]
      </p>
      <p>
        <strong>{t('content.represented_by_label')}:</strong> [Name, falls juristische Person]
      </p>
      <p>
        <strong>{t('content.vat_label')}:</strong> [falls vorhanden]
      </p>
      <hr />
      <p className="text-sm text-white/70">
        {t('content.adult_note')}
      </p>
    </LegalArticle>
  );
}
