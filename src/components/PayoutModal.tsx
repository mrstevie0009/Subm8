// src/components/PayoutModal.tsx
"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { useStepUp } from "@/hooks/useStepUp";
import { StepUpDialog } from "@/components/StepUpDialog";

type StripePayoutMode = "AUTO_PAYOUT" | "TRANSFER_ONLY";

type SettingsResponse = {
  method: "STRIPE_CONNECT";
  stripe: {
    accountId: string | null;
    detailsSubmitted: boolean;
    payoutsEnabled: boolean;
    chargesEnabled: boolean;
    onboardingLastAt: string | null;
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
  const t = useTranslations("payment.payoutModal");

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
  const onboardingOk = Boolean(stripeStatus?.detailsSubmitted) && Boolean(stripeStatus?.payoutsEnabled);
  const canRequest = availableCents >= 1000 && connected && onboardingOk;

  const stepUp = useStepUp();
  const [stepUpOpen, setStepUpOpen] = React.useState(false);
  const [stepUpLabel, setStepUpLabel] = React.useState("");
  const pendingActionRef = React.useRef<(() => void) | null>(null);

  function withStepUp(label: string, action: () => void) {
    if (stepUp.isVerified) { action(); return; }
    setStepUpLabel(label);
    pendingActionRef.current = action;
    setStepUpOpen(true);
  }

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

  React.useEffect(() => { void loadSettings(); }, [loadSettings]);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  React.useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function startStripeOnboarding() {
    withStepUp(t("connect"), () => void doStartStripeOnboarding());
  }

  async function doStartStripeOnboarding() {
    setMsg(null);
    try {
      const res = await fetch("/api/stripe/connect/onboard", {
        method: "POST",
        headers: { "content-type": "application/json", ...stepUp.stepUpHeaders() },
        body: JSON.stringify({ origin: window.location.origin, locale }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      const obj = isRecord(data) ? data : null;
      const err = obj && typeof obj.error === "string" ? obj.error : null;
      if (!res.ok) throw new Error(err || t("errors.onboardingFailed"));
      const accountId = getString(obj?.accountId);
      const url = getString(obj?.url);
      if (accountId) setStripeAccountId(accountId);
      if (url) window.location.href = url;
    } catch (e) {
      setMsg({ type: "error", text: e instanceof Error ? e.message : "Error" });
    }
  }

  function requestPayout(stripeMode: StripePayoutMode, payoutId?: string) {
    withStepUp(t("request"), () => void doRequestPayout(stripeMode, payoutId));
  }

  async function doRequestPayout(stripeMode: StripePayoutMode, payoutId?: string) {
    if (availableCents < 1000) {
      setMsg({ type: "error", text: t("errors.minAmount", { amount: fmtMoney(availableCents, "EUR", locale) }) });
      return;
    }
    setRequesting(true);
    setMsg(null);
    try {
      const res = await fetch("/api/payout/request", {
        method: "POST",
        headers: { "content-type": "application/json", ...stepUp.stepUpHeaders() },
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
            message: err || t("transferOnly.payoutsNotEnabled"),
          });
          return;
        }
        throw new Error(err || t("errors.payoutFailed"));
      }

      setMsg({ type: "success", text: t("success") });
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
          <div className="text-[16px] font-semibold">{t("transferOnly.title")}</div>
          <div className="mt-1 text-[13px] text-white/60">{confirmTransferOnly.message}</div>
        </div>
        <div className="px-5 py-4 space-y-3 text-[13px] text-white/70">
          <div className="rounded-xl border border-white/10 bg-white/[.03] p-3">
            {t("transferOnly.body")}
          </div>
          {confirmTransferOnly.stripeAccountId ? (
            <div className="text-[12px] text-white/50">
              {t("stripeCard.accountLabel")}: <span className="font-mono">{confirmTransferOnly.stripeAccountId}</span>
            </div>
          ) : null}
        </div>
        <div className="px-5 py-4 border-t border-white/10 flex gap-3">
          <button
            type="button"
            onClick={() => setConfirmTransferOnly(null)}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/20 hover:bg-white/5"
          >
            {t("transferOnly.cancel")}
          </button>
          <button
            type="button"
            onClick={async () => {
              const payoutId = confirmTransferOnly?.payoutId;
              setConfirmTransferOnly(null);
              await doRequestPayout("TRANSFER_ONLY", payoutId);
            }}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--purple)] text-white hover:opacity-90"
          >
            {t("transferOnly.proceed")}
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
              <h2 className="text-[20px] font-bold">{t("title")}</h2>
              <div className="text-[12px] text-white/60">{t("subtitle")}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition"
              aria-label={t("closeAria")}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-5">
            <div className="p-4 rounded-2xl bg-[var(--purple)]/10 border border-[var(--purple)]/30">
              <div className="text-[12px] text-white/70">{t("amount")}</div>
              <div className="mt-1 text-[26px] font-bold text-[var(--purple)]">
                {fmtMoney(availableCents, "EUR", locale)}
              </div>
              <div className="mt-1 text-[12px] text-white/55">
                {availableCents < 1000 ? t("min10") : t("ready")}
              </div>
              <div className="mt-3 text-[12px] text-white/55">{t("note")}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4">
              {loading ? (
                <div className="text-sm text-white/60">…</div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[13px] text-white/75">{t("stripeCard.intro")}</div>

                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-black/30 border border-white/10">
                    <div className="text-[13px] text-white/75">
                      {t("stripeCard.status")}:{" "}
                      {!connected ? (
                        <span className="text-yellow-200">{t("stripeCard.notConnected")}</span>
                      ) : onboardingOk ? (
                        <span className="text-emerald-300">{t("stripeCard.ready")}</span>
                      ) : (
                        <span className="text-yellow-200">{t("stripeCard.incomplete")}</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={startStripeOnboarding}
                      className="px-3 py-2 rounded-xl bg-[var(--purple)]/90 hover:bg-[var(--purple)] text-white text-[13px]"
                    >
                      {stripeAccountId ? t("openOnboarding") : t("connect")}
                    </button>
                  </div>

                  {connected && !onboardingOk ? (
                    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-[12px] text-yellow-100/90">
                      {t("stripeCard.incompleteHint")}
                    </div>
                  ) : null}

                  {stripeAccountId ? (
                    <div className="text-[12px] text-white/55">
                      {t("stripeCard.accountLabel")}: <span className="font-mono">{stripeAccountId}</span>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {msg ? (
              <div className={cls(
                "p-4 rounded-2xl border text-[14px]",
                msg.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-red-500/10 border-red-500/30 text-red-200"
              )}>
                {msg.text}
              </div>
            ) : null}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl border border-white/20 text-white hover:bg-white/5 transition font-medium"
              >
                {t("back")}
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
                {requesting ? t("requesting") : t("request")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {ConfirmTransferOnlyModal}

      <StepUpDialog
        open={stepUpOpen}
        onClose={() => setStepUpOpen(false)}
        onVerified={() => {
          setStepUpOpen(false);
          pendingActionRef.current?.();
          pendingActionRef.current = null;
        }}
        actionLabel={stepUpLabel}
        verify={stepUp.verify}
      />
    </>
  );
}