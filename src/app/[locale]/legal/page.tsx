// src/app/[locale]/legal/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function LegalPage() {
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

      <h3 id="zielgruppe" className="font-bold">2. Zielgruppe</h3>
      <ul>
        <li>Nutzung ausschließlich ab 18 Jahren.</li>
        <li>Inhalte können NSFW / Adult Content enthalten.</li>
        <li>Wir behalten uns vor, Identitäts- oder Altersnachweise zu verlangen.</li>
      </ul>

      <h3 id="rollen-inhalte" className="font-bold">3. Rollen &amp; Inhalte</h3>
      <p>Subm8 ermöglicht Interaktionen zwischen Dommes und Subs.</p>
      <ul>
        <li>Du lädst nur Inhalte hoch, an denen du die Rechte besitzt.</li>
        <li>Keine Verstöße gegen geltendes Recht.</li>
        <li>
          Verboten: Gewaltverherrlichung, nicht-einvernehmliche Inhalte, Minderjährige,
          Diskriminierung.
        </li>
      </ul>

      <h3 id="zahlungen-wallet" className="font-bold">4. Zahlungen &amp; Wallet</h3>
      <ul>
        <li>Dommes können Zahlungen (Tips, Abos, Communities) erhalten.</li>
        <li>Subm8 erhebt eine Plattformgebühr zzgl. ggf. Provider-Fees.</li>
        <li>Auszahlungen ab Mindestbetrag (im Dashboard ausgewiesen).</li>
        <li>Keine Haftung für Rückbuchungen oder externe Zahlungsprobleme.</li>
      </ul>

      <h3 id="kündigung-sperre" className="font-bold">5. Kündigung &amp; Sperre</h3>
      <ul>
        <li>Du kannst dein Konto jederzeit löschen.</li>
        <li>
          Wir können Accounts sperren oder Inhalte entfernen, wenn Gesetze oder diese Bedingungen
          verletzt werden.
        </li>
      </ul>

      <h3 id="haftung" className="font-bold">6. Haftung</h3>
      <ul>
        <li>Wir haften nicht für das Verhalten von Usern.</li>
        <li>Die Nutzung erfolgt auf eigene Verantwortung.</li>
      </ul>

      <h3 id="änderungen" className="font-bold">7. Änderungen</h3>
      <p>
        Wir behalten uns vor, diese Bedingungen anzupassen. Über wesentliche Änderungen informieren
        wir rechtzeitig.
      </p>

      <hr />
      <Callout tone="info" title="Hinweis">
        Ergänzende Dokumente: Datenschutzerklärung, Impressum, Community Guidelines, Refund Policy,
        Age Verification.
      </Callout>
    </LegalArticle>
  );
}
