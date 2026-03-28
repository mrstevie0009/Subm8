// src/components/StepUpDialog.tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

type Props = {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  actionLabel?: string;
  verify: (pw: string) => Promise<{ ok: boolean; code?: string; error?: string }>;
};

export function StepUpDialog({ open, onClose, onVerified, actionLabel = "Fortfahren", verify }: Props) {
  const t = useTranslations("payment.stepUp");

  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setPassword("");
      setError(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit() {
    if (!password) return;
    setLoading(true);
    setError(null);

    const result = await verify(password);

    if (result.ok) {
      setPassword("");
      onVerified();
    } else {
      if (result.code === "NO_PASSWORD") {
        setError(t("errors.noPassword"));
      } else if (result.code === "RATE_LIMITED" || result.code === "IP_BLOCKED") {
        setError(t("errors.rateLimited"));
      } else if (result.code === "WRONG_PASSWORD") {
        setError(t("errors.wrongPassword"));
      } else {
        setError(result.error ?? t("errors.generic"));
      }
    }

    setLoading(false);
  }

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  if (!open || !mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2147483700] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0b0b0d] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 py-4 border-b border-white/10">
          <div
            className="absolute inset-0 -z-10"
            style={{ background: "radial-gradient(800px 180px at 50% 0%, rgba(139,92,246,.35), transparent)" }}
          />
          <div className="flex items-center justify-between">
            <div className="font-medium text-[15px]">{t("title")}</div>
            <button
              type="button"
              onClick={onClose}
              className="inline-grid place-items-center w-8 h-8 rounded-full hover:bg-white/10"
              aria-label={t("actions.closeAria")}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p className="mt-1 text-[12px] text-white/60">
            {t("subtitle", { action: actionLabel })}
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="flex justify-center mb-4">
            <div
              className="w-12 h-12 rounded-full border border-white/10 grid place-items-center"
              style={{ background: "rgba(139,92,246,.12)" }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="rgba(139,92,246,0.9)" strokeWidth="1.8">
                <rect x="5" y="11" width="14" height="10" rx="3"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4" strokeLinecap="round"/>
              </svg>
            </div>
          </div>

          <label className="block text-[12px] text-white/60 mb-1.5">{t("passwordLabel")}</label>
          <input
            ref={inputRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="••••••••"
            autoComplete="current-password"
            disabled={loading}
            className="w-full rounded-xl bg-white/[.04] border border-white/10 px-3 py-2.5 outline-none text-white placeholder:text-white/25 focus:border-[rgba(139,92,246,.5)] transition disabled:opacity-50"
          />

          {error && (
            <div className="mt-2.5 text-[12px] text-red-300 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-3 py-2.5 rounded-xl border border-white/15 hover:bg-white/8 text-[13px] transition disabled:opacity-50"
            >
              {t("actions.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading || !password}
              className="flex-1 px-3 py-2.5 rounded-xl text-white text-[13px] transition disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: password && !loading ? "var(--purple)" : "rgba(139,92,246,.3)" }}
            >
              {loading ? t("actions.confirming") : t("actions.confirm")}
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-white/35">
            {t("validHint")}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}