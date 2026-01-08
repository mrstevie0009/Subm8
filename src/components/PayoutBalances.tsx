"use client";

import * as React from "react";

function fmtMoney(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

type StatusOk = {
  ok: true;
  hasAccount: boolean;
  onboardingComplete: boolean;
  payoutsEnabled: boolean;
  requirementsDue?: string[];
  available: { amountCents: number; currency: string };
};

export default function PayoutBalances({
  earnedCents,
  earnedCurrency,
  csvUrl,
  tBalanceTitle,
  tEarnedLabel,
  tAvailableLabel,
  tExportLabel,
  tAvailableHint,
}: {
  earnedCents: number;
  earnedCurrency: string;
  csvUrl: string;

  // Labels aus deinem next-intl Translator (Server -> Props)
  tBalanceTitle: string;
  tEarnedLabel: string;
  tAvailableLabel: string;
  tExportLabel: string;
  tAvailableHint: string;
}) {
  const [loading, setLoading] = React.useState(true);
  const [status, setStatus] = React.useState<StatusOk | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/payouts/status", { method: "GET" });
      const j = (await res.json().catch(() => null)) as StatusOk | null;
      if (res.ok && j?.ok) setStatus(j);
      else setStatus(null);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
    // optional: alle 30s refreshen
    const id = window.setInterval(load, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const availableCents = status?.available.amountCents ?? 0;
  const availableCurrency = status?.available.currency ?? "EUR";

  const availableState =
    !status
      ? "unknown"
      : !status.hasAccount
      ? "no_account"
      : !status.onboardingComplete || !status.payoutsEnabled
      ? "needs_onboarding"
      : "ready";

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
              onClick={load}
              className="px-3 py-2 rounded-full border border-white/15 hover:bg-white/10 text-[14px] whitespace-nowrap"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>

        {/* Cards */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Earned (DB) */}
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="text-[12px] text-white/65">{tEarnedLabel}</div>
            <div className="mt-1 text-[22px] font-semibold tracking-tight">
              {fmtMoney(earnedCents, earnedCurrency)}
            </div>
            <div className="mt-2 text-[12px] text-white/55">
              Summe deiner erfolgreichen Einnahmen (DB: amountNetToDommeCents).
            </div>
          </div>

          {/* Available (Stripe) */}
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[12px] text-white/65">{tAvailableLabel}</div>
                <div className="mt-1 text-[22px] font-semibold tracking-tight">
                  {loading ? "…" : fmtMoney(availableCents, availableCurrency)}
                </div>
              </div>

              <div
                className={`shrink-0 px-2 py-1 rounded-full text-[11px] border ${
                  availableState === "ready"
                    ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                    : availableState === "needs_onboarding"
                    ? "text-yellow-200 border-yellow-500/30 bg-yellow-500/10"
                    : "text-white/70 border-white/15 bg-white/5"
                }`}
              >
                {availableState === "ready"
                  ? "Ready"
                  : availableState === "needs_onboarding"
                  ? "Setup needed"
                  : availableState === "no_account"
                  ? "Not set up"
                  : "Unknown"}
              </div>
            </div>

            <div className="mt-2 text-[12px] text-white/55">{tAvailableHint}</div>

            {status && (availableState === "no_account" || availableState === "needs_onboarding") ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-white/70">
                Stripe Connect ist noch nicht vollständig eingerichtet. Öffne „Auszahlen“ und klicke auf „Stripe Connect
                einrichten“.
              </div>
            ) : null}

            {status?.requirementsDue && status.requirementsDue.length > 0 ? (
              <div className="mt-2 text-[12px] text-white/55">
                Fehlende Angaben: <span className="text-white/75">{status.requirementsDue.join(", ")}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
