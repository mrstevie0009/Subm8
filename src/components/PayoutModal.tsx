"use client";

import * as React from "react";

type PayoutMethod = "STRIPE_CONNECT" | "PAXUM" | "COSMO";
const PaxumEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PAXUM_PAYOUT_FEE_CENTS = 150;
const COSMO_PAYOUT_FEE_CENTS = 150;

function estimateFeeCents(method: PayoutMethod) {
  if (method === "PAXUM") return PAXUM_PAYOUT_FEE_CENTS;
  if (method === "COSMO") return COSMO_PAYOUT_FEE_CENTS;
  return 0;
}

function fmtMoney(cents: number, currency: string, locale?: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format((cents || 0) / 100);
  } catch {
    return `${((cents || 0) / 100).toFixed(2)} ${currency}`;
  }
}

function cls(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

type SettingsResponse = {
  method: PayoutMethod;
  stripe: { accountId: string | null };
  paxum: { email: string | null };
  cosmo: { walletId: string | null };
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object";
}

function getString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export default function PayoutModal({
  availableCents,
  locale,
  onClose,
}: {
  availableCents: number;
  locale: string;
  onClose: () => void;
}) {
  const t = {
    title: locale === "de" ? "Auszahlung" : "Payout",
    subtitle: locale === "de" ? "Wähle deine Auszahlungsmethode" : "Choose your payout method",
    amount: locale === "de" ? "Auszahlbar" : "Available",
    method: locale === "de" ? "Methode" : "Method",
    save: locale === "de" ? "Speichern" : "Save",
    saving: locale === "de" ? "Speichere…" : "Saving…",
    request: locale === "de" ? "Auszahlung anfordern" : "Request payout",
    requesting: locale === "de" ? "Wird bearbeitet…" : "Processing…",
    back: locale === "de" ? "Zurück" : "Back",
    min10: locale === "de" ? "Mindestbetrag: €10" : "Minimum: €10",
  };

  const [loading, setLoading] = React.useState(true);
  const [method, setMethod] = React.useState<PayoutMethod>("STRIPE_CONNECT");

  // Stripe
  const [stripeAccountId, setStripeAccountId] = React.useState<string | null>(null);

  // Paxum / CosmomethodCard
  const [paxumEmail, setPaxumEmail] = React.useState("");
  const [cosmoWalletId, setCosmoWalletId] = React.useState("");

  const [saving, setSaving] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [msg, setMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);
  const feeCents = estimateFeeCents(method);
  const netCents = Math.max(0, availableCents - feeCents);
  const [confirmTransferOnly, setConfirmTransferOnly] = React.useState<null | {
    payoutId?: string;
    stripeAccountId?: string;
    stripeTransferId?: string;
    message: string;
  }>(null);

  const canRequest =
    netCents >= 1000 &&
    ((method === "STRIPE_CONNECT" && !!stripeAccountId) ||
    (method === "PAXUM" && PaxumEmailRegex.test(paxumEmail.trim())) ||
    (method === "COSMO" && cosmoWalletId.trim().length >= 4));

  // load existing settings (server truth)
  const loadSettings = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/payout/settings", { method: "GET", cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as SettingsResponse;

      setMethod(data.method ?? "STRIPE_CONNECT");

      setStripeAccountId(data.stripe?.accountId ?? null);

      setPaxumEmail(data.paxum?.email ?? "");
      setCosmoWalletId(data.cosmo?.walletId ?? "");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function saveSettings(): Promise<boolean> {
    setSaving(true);
    setMsg(null);

    try {
      const payload =
        method === "PAXUM"
          ? {
              method,
              paxumEmail: paxumEmail.trim(),
            }
          : method === "COSMO"
          ? {
              method,
              cosmoWalletId: cosmoWalletId.trim(),
            }
          : {
              method, // STRIPE_CONNECT: saves default method only
            };

      const res = await fetch("/api/payout/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const err =
        typeof data === "object" && data && "error" in data && typeof (data as { error?: unknown }).error === "string"
          ? (data as { error: string }).error
          : null;

      if (!res.ok) throw new Error(err || "Fehler beim Speichern");

      setMsg({ type: "success", text: locale === "de" ? "✓ Gespeichert" : "✓ Saved" });
      setTimeout(() => setMsg(null), 2200);
      return true;
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function startStripeOnboarding() {
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin: window.location.origin, locale }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Stripe Onboarding fehlgeschlagen");
      if (data.accountId) setStripeAccountId(String(data.accountId));
      if (data.url) window.location.href = String(data.url);
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
    }
  }

  async function requestPayout() {
    if (netCents < 1000) {
      setMsg({
        type: "error",
        text:
          locale === "de"
            ? `Nach Gebühren beträgt der Mindestbetrag €10. Du erhältst: ${fmtMoney(netCents, "EUR", locale)}`
            : `After fees, the minimum is €10. You receive: ${fmtMoney(netCents, "EUR", locale)}`,
      });
      return;
    }

    setRequesting(true);
    setMsg(null);

    try {
      // 1) Save settings FIRST, and STOP if it fails
      const ok = await saveSettings();
      if (!ok) return;

      // 2) Now request payout
      const res = await fetch("/api/payout/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stripeMode: "AUTO_PAYOUT" }),
      });

      const data: unknown = await res.json().catch(() => ({}));
      const obj = isRecord(data) ? data : null;

      const err = obj && typeof obj.error === "string" ? obj.error : null;
      const code = obj && typeof obj.code === "string" ? obj.code : null;

      if (!res.ok) {
        if (res.status === 409 && code === "PAYOUTS_NOT_ENABLED") {
          setConfirmTransferOnly({
            payoutId: getString(obj?.payoutId) ?? undefined,
            stripeAccountId: getString(obj?.stripeAccountId) ?? undefined,
            stripeTransferId: getString(obj?.stripeTransferId) ?? undefined,
            message:
              err ||
              (locale === "de"
                ? "Bank-Auszahlungen sind auf deinem Stripe-Konto nicht aktiviert."
                : "Bank payouts are not enabled on your Stripe account."),
          });
          return;
        }

        throw new Error(err || "Auszahlung fehlgeschlagen");
      }

      setMsg({
        type: "success",
        text: locale === "de" ? "✓ Auszahlung angefordert" : "✓ Payout requested",
      });

      setTimeout(() => window.location.reload(), 1600);
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setRequesting(false);
    }
  }

  const methodCard = (m: PayoutMethod, title: string, desc: string) => {
    const active = method === m;
    return (
      <button
        type="button"
        onClick={() => setMethod(m)}
        className={cls(
          "w-full text-left p-4 rounded-2xl border transition",
          active ? "border-[var(--purple)]/60 bg-[var(--purple)]/10" : "border-white/10 bg-white/[.03] hover:bg-white/[.06]"
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold">{title}</div>
            <div className="mt-0.5 text-[12px] text-white/60">{desc}</div>
          </div>
          <span
            className={cls(
              "w-5 h-5 rounded-full border grid place-items-center",
              active ? "border-[var(--purple)]/70" : "border-white/20"
            )}
          >
            {active ? <span className="w-2.5 h-2.5 rounded-full bg-[var(--purple)]" /> : null}
          </span>
        </div>
      </button>
    );
  };

  const ConfirmTransferOnlyModal = confirmTransferOnly ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0d] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-[16px] font-semibold">
            {locale === "de" ? "Stripe-Auszahlung nicht aktiviert" : "Stripe payouts not enabled"}
          </div>
          <div className="mt-1 text-[13px] text-white/60">
            {confirmTransferOnly.message}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3 text-[13px] text-white/70">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            {locale === "de"
              ? "Du kannst trotzdem auszahlen, indem das Geld nur auf dein Stripe-Konto (Balance) transferiert wird. Eine Banküberweisung passiert dann erst, wenn du Payouts aktivierst."
              : "You can still proceed by transferring funds to your Stripe balance only. A bank payout will happen only after you enable payouts."}
          </div>
          {confirmTransferOnly.stripeAccountId ? (
            <div className="text-[12px] text-white/50">
              Stripe Account: <span className="font-mono">{confirmTransferOnly.stripeAccountId}</span>
            </div>
          ) : null}
        </div>

        <div className="px-5 py-4 border-t border-white/10 flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmTransferOnly(null)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/5"
          >
            {locale === "de" ? "Abbrechen" : "Cancel"}
          </button>

          <button
            type="button"
            onClick={async () => {
              const payoutId = confirmTransferOnly?.payoutId;
              setConfirmTransferOnly(null);
              // re-run payout request but in TRANSFER_ONLY mode
              setRequesting(true);
              setMsg(null);
              try {
                const res2 = await fetch("/api/payout/request", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ stripeMode: "TRANSFER_ONLY", payoutId}),
                });
                const data2 = (await res2.json().catch(() => ({}))) as unknown;
                const err2 =
                  typeof data2 === "object" && data2 && "error" in data2 && typeof (data2 as { error?: unknown }).error === "string"
                    ? (data2 as { error: string }).error
                    : null;

                if (!res2.ok) throw new Error(err2 || "Auszahlung fehlgeschlagen");

                setMsg({ type: "success", text: locale === "de" ? "✓ Transfer auf Stripe Balance erstellt" : "✓ Transferred to Stripe balance" });
                setTimeout(() => window.location.reload(), 1400);
              } catch (e) {
                setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
              } finally {
                setRequesting(false);
              }
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--purple)] text-white hover:opacity-90"
          >
            {locale === "de" ? "Trotzdem nur auf Stripe" : "Proceed: Stripe balance only"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[#0b0b0d] rounded-2xl border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0b0b0d] border-b border-white/10 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-[20px] font-bold">{t.title}</h2>
            <div className="text-[12px] text-white/60">{t.subtitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition"
            aria-label="Close"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Amount */}
          <div className="p-4 rounded-2xl bg-[var(--purple)]/10 border border-[var(--purple)]/30">
            <div className="text-[12px] text-white/70">{t.amount}</div>
            <div className="mt-1 text-[26px] font-bold text-[var(--purple)]">
              {fmtMoney(availableCents, "EUR", locale)}
            </div>
            <div className="mt-1 text-[12px] text-white/55">
              {availableCents < 1000 ? t.min10 : (locale === "de" ? "Bereit zur Auszahlung." : "Ready for payout.")}
            </div>

            <div className="mt-2 text-[12px] text-white/60">
              {locale === "de"
                ? `Auszahlungsgebühr: ${fmtMoney(feeCents, "EUR", locale)} • Du erhältst: ${fmtMoney(netCents, "EUR", locale)}`
                : `Payout fee: ${fmtMoney(feeCents, "EUR", locale)} • You receive: ${fmtMoney(netCents, "EUR", locale)}`}
            </div>

            {method !== "STRIPE_CONNECT" ? (
              <div className="mt-1 text-[12px] text-white/45">
                {locale === "de"
                  ? "Hinweis: Die Gebühr wird vom Auszahlungsbetrag abgezogen."
                  : "Note: The fee is deducted from your payout amount."}
              </div>
            ) : null}
          </div>

          {/* Methods */}
          <div className="space-y-2">
            <div className="text-[12px] text-white/65">{t.method}</div>

            {methodCard(
              "STRIPE_CONNECT",
              "Stripe Connect",
              locale === "de"
                ? "Du onboardest ein Stripe Express Konto. Auszahlungen laufen über Stripe."
                : "Onboard a Stripe Express account. Payouts handled by Stripe."
            )}

            {methodCard(
              "PAXUM",
              "Paxum",
              locale === "de"
                ? "Payout an deine Paxum E-Mail (manual/extern)."
                : "Payout to your Paxum email (manual/external)."
            )}

            {methodCard(
              "COSMO",
              "Cosmo Payment",
              locale === "de"
                ? "Payout an deine Cosmo Wallet ID (manual/extern)."
                : "Payout to your Cosmo wallet ID (manual/external)."
            )}
          </div>

          {/* Method details */}
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
            {loading ? (
              <div className="text-sm text-white/60">…</div>
            ) : method === "STRIPE_CONNECT" ? (
              <div className="space-y-3">
                <div className="text-[13px] text-white/70">
                  {locale === "de"
                    ? "Verbinde dein Stripe Konto. Danach kannst du Stripe als Auszahlungsmethode verwenden."
                    : "Connect your Stripe account. Then you can use Stripe for payouts."}
                </div>

                <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                  <div className="text-[13px] text-white/75">
                    {locale === "de" ? "Status" : "Status"}:{" "}
                    <span className={stripeAccountId ? "text-emerald-300" : "text-yellow-200"}>
                      {stripeAccountId ? (locale === "de" ? "Verbunden" : "Connected") : (locale === "de" ? "Nicht verbunden" : "Not connected")}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={startStripeOnboarding}
                    className="px-3 py-2 rounded-xl bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white text-[13px]"
                  >
                    {stripeAccountId
                      ? (locale === "de" ? "Onboarding öffnen" : "Open onboarding")
                      : (locale === "de" ? "Stripe verbinden" : "Connect Stripe")}
                  </button>
                </div>

                {stripeAccountId ? (
                  <div className="text-[12px] text-white/55">
                    Stripe Account: <span className="font-mono">{stripeAccountId}</span>
                  </div>
                ) : null}
              </div>
            ) : method === "PAXUM" ? (
              <div className="space-y-3">
                <label className="block text-[13px] text-white/70 mb-1.5">
                  Paxum E-Mail
                </label>
                <input
                  type="email"
                  placeholder="you@domain.com"
                  value={paxumEmail}
                  onChange={(e) => setPaxumEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none"
                />
                <div className="text-[12px] text-white/50">
                  {locale === "de"
                    ? "Hinweis: Diese Methode ist als manuelle/externe Auszahlung gedacht (Admin/Automation später)."
                    : "Note: This is intended as manual/external payout (admin/automation later)."}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="block text-[13px] text-white/70 mb-1.5">
                  Cosmo Wallet ID
                </label>
                <input
                  type="text"
                  placeholder="COSMO-XXXXX"
                  value={cosmoWalletId}
                  onChange={(e) => setCosmoWalletId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white placeholder:text-white/30 focus:border-[var(--purple)] focus:outline-none font-mono"
                />
                <div className="text-[12px] text-white/50">
                  {locale === "de"
                    ? "Hinweis: Diese Methode ist als manuelle/externe Auszahlung gedacht (Admin/Automation später)."
                    : "Note: This is intended as manual/external payout (admin/automation later)."}
                </div>
              </div>
            )}
          </div>

          {/* messages */}
          {msg ? (
            <div
              className={cls(
                "p-4 rounded-2xl border text-[14px]",
                msg.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-red-500/10 border-red-500/30 text-red-200"
              )}
            >
              {msg.text}
            </div>
          ) : null}

          {/* actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition font-medium"
            >
              {t.back}
            </button>

            <button
              type="button"
              onClick={() => void saveSettings()}
              disabled={saving}
              className={cls(
                "px-4 py-3 rounded-xl font-medium transition border",
                saving ? "opacity-60 cursor-not-allowed border-white/15" : "border-white/20 hover:bg-white/10"
              )}
            >
              {saving ? t.saving : t.save}
            </button>

            <button
              type="button"
              onClick={() => void requestPayout()}
              disabled={requesting || !canRequest}
              className={cls(
                "flex-1 px-4 py-3 rounded-xl font-medium transition",
                requesting || !canRequest
                  ? "bg-white/10 text-white/50 cursor-not-allowed"
                  : "bg-[var(--purple)] text-white hover:opacity-90"
              )}
            >
              {requesting ? t.requesting : t.request}
            </button>
          </div>
        </div>
        
      </div>
    </div>
    {ConfirmTransferOnlyModal}
    </>
  );
}
