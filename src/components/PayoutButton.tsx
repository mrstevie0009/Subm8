// src/components/PayoutButton.tsx
'use client';

import { useState } from 'react';
import PayoutModal from '@/components/PayoutModal';

export default function PayoutButton({ 
  availableCents,
  locale,
  currentIban,
  currentHolder,
  currentBic,
  tPayoutButton, 
}: { 
  availableCents: number;
  locale: string;
  currentIban?: string | null;
  currentHolder?: string | null;
  currentBic?: string | null;
  tPayoutButton: string; 
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white font-medium hover:opacity-90 transition"
      >
        {tPayoutButton}
      </button>

      {isOpen && (
        <PayoutModal
          availableCents={availableCents}
          locale={locale}
          currentIban={currentIban}
          currentHolder={currentHolder}
          currentBic={currentBic}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}