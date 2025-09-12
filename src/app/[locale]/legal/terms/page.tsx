// src/app/[locale]/legal/terms/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function TermsPage() {
  const updated = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(new Date());

  return (
    <LegalArticle
      title="Terms of Service (Nutzungsbedingungen)"
      subtitle="Verbindliche Regeln für die Nutzung von Subm8."
      updated={updated}
    >
      <h3 id="geltungsbereich" className="font-bold">1. Geltungsbereich</h3>
      <p>
        Diese Nutzungsbedingungen gelten für die Nutzung der Plattform Subm8 („Plattform“, „wir“)
        durch registrierte Nutzer*innen („User“, „du“). Mit der Registrierung erklärst du dich mit
        diesen Bedingungen einverstanden.
      </p>

      <h3 id="zielgruppe" className="font-bold">2. Zielgruppe &amp; Altersgrenze</h3>
      <ul>
        <li>Nutzung ausschließlich ab 18 Jahren; wir können Alters-/Identitätsnachweise verlangen.</li>
        <li>Plattform kann NSFW-/Adult-Inhalte enthalten. Verboten sind Minderjährige &amp; nicht-einvernehmliche Inhalte.</li>
      </ul>

      <h3 id="rollen-inhalte" className="font-bold">3. Rollen &amp; Inhalte</h3>
      <p>Subm8 ermöglicht Interaktionen zwischen Dommes und Subs.</p>
      <ul>
        <li>Du besitzt die Rechte an deinen Inhalten und verletzt keine Gesetze oder Rechte Dritter.</li>
        <li>Verboten: u. a. nicht-einvernehmliche Darstellungen, Minderjährige, Gewaltverherrlichung, Hetze/Diskriminierung.</li>
        <li>Wir können Inhalte moderieren, sperren oder entfernen, um Gesetze und diese Terms durchzusetzen.</li>
      </ul>

      <h3 id="tips-gifts" className="font-bold">4. Tips („Gifts“)</h3>
      <ul>
        <li><strong>Freiwillige Geschenke</strong>: Tips sind freiwillige Zuwendungen von User zu User.</li>
        <li><strong>Kein Service-Entgelt</strong>: Tips sind <em>keine</em> Bezahlung für Waren/Dienstleistungen
            und <em>begründen keinen Anspruch</em> auf konkrete Inhalte, Antworten oder Handlungen.</li>
        <li><strong>Plattformrolle</strong>: Subm8 vermittelt lediglich die Übertragung (Intermediär) und
            bestimmt nicht, wie Empfänger*innen Tips verwenden.</li>
        <li><strong>Finalität</strong>: Nach Bestätigung sind Gifts grundsätzlich final und nicht erstattbar
            (Ausnahme: gesetzlich zwingend oder klarer technischer Fehler, siehe Refund Policy).</li>
        <li><strong>Services ≠ Gifts</strong>: Separat vereinbarte Services (z. B. Coaching, Custom Content)
            fallen nicht unter „Gifts“. Für solche Leistungen sind ggf. Steuern/Verbraucherschutz zu beachten
            (Eigenverantwortung der Anbieter*innen).</li>
      </ul>

      <h3 id="zahlungen-wallet" className="font-bold">5. Zahlungen, Fees &amp; Payouts</h3>
      <ul>
        <li>Subm8 erhebt eine <strong>Plattformgebühr</strong> (z. B. 10 %) sowie ggf. <strong>Provider-Fees</strong>.</li>
        <li>Bei Gifts wird für Zahler*innen ggf. ein Aufschlag angezeigt („on top“). Der ausgewiesene
            <em>„Amount to creator“</em> ist der Basisbetrag, der Empfänger*innen gutgeschrieben wird.</li>
        <li>Auszahlungen erfolgen ab Mindestbetrag und nach internen Prüfungen (u. a. Risiko/Compliance).</li>
        <li>Chargebacks/Fraud: Wir können Accounts temporär sperren und Beträge zurückhalten, bis Sachverhalte geklärt sind.</li>
      </ul>

      <h3 id="steuern" className="font-bold">6. Steuern &amp; Rechtspflichten der User</h3>
      <ul>
        <li>Du trägst Verantwortung für deine steuerliche Behandlung (z. B. Einkommensteuer, ggf. USt/VAT)
            in deinem Land, soweit anwendbar.</li>
        <li>Subm8 ist nicht Vertragspartei von zwischen Usern separat vereinbarten Services.</li>
        <li>Wo Subm8 rechtlich zur Meldung/Einbehaltung verpflichtet ist, werden wir das tun.</li>
      </ul>

      <h3 id="kündigung-sperre" className="font-bold">7. Kündigung &amp; Enforcement</h3>
      <ul>
        <li>Du kannst dein Konto jederzeit löschen (gesetzliche Aufbewahrungen bleiben unberührt).</li>
        <li>Wir können Accounts sperren/entfernen und Auszahlungen verzögern/ablehnen, wenn Gesetze, diese Terms
            oder Sicherheitsvorgaben verletzt werden.</li>
      </ul>

      <h3 id="haftung" className="font-bold">8. Haftung</h3>
      <ul>
        <li>Wir haften nicht für Verhalten/Leistungen Dritter (andere User, Zahlungsdienstleister).</li>
        <li>Plattform wird „as is“ bereitgestellt; Nutzung auf eigene Verantwortung, soweit gesetzlich zulässig.</li>
      </ul>

      <h3 id="änderungen" className="font-bold">9. Änderungen</h3>
      <p>Wir können diese Terms anpassen; über wesentliche Änderungen informieren wir rechtzeitig innerhalb der App/Web.</p>

      <h3 id="recht" className="font-bold">10. Anwendbares Recht &amp; Gerichtsstand</h3>
      <p>
        Es gilt das Recht des Sitzlandes der Betreiberin (Details im <a href="../imprint">Impressum</a>), unter
        Ausschluss kollisionsrechtlicher Normen, soweit zwingendes Verbraucherschutzrecht nicht entgegensteht.
      </p>

      <hr />
      <Callout tone="info" title="Kurzfassung „Gifts“">
        Gifts sind freiwillig, nicht erstattbar und nicht an Services geknüpft. Subm8 vermittelt nur.
        Für separat vereinbarte Leistungen bist du selbst verantwortlich (inkl. Steuern).
      </Callout>
    </LegalArticle>
  );
}
