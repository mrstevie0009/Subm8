// src/components/PayoutModal.tsx
'use client';

import { useState, useEffect } from 'react';

interface Props {
  availableCents: number;
  locale: string;
  currentIban?: string | null;
  currentHolder?: string | null;
  currentBic?: string | null;
  onClose: () => void;
}

export default function PayoutModal({
  availableCents,
  locale,
  currentIban,
  currentHolder,
  currentBic,
  onClose,
}: Props) {
  const [iban, setIban] = useState(currentIban ?? '');
  const [holder, setHolder] = useState(currentHolder ?? '');
  const [bic, setBic] = useState(currentBic ?? '');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Translations direkt im Code (weil Client Component)
  const t = {
    title: locale === 'de' ? 'Auszahlung beantragen' : locale === 'es' ? 'Solicitar pago' : locale === 'fr' ? 'Demander un paiement' : 'Request Payout',
    amountLabel: locale === 'de' ? 'Auszahlungsbetrag' : locale === 'es' ? 'Monto del pago' : locale === 'fr' ? 'Montant du paiement' : 'Payout Amount',
    ibanLabel: 'IBAN',
    holderLabel: locale === 'de' ? 'Kontoinhaber' : locale === 'es' ? 'Titular de la cuenta' : locale === 'fr' ? 'Titulaire du compte' : 'Account Holder',
    bicLabel: 'BIC/SWIFT',
    payoutButton: locale === 'de' ? 'Jetzt auszahlen' : locale === 'es' ? 'Pagar ahora' : locale === 'fr' ? 'Payer maintenant' : 'Request Payout',
    processingButton: locale === 'de' ? 'Wird bearbeitet...' : locale === 'es' ? 'Procesando...' : locale === 'fr' ? 'En cours...' : 'Processing...',
    backButton: locale === 'de' ? 'Zurück' : locale === 'es' ? 'Volver' : locale === 'fr' ? 'Retour' : 'Back',
    infoText: locale === 'de' 
      ? 'Auszahlungen werden innerhalb von 1-3 Werktagen überwiesen. Gebühr: €0,50 pro Auszahlung.'
      : locale === 'es'
      ? 'Los pagos se transfieren en 1-3 días hábiles. Tarifa: €0,50 por pago.'
      : locale === 'fr'
      ? 'Les paiements sont transférés sous 1 à 3 jours ouvrables. Frais : 0,50 € par paiement.'
      : 'Payouts are transferred within 1-3 business days. Fee: €0.50 per payout.',
    errorMinimum: locale === 'de' ? 'Mindestbetrag: €10' : locale === 'es' ? 'Mínimo: €10' : locale === 'fr' ? 'Minimum : 10 €' : 'Minimum: €10',
    errorRequired: locale === 'de' ? 'IBAN und Kontoinhaber erforderlich' : locale === 'es' ? 'IBAN y titular requeridos' : locale === 'fr' ? 'IBAN et titulaire requis' : 'IBAN and account holder required',
    successMessage: locale === 'de' 
      ? '✓ Auszahlung erfolgreich angefordert!' 
      : locale === 'es'
      ? '✓ Pago solicitado con éxito!'
      : locale === 'fr'
      ? '✓ Paiement demandé avec succès !'
      : '✓ Payout requested successfully!',
  };

  const amountEur = (availableCents / 100).toFixed(2);

  function formatIban(value: string) {
    const cleaned = value.replace(/\s/g, '').toUpperCase();
    return cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
  }

  async function handlePayout() {
    if (availableCents < 1000) {
      setMessage({ type: 'error', text: t.errorMinimum });
      return;
    }

    if (!iban || !holder) {
      setMessage({ type: 'error', text: t.errorRequired });
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      const cleanIban = iban.replace(/\s/g, '');
      
      const saveRes = await fetch('/api/payout/sepa/settings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ 
          iban: cleanIban, 
          accountHolder: holder, 
          bic: bic || null 
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || 'Fehler beim Speichern');
      }

      const payoutRes = await fetch('/api/payout/sepa/request', { method: 'POST' });
      const payoutData = await payoutRes.json();

      if (!payoutRes.ok) {
        throw new Error(payoutData.error || 'Auszahlung fehlgeschlagen');
      }

      setMessage({ type: 'success', text: t.successMessage });

      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (e) {
      setMessage({ 
        type: 'error', 
        text: e instanceof Error ? e.message : 'Error' 
      });
    } finally {
      setProcessing(false);
    }
  }

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#1a1a1a] border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-[20px] font-bold">{t.title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 transition"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-4 rounded-xl bg-[var(--purple)]/10 border border-[var(--purple)]/30">
            <div className="text-[13px] text-white/70 mb-1">{t.amountLabel}</div>
            <div className="text-[28px] font-bold text-[var(--purple)]">€ {amountEur}</div>
          </div>

          <div className="space-y-4">
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
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none font-mono text-[15px]"
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
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none text-[15px]"
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
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none font-mono text-[15px]"
              />
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-[13px] text-white/70">
              💡 <strong>Info:</strong> {t.infoText}
            </div>
          </div>

          {message && (
            <div
              className={`p-4 rounded-xl border text-[14px] ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-red-500/10 border-red-500/30 text-red-200'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition font-medium"
            >
              {t.backButton}
            </button>
            <button
              type="button"
              onClick={handlePayout}
              disabled={processing || !iban || !holder || availableCents < 1000}
              className={`flex-1 px-4 py-3 rounded-xl font-medium transition ${
                processing || !iban || !holder || availableCents < 1000
                  ? 'bg-white/10 text-white/50 cursor-not-allowed'
                  : 'bg-[var(--purple)] text-white hover:opacity-90'
              }`}
            >
              {processing ? t.processingButton : t.payoutButton}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}