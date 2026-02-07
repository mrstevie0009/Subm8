// src/components/PayoutButton.tsx
'use client';

import { useState } from 'react';

export default function PayoutButton({ 
  availableCents,
  locale,
}: { 
  availableCents: number;
  locale: string;
}) {
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handlePayout() {
    if (availableCents < 1000) {
      setMessage(locale === 'de' ? 'Mindestbetrag: €10' : 'Minimum: €10');
      return;
    }

    setRequesting(true);
    setMessage(null);

    try {
      const res = await fetch('/api/payout/sepa/request', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Fehler');
      }

      setMessage(locale === 'de' 
        ? '✓ Auszahlung angefordert!' 
        : '✓ Payout requested!'
      );
      
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Error');
    } finally {
      setRequesting(false);
    }
  }

  const disabled = availableCents < 1000 || requesting;

  return (
    <div>
      <button
        type="button"
        onClick={handlePayout}
        disabled={disabled}
        className={`px-4 py-2 rounded-lg font-medium transition ${
          disabled
            ? 'bg-white/10 text-white/50 cursor-not-allowed'
            : 'bg-[var(--purple)] text-white hover:opacity-90'
        }`}
      >
        {requesting 
          ? (locale === 'de' ? 'Anfrage...' : 'Requesting...') 
          : (locale === 'de' ? 'Auszahlen' : 'Payout')
        }
      </button>
      
      {message && (
        <div className="mt-2 text-[12px] text-white/70">
          {message}
        </div>
      )}
    </div>
  );
}