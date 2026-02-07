// src/components/SepaPayoutForm.tsx
'use client';

import { useState } from 'react';

interface Props {
  currentIban?: string | null;
  currentHolder?: string | null;
  currentBic?: string | null;
  locale: string;
}

export default function SepaPayoutForm({
  currentIban,
  currentHolder,
  currentBic,
  locale,
}: Props) {
  const [iban, setIban] = useState(currentIban ?? '');
  const [holder, setHolder] = useState(currentHolder ?? '');
  const [bic, setBic] = useState(currentBic ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // IBAN formatieren (Spaces alle 4 Zeichen)
  function formatIban(value: string) {
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);

    try {
      const cleanIban = iban.replace(/\s/g, '');
      
      const res = await fetch('/api/payout/sepa/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          iban: cleanIban, 
          accountHolder: holder, 
          bic: bic || null 
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      setMessage({ type: 'success', text: 'Erfolgreich gespeichert!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ 
        type: 'error', 
        text: e instanceof Error ? e.message : 'Fehler beim Speichern' 
      });
    } finally {
      setSaving(false);
    }
  }

  const t = {
    title: locale === 'de' ? 'Auszahlungskonto (SEPA)' : 'Payout Account (SEPA)',
    ibanLabel: 'IBAN',
    holderLabel: locale === 'de' ? 'Kontoinhaber' : 'Account Holder',
    bicLabel: 'BIC/SWIFT',
    saveButton: locale === 'de' ? 'Speichern' : 'Save',
    savingButton: locale === 'de' ? 'Speichere...' : 'Saving...',
    infoText: locale === 'de' 
      ? 'Auszahlungen werden innerhalb von 1-3 Werktagen überwiesen. Gebühr: €0,50 pro Auszahlung.'
      : 'Payouts are transferred within 1-3 business days. Fee: €0.50 per payout.',
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/[.03] p-4">
      <h3 className="text-[16px] font-semibold mb-4">{t.title}</h3>

      <div className="space-y-3">
        <div>
          <label className="block text-[13px] text-white/70 mb-1.5">
            {t.ibanLabel}
          </label>
          <input
            type="text"
            placeholder="DE89 3704 0044 0532 0130 00"
            value={iban}
            onChange={(e) => setIban(formatIban(e.target.value))}
            maxLength={34}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-[13px] text-white/70 mb-1.5">
            {t.holderLabel}
          </label>
          <input
            type="text"
            placeholder="Max Mustermann"
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            maxLength={100}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-[13px] text-white/70 mb-1.5">
            {t.bicLabel} <span className="text-white/50">(optional)</span>
          </label>
          <input
            type="text"
            placeholder="COBADEFFXXX"
            value={bic}
            onChange={(e) => setBic(e.target.value.toUpperCase())}
            maxLength={11}
            className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none font-mono"
          />
        </div>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !iban || !holder}
          className={`w-full px-4 py-2.5 rounded-lg text-white font-medium transition ${
            saving || !iban || !holder
              ? 'bg-white/10 opacity-60 cursor-not-allowed'
              : 'bg-[var(--purple)] hover:opacity-90'
          }`}
        >
          {saving ? t.savingButton : t.saveButton}
        </button>
      </div>

      {message && (
        <div
          className={`mt-3 p-3 rounded-lg border text-[13px] ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-red-500/10 border-red-500/30 text-red-200'
          }`}
        >
          {message.type === 'success' ? '✓' : '✗'} {message.text}
        </div>
      )}

      <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10">
        <div className="text-[12px] text-white/60">
          💡 <strong>Info:</strong> {t.infoText}
        </div>
      </div>
    </div>
  );
}