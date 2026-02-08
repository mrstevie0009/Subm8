// src/components/PayoutBalances.tsx
"use client";

import * as React from "react";

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((cents || 0) / 100);
  } catch {
    return `${(((cents || 0) / 100).toFixed(2))} ${currency}`;
  }
}

type Money = {
  amountCents: number;
  currency: string;
};

type StripeStatus = {
  pending?: Money | null;
};

export default function PayoutBalances({
  earnedCents,
  earnedCurrency,
  csvUrl,
  tBalanceTitle,
  tEarnedLabel,
  tExportLabel,
  tPendingLabel,
  tPendingHint,
}: {
  earnedCents: number;
  earnedCurrency: string;
  csvUrl: string;
  tBalanceTitle: string;
  tEarnedLabel: string;
  tExportLabel: string;
  tPendingLabel: string; // e.g. "Pending"
  tPendingHint: string;  // e.g. "Noch in Verarbeitung – wird später auszahlbar."
}) {
  const [loading, setLoading] = React.useState(true);
  const [pending, setPending] = React.useState<Money | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payouts/status", { method: "GET" });
      if (res.ok) {
        const data = (await res.json()) as StripeStatus;

        const p = data?.pending;
        if (p && typeof p === "object") {
          setPending({
            amountCents: Number(p.amountCents ?? 0),
            currency: String(p.currency ?? earnedCurrency ?? "EUR"),
          });
        } else {
          setPending(null);
        }
      } else {
        setPending(null);
      }
    } catch {
      // Pending is optional; ignore errors
      setPending(null);
    } finally {
      setLoading(false);
    }
  }, [earnedCurrency]);

  React.useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 30_000);
    return () => window.clearInterval(id);
  }, [load]);

  const pendingCents = pending?.amountCents ?? 0;
  const showPending = !loading && pendingCents > 0;

  return (
    <section className="border-y border-white/10">
      <div className="px-4 py-5 md:py-7">
        {/* Top row: title + export */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[17px] font-medium opacity-90">{tBalanceTitle}</div>

          <div className="flex items-center gap-2">
            <a
              href={csvUrl}
              className="px-4 py-2 rounded-full bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white text-[14px] whitespace-nowrap text-center"
            >
              {tExportLabel}
            </a>

            <button
              type="button"
              onClick={() => void load()}
              className="px-3 py-2 rounded-full border border-white/15 hover:bg-white/10 text-[14px] whitespace-nowrap"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Single card: Earned (DB) + Pending */}
        <div className="mt-4">
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="text-[12px] text-white/65">{tEarnedLabel}</div>

            <div className="mt-1 text-[22px] font-semibold tracking-tight">
              {fmtMoney(earnedCents, earnedCurrency)}
            </div>

            <div className="mt-2 text-[12px] text-emerald-400/70">
              ✓ Verfügbar für SEPA-Auszahlung
            </div>

            {/* Pending line (Stripe) */}
            <div className="mt-3 pt-3 border-t border-white/10">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[12px] text-white/65">{tPendingLabel}</div>
                <div className="text-[12px] text-white/80">
                  {loading
                    ? "…"
                    : fmtMoney(pending?.amountCents ?? 0, pending?.currency ?? earnedCurrency)}
                </div>
              </div>
              <div className="mt-1 text-[12px] text-white/50">
                {showPending ? tPendingHint : "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
