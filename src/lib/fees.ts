// src/lib/fees.ts
// Einzige Quelle der Wahrheit für die Tip-Gebührenlogik.
// Sowohl die UI (TipModal) als auch die Route (tips/create) importieren hieraus,
// damit angezeigte und tatsächlich berechnete Beträge nie auseinanderlaufen.

// Aufschlag, den der Sub ZUSÄTZLICH zum Basisbetrag zahlt (10%).
// Die Domme erhält den vollen Basisbetrag; die Plattform erhält den Aufschlag.
export const TIP_TOPUP_RATE = 0.10;

export type TipBreakdown = {
  baseAmountCents: number;   // was die Domme netto bekommt (= Basisbetrag)
  topupFeeCents: number;     // Aufschlag = Plattformanteil
  totalCents: number;        // was der Sub insgesamt zahlt
};

/** Berechnet die Tip-Aufschlüsselung aus dem Basisbetrag (in Cent). */
export function computeTipBreakdown(baseAmountCents: number): TipBreakdown {
  const base = Math.max(0, Math.round(baseAmountCents || 0));
  const topupFeeCents = Math.round(base * TIP_TOPUP_RATE);
  return {
    baseAmountCents: base,
    topupFeeCents,
    totalCents: base + topupFeeCents,
  };
}