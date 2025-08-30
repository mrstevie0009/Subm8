import { LegalArticle } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function ImprintPage() {
  return (
    <LegalArticle
      title="Impressum"
      subtitle="Anbieterkennzeichnung gemäß § 5 TMG / EU-Recht."
      updated="30.08.2025"
    >
      <p className="text-white/80">
        Subm8 Plattform<br />
        [Dein Firmenname oder bürgerlicher Name]<br />
        [Straße Hausnummer]<br />
        [PLZ, Stadt, Land]
      </p>
      <p className="mt-3">
        <strong>Kontakt:</strong> E-Mail: [deine Mailadresse]
      </p>
      <p>
        <strong>Vertreten durch:</strong> [Name, falls juristische Person]
      </p>
      <p>
        <strong>Umsatzsteuer-ID:</strong> [falls vorhanden]
      </p>
      <hr />
      <p className="text-sm text-white/70">
        Hinweis: Diese Plattform ist ausschließlich für volljährige Nutzer*innen. Inhalte können
        NSFW/Adult sein.
      </p>
    </LegalArticle>
  );
}
