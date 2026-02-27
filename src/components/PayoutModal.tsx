// src/components/PayoutModal.tsx
"use client";

import * as React from "react";

type StripePayoutMode = "AUTO_PAYOUT" | "TRANSFER_ONLY";

type SettingsResponse = {
  method: "STRIPE_CONNECT";
  stripe: {
    accountId: string | null;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    onboardingLastAt: string | null; // JSON date
  };
};

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
    subtitle:
      locale === "de"
        ? "Auszahlungen laufen aktuell ausschließlich über Stripe Connect."
        : "Payouts currently run exclusively via Stripe Connect.",
    amount: locale === "de" ? "Auszahlbar" : "Available",
    back: locale === "de" ? "Zurück" : "Back",
    connect: locale === "de" ? "Stripe verbinden" : "Connect Stripe",
    openOnboarding: locale === "de" ? "Onboarding öffnen" : "Open onboarding",
    request: locale === "de" ? "Auszahlung anfordern" : "Request payout",
    requesting: locale === "de" ? "Wird bearbeitet…" : "Processing…",
    min10: locale === "de" ? "Mindestbetrag: €10" : "Minimum: €10",
    note:
      locale === "de"
        ? "Hinweis: Payouts benötigen ein vollständig abgeschlossenes Stripe-Express-Onboarding."
        : "Note: Payouts require completed Stripe Express onboarding.",
  };

  const [loading, setLoading] = React.useState(true);
  const [stripeAccountId, setStripeAccountId] = React.useState<string | null>(null);
  const [stripeStatus, setStripeStatus] = React.useState<null | {
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    onboardingLastAt: string | null;
  }>(null);

  const [requesting, setRequesting] = React.useState(false);
  const [msg, setMsg] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const [confirmTransferOnly, setConfirmTransferOnly] = React.useState<null | {
    payoutId?: string;
    stripeAccountId?: string;
    stripeTransferId?: string;
    message: string;
  }>(null);

  const connected = !!stripeAccountId;
  const onboardingOk =
    Boolean(stripeStatus?.detailsSubmitted) && Boolean(stripeStatus?.payoutsEnabled);

  const canRequest = availableCents >= 1000 && connected && onboardingOk;

    const loadSettings = React.useCallback(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/payout/settings", { method: "GET", cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as SettingsResponse;

        setStripeAccountId(data?.stripe?.accountId ?? null);
        setStripeStatus({
          detailsSubmitted: Boolean(data?.stripe?.detailsSubmitted),
          payoutsEnabled: Boolean(data?.stripe?.payoutsEnabled),
          chargesEnabled: Boolean(data?.stripe?.chargesEnabled),
          onboardingLastAt: data?.stripe?.onboardingLastAt ?? null,
        });
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

  async function startStripeOnboarding() {
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ origin: window.location.origin, locale }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      const obj = isRecord(data) ? data : null;

      const err = obj && typeof obj.error === "string" ? obj.error : null;
      if (!res.ok) throw new Error(err || (locale === "de" ? "Stripe Onboarding fehlgeschlagen" : "Stripe onboarding failed"));

      const accountId = getString(obj?.accountId);
      const url = getString(obj?.url);

      if (accountId) setStripeAccountId(accountId);
      if (url) window.location.href = url;
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
    }
  }

  async function requestPayout(stripeMode: StripePayoutMode, payoutId?: string) {
    if (availableCents < 1000) {
      setMsg({
        type: "error",
        text:
          locale === "de"
            ? `Mindestbetrag €10. Verfügbar: ${fmtMoney(availableCents, "EUR", locale)}`
            : `Minimum €10. Available: ${fmtMoney(availableCents, "EUR", locale)}`,
      });
      return;
    }

    setRequesting(true);
    setMsg(null);

    try {
      const res = await fetch("/api/payout/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stripeMode, payoutId }),
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
        throw new Error(err || (locale === "de" ? "Auszahlung fehlgeschlagen" : "Payout failed"));
      }

      setMsg({ type: "success", text: locale === "de" ? "✓ Auszahlung angefordert" : "✓ Payout requested" });
      setTimeout(() => window.location.reload(), 1400);
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
    } finally {
      setRequesting(false);
    }
  }

  const ConfirmTransferOnlyModal = confirmTransferOnly ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0b0b0d] shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-white/10">
          <div className="text-[16px] font-semibold">
            {locale === "de" ? "Stripe-Auszahlung nicht aktiviert" : "Stripe payouts not enabled"}
          </div>
          <div className="mt-1 text-[13px] text-white/60">{confirmTransferOnly.message}</div>
        </div>

        <div className="px-5 py-4 space-y-3 text-[13px] text-white/70">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            {locale === "de"
              ? "Du kannst trotzdem fortfahren, indem das Geld nur auf dein Stripe-Balance transferiert wird. Eine Banküberweisung passiert erst, wenn du Payouts aktivierst."
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
              await requestPayout("TRANSFER_ONLY", payoutId);
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
                {availableCents < 1000 ? t.min10 : locale === "de" ? "Bereit zur Auszahlung." : "Ready for payout."}
              </div>

              <div className="mt-3 text-[12px] text-white/55">{t.note}</div>
            </div>

            {/* Stripe card */}
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              {loading ? (
                <div className="text-sm text-white/60">…</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[13px] text-white/75">
                    {locale === "de"
                      ? "Verbinde dein Stripe Express Konto. Danach kannst du Auszahlungen anfordern."
                      : "Connect your Stripe Express account. Then you can request payouts."}
                  </div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                    <div className="text-[13px] text-white/75">
                      {locale === "de" ? "Status" : "Status"}:{" "}
                      {!connected ? (
                        <span className="text-yellow-200">{locale === "de" ? "Nicht verbunden" : "Not connected"}</span>
                      ) : onboardingOk ? (
                        <span className="text-emerald-300">{locale === "de" ? "Bereit" : "Ready"}</span>
                      ) : (
                        <span className="text-yellow-200">
                          {locale === "de" ? "Onboarding unvollständig" : "Onboarding incomplete"}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={startStripeOnboarding}
                      className="px-3 py-2 rounded-xl bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white text-[13px]"
                    >
                      {stripeAccountId ? t.openOnboarding : t.connect}
                    </button>
                  </div>

                  {connected && !onboardingOk ? (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-[12px] text-yellow-100/90">
                      {locale === "de"
                        ? "Dein Stripe Express Onboarding ist noch nicht fertig. Bitte Onboarding öffnen und alle Schritte abschließen, damit Bank-Auszahlungen möglich sind."
                        : "Your Stripe Express onboarding isn’t completed yet. Open onboarding and finish all steps to enable bank payouts."}
                    </div>
                  ) : null}

                  {stripeAccountId ? (
                    <div className="text-[12px] text-white/55">
                      Stripe Account: <span className="font-mono">{stripeAccountId}</span>
                    </div>
                  ) : null}
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
                onClick={() => void requestPayout("AUTO_PAYOUT")}
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
