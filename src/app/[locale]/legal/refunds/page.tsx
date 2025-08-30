// src/app/[locale]/legal/refund/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function RefundPage() {
  return (
    <LegalArticle
      title="Refund Policy"
      subtitle="Regeln zu Erstattungen für Tips, Abos und Fehler."
      updated="30.08.2025"
    >
      <h3>1. Tips &amp; Einmalzahlungen</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li>Tips sind freiwillige Zahlungen und in der Regel final (nicht erstattbar).</li>
        <li>Erstattungen erfolgen nur bei eindeutigem technischem Fehler oder Betrug.</li>
      </ol>

      <h3 className="mt-8">2. Abonnements / Mitgliedschaften</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li>Abos können jederzeit beendet werden (wirksam zum nächsten Abrechnungszeitpunkt).</li>
        <li>Bereits gezahlte Beträge für laufende Zeiträume werden nicht anteilig erstattet.</li>
      </ol>

      <h3 className="mt-8">3. Technische Fehler</h3>
      <p className="mb-3">
        Bei Doppelbelastungen oder Fehlbuchungen erstatten wir selbstverständlich den betroffenen
        Betrag nach Prüfung.
      </p>

      <h3 className="mt-8">4. Chargebacks</h3>
      <p>
        Bei missbräuchlichen Rückbuchungen behalten wir uns vor, den Account vorübergehend zu
        sperren, bis der Sachverhalt geklärt ist.
      </p>

      <hr className="my-8 border-white/10" />
      <Callout tone="warn" title="Wichtig">
        Für Zahlungen gelten zusätzlich die AGB der jeweiligen Zahlungsdienstleister. Diese können
        eigene Fristen und Prüfprozesse vorsehen.
      </Callout>
    </LegalArticle>
  );
}
