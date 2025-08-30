// src/app/[locale]/legal/age-verification/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function AgeVerificationPage() {
  return (
    <LegalArticle
      title="Age Verification Policy"
      subtitle="Zugang nur für Volljährige."
      updated="30.08.2025"
    >
      <h3>1. Zugang nur ab 18 Jahren</h3>
      <p>
        Die Nutzung von Subm8 ist ausschließlich Volljährigen gestattet. Mit der Registrierung
        bestätigst du, mindestens 18 Jahre alt zu sein.
      </p>

      <h3 className="mt-8">2. Altersnachweis</h3>
      <ul className="list-disc pl-6 space-y-2">
        <li>
          Wir können eine Verifizierung (z.&nbsp;B. Ausweis-Upload oder externe Anbieter) verlangen.
        </li>
        <li>
          Ohne erfolgreiche Verifizierung kann der Zugang zu bestimmten Funktionen eingeschränkt
          werden.
        </li>
      </ul>

      <h3 className="mt-8">3. Schutz Minderjähriger</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li>Falsche Altersangaben führen zur sofortigen Sperrung des Accounts.</li>
        <li>
          Inhalte mit Bezug zu Minderjährigen sind strikt verboten und werden umgehend gemeldet und
          entfernt.
        </li>
      </ol>

      <hr className="my-8 border-white/10" />
      <Callout tone="danger" title="Null-Toleranz">
        Verstöße gegen Jugendschutzbestimmungen werden konsequent verfolgt – inklusive Meldung an
        zuständige Stellen, wo erforderlich.
      </Callout>
    </LegalArticle>
  );
}
