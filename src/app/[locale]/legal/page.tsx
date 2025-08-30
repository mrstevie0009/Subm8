// src/app/[locale]/legal/page.tsx
export const dynamic = 'force-dynamic';

export default function LegalPage() {
  return (
    <article className="p-6 prose prose-invert max-w-none">
      <h2 className="mb-2">Terms of Service (Nutzungsbedingungen)</h2>
      <p className="text-white/60 text-sm mb-6">
        Zuletzt aktualisiert: {new Date().toLocaleDateString()}
      </p>

      <h3>1. Geltungsbereich</h3>
      <p>
        Diese Nutzungsbedingungen gelten für die Nutzung der Plattform Subm8 („Plattform“, „wir“)
        durch registrierte Nutzer*innen („User“, „du“). Mit der Registrierung erklärst du dich mit
        diesen Bedingungen einverstanden.
      </p>

      <h3>2. Zielgruppe</h3>
      <ul>
        <li>Nutzung nur ab 18 Jahren.</li>
        <li>Inhalte können NSFW / Adult Content enthalten.</li>
        <li>Wir behalten uns vor, Identitäts- oder Altersnachweise zu verlangen.</li>
      </ul>

      <h3>3. Rollen &amp; Inhalte</h3>
      <p>Subm8 ermöglicht die Interaktion zwischen Dommes und Subs.</p>
      <ul>
        <li>
          Du darfst nur Inhalte hochladen, an denen du die Rechte besitzt und die nicht gegen
          geltendes Recht verstoßen.
        </li>
        <li>
          Verboten sind insbesondere: Gewaltverherrlichung, nicht-einvernehmlicher Inhalt,
          Minderjährige, Diskriminierung.
        </li>
      </ul>

      <h3>4. Zahlungen &amp; Wallet</h3>
      <ul>
        <li>Dommes können Zahlungen (Tips, Abos, Communities) erhalten.</li>
        <li>Subm8 behält eine Plattformgebühr + ggf. Payment-Provider-Fees ein.</li>
        <li>Auszahlung ab Mindestbetrag (im Dashboard ersichtlich).</li>
        <li>Keine Haftung für Rückbuchungen oder externe Zahlungsprobleme.</li>
      </ul>

      <h3>5. Kündigung &amp; Sperre</h3>
      <ul>
        <li>Du kannst dein Konto jederzeit löschen.</li>
        <li>
          Subm8 kann Accounts sperren oder Inhalte entfernen, wenn Gesetze oder diese Bedingungen
          verletzt werden.
        </li>
      </ul>

      <h3>6. Haftung</h3>
      <ul>
        <li>Subm8 übernimmt keine Haftung für das Verhalten von Usern.</li>
        <li>Die Nutzung erfolgt auf eigene Verantwortung.</li>
      </ul>

      <h3>7. Änderungen</h3>
      <p>
        Wir behalten uns vor, diese Bedingungen anzupassen. Nutzer werden informiert, wenn
        Änderungen wesentlich sind.
      </p>

      <p className="mt-8 text-white/60 text-sm">
        Weitere Richtlinien findest du oben im Menü: Datenschutzerklärung, Impressum, Community
        Guidelines, Refund Policy und Age Verification.
      </p>
    </article>
  );
}
