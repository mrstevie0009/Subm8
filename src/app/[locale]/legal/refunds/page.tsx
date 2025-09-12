// src/app/[locale]/legal/refund/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function RefundPage() {
  const updated = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date());

  return (
    <LegalArticle
      title="Refund Policy"
      subtitle="Regeln zu Erstattungen für Gifts, Abos und Fehler."
      updated={updated}
    >
      <h3>1. Gifts (Tips) &amp; Einmalzahlungen</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li><strong>Gifts sind freiwillige Zuwendungen</strong> zwischen Usern und grundsätzlich <strong>final</strong> (nicht erstattbar).</li>
        <li>Ausnahmen: gesetzlich zwingend, klarer technischer Fehler (z. B. Doppelbelastung) oder verifizierter Betrug.</li>
      </ol>

      <h3 className="mt-8">2. Abonnements / Mitgliedschaften</h3>
      <ol className="list-disc pl-6 space-y-2 marker:font-semibold">
        <li>Abos können jederzeit gekündigt werden, wirksam zum nächsten Abrechnungszeitpunkt.</li>
        <li>Bereits gezahlte Beträge laufender Perioden werden nicht anteilig erstattet, sofern gesetzlich nicht anders verlangt.</li>
      </ol>

      <h3 className="mt-8">3. Technische Fehler</h3>
      <p className="mb-3">
        Bei Doppelbelastungen oder Fehlbuchungen erstatten wir nach Prüfung. Bitte melde dich innerhalb von
        14&nbsp;Tagen nach Feststellung mit Transaktions-ID und Nachweisen.
      </p>

      <h3 className="mt-8">4. Unautorisierte Zahlungen &amp; Chargebacks</h3>
      <p>
        Bei Chargebacks/Fraud können wir den Account vorübergehend sperren und Auszahlungen zurückhalten,
        bis der Sachverhalt geklärt ist. Missbräuchliche Rückbuchungen können zur Sperre führen.
      </p>

      <h3 className="mt-8">5. Ablauf bei Erstattungen</h3>
      <ul className="list-disc pl-6 space-y-1">
        <li>Support kontaktieren (siehe <a href="../imprint">Impressum</a>) mit Belegen.</li>
        <li>Wir prüfen binnen angemessener Frist und informieren dich über Ergebnis und ggf. Rückzahlungskanal.</li>
        <li>Erstattungen erfolgen grundsätzlich über denselben Zahlungsweg.</li>
      </ul>

      <hr className="my-8 border-white/10" />
      <Callout tone="warn" title="Wichtig">
        Für Zahlungen gelten zusätzlich die AGB/Policies der Zahlungsdienstleister (Provider-Fees,
        Fristen, Prüfprozesse). Subm8 vermittelt Zahlungen, verkauft aber selbst keine Services.
      </Callout>
    </LegalArticle>
  );
}
