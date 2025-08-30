import { LegalArticle, Callout } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function PrivacyPage() {
  return (
    <LegalArticle
      title="Datenschutzerklärung (Privacy Policy / DSGVO)"
      subtitle="Wie wir Daten verarbeiten – transparent und zweckgebunden."
      updated="30.08.2025"
    >
      <h3 className="font-bold">1. Verantwortlicher</h3>
      <p>
        Subm8 (Betreiber: [Dein Name / Firma], [Adresse], [E-Mail]) ist verantwortlich für die
        Verarbeitung personenbezogener Daten auf dieser Plattform.
      </p>

      <h3 className="font-bold">2. Erhobene Daten</h3>
      <ul>
        <li>Registrierungsdaten (Handle, E-Mail, Passwort, Rolle)</li>
        <li>Profildaten (Avatar, Banner, Bio, Community-Mitgliedschaften)</li>
        <li>Zahlungsdaten (Tipps, Abos, Wallet-Salden, Auszahlungen)</li>
        <li>Nutzungsdaten (Logins, Feed-Interaktionen, Nachrichten-Metadaten)</li>
      </ul>

      <h3 className="font-bold">3. Zweck der Verarbeitung</h3>
      <ul>
        <li>Bereitstellung der Plattform und Services</li>
        <li>Abwicklung von Zahlungen &amp; Wallet</li>
        <li>Kommunikation (Chats, Benachrichtigungen)</li>
        <li>Sicherheit, Missbrauchserkennung &amp; Betrugsprävention</li>
      </ul>

      <h3 className="font-bold">4. Rechtsgrundlagen</h3>
      <ul>
        <li>Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO)</li>
        <li>Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO)</li>
        <li>Einwilligung (Art. 6 Abs. 1 lit. a DSGVO) – z. B. Newsletter</li>
      </ul>

      <h3 className="font-bold">5. Weitergabe an Dritte</h3>
      <ul>
        <li>Zahlungsdienstleister (z. B. Stripe, PayPal oder andere PSPs)</li>
        <li>Hosting- &amp; Infrastruktur-Partner (z. B. Vercel, NeonDB)</li>
        <li>Keine Weitergabe an Dritte zu Werbezwecken</li>
      </ul>

      <h3 className="font-bold">6. Speicherdauer</h3>
      <p>
        Speicherung, solange dein Konto aktiv ist. Nach Löschung: Löschung oder Anonymisierung,
        sofern keine gesetzlichen Aufbewahrungspflichten bestehen.
      </p>

      <h3 className="font-bold">7. Betroffenenrechte</h3>
      <ul>
        <li>Auskunft, Berichtigung, Löschung, Einschränkung</li>
        <li>Widerspruch gegen Verarbeitung, Datenübertragbarkeit</li>
        <li>Beschwerderecht bei einer Aufsichtsbehörde</li>
      </ul>

      <h3 className="font-bold">8. Cookies &amp; Tracking</h3>
      <p>
        Subm8 nutzt notwendige Cookies für Login und Sicherheit. Analytics – sofern vorhanden –
        erfolgt anonymisiert/pseudonymisiert.
      </p>

      <hr />
      <Callout tone="warn" title="Transparenz">
        Details zu eingesetzten Anbietern und Speicherorten listen wir in der technischen
        Dokumentation und im Dashboard („Recht &amp; Datenschutz“) auf.
      </Callout>
    </LegalArticle>
  );
}
