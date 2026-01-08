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

export default function PayoutButton({ tooltip }: { tooltip?: string }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState<StatusOk | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [amount, setAmount] = React.useState<string>("");

  async function loadStatus() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payouts/status", { method: "GET" });
      const j = (await res.json().catch(() => null)) as StatusOk | null;
      if (!res.ok || !j || j.ok !== true) throw new Error("Failed to load payout status");
      setStatus(j);
      setAmount(String(Math.max(0, Math.floor((j.available.amountCents || 0) / 100)))); // default: whole euros
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function startOnboarding() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payouts/onboard", { method: "POST" });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; url?: string; error?: string } | null;
      if (!res.ok || !j?.ok || !j.url) throw new Error(j?.error || "Failed to start onboarding");
      window.location.href = j.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start onboarding");
      setLoading(false);
    }
  }

  async function createPayout() {
    if (!status) return;

    const cents = Math.round(Number(String(amount).replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents <= 0) {
      setError("Invalid amount");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/payouts/create", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amountCents: cents }),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !j?.ok) throw new Error(j?.error || "Payout failed");

      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payout failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="px-4 py-1.5 rounded-full bg-[var(--purple)] hover:opacity-95 text-white"
        title={tooltip}
        onClick={() => {
          setOpen(true);
          loadStatus();
        }}
      >
        Auszahlen
      </button>

      {open ? (
        <div className="fixed inset-0 z-[1200] grid place-items-center bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="w-[min(620px,92vw)] rounded-2xl overflow-hidden border border-white/10 bg-[#0b0b0d]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center">
              <div className="font-semibold text-[16px]">Auszahlung</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="ml-auto inline-grid place-items-center w-9 h-9 rounded-full hover:bg-white/10"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-5">
              {error ? (
                <div className="mb-3 text-[13px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                  {error}
                </div>
              ) : null}

              {loading && !status ? (
                <div className="text-[13px] text-white/60">Lade …</div>
              ) : status ? (
                <>
                  <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
                    <div className="text-[13px] text-white/70">Verfügbar zur Auszahlung</div>
                    <div className="mt-1 text-[18px] font-semibold">
                      {fmtMoney(status.available.amountCents, status.available.currency)}
                    </div>

                    {!status.hasAccount || !status.onboardingComplete || !status.payoutsEnabled ? (
                      <div className="mt-3 text-[12px] text-white/65">
                        Du musst einmal Stripe Connect abschließen (Konto/Bankverbindung), damit Auszahlungen möglich sind.
                      </div>
                    ) : null}

                    {status.requirementsDue && status.requirementsDue.length > 0 ? (
                      <div className="mt-2 text-[12px] text-white/60">
                        Fehlende Angaben: {status.requirementsDue.join(", ")}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex gap-2">
                    {!status.hasAccount || !status.onboardingComplete || !status.payoutsEnabled ? (
                      <button
                        type="button"
                        onClick={startOnboarding}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-60"
                      >
                        Stripe Connect einrichten
                      </button>
                    ) : (
                      <>
                        <div className="flex-1 rounded-xl border border-white/10 bg-white/[.03] px-3 py-2">
                          <label className="block text-[12px] text-white/70 mb-1">Betrag (EUR)</label>
                          <input
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            inputMode="decimal"
                            className="w-full bg-transparent outline-none text-[16px]"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={createPayout}
                          disabled={loading}
                          className="px-4 py-2 rounded-lg bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-60 whitespace-nowrap"
                        >
                          Auszahlung starten
                        </button>
                      </>
                    )}
                  </div>

                  <div className="mt-3 text-[12px] text-white/55">
                    Hinweis: “Verfügbar” ist das Stripe-Connect-Balance der Domme. Es füllt sich, sobald dein Webhook Transfers erstellt.
                  </div>
                </>
              ) : (
                <div className="text-[13px] text-white/60">Keine Daten.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
