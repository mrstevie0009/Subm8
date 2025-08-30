// src/app/[locale]/legal/guidelines/page.tsx
import { LegalArticle, Callout } from '@/components/legal/LegalArticle';

export const dynamic = 'force-static';

export default function GuidelinesPage() {
  return (
    <LegalArticle
      title="Community Guidelines"
      subtitle="Respekt, Einvernehmlichkeit und Sicherheit zuerst."
      updated="30.08.2025"
    >
      <ol className="list-decimal pl-6 space-y-3 marker:font-semibold">
        <li>
          <span className="font-semibold">Nur 18+</span> – keine Minderjährigen, keine Inhalte mit
          Bezug zu Minderjährigen.
        </li>
        <li>
          <span className="font-semibold">Einvernehmlichkeit</span> – keine Belästigung, kein Zwang.
        </li>
        <li>
          <span className="font-semibold">Respektvoller Umgang</span> – kein Hate Speech, keine
          Diskriminierung, kein Mobbing.
        </li>
        <li>
          <span className="font-semibold">NSFW-Inhalte</span> – erlaubt, aber korrekt
          gekennzeichnet (z. B. NSFW-Flag).
        </li>
        <li>
          <span className="font-semibold">Privatsphäre</span> – keine Weitergabe privater Daten ohne
          Zustimmung.
        </li>
        <li>
          <span className="font-semibold">Spam &amp; Werbung</span> – verboten, außer klar
          gekennzeichnet und regelkonform.
        </li>
        <li>
          <span className="font-semibold">Missbrauch melden</span> – Verstöße können gemeldet
          werden; Wiederholung führt zu Maßnahmen.
        </li>
      </ol>

      <hr className="my-8 border-white/10" />

      <Callout tone="info" title="Sicher bleiben">
        Nutze die Meldefunktion bei Grenzverletzungen. Unser Team prüft Meldungen zügig und
        verhältnismäßig.
      </Callout>
    </LegalArticle>
  );
}
