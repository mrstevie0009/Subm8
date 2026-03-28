// src/hooks/useStepUp.ts
"use client";

import { useState, useCallback, useRef } from "react";

type StepUpState =
  | { status: "idle" }
  | { status: "verified"; token: string; verifiedAt: number }
  | { status: "expired" };

const TTL_MS = 4.5 * 60 * 1000; // etwas unter Server-TTL (5min)

export function useStepUp() {
  const [state, setState] = useState<StepUpState>({ status: "idle" });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isVerified =
    state.status === "verified" &&
    Date.now() - state.verifiedAt < TTL_MS;

  /**
   * Passwort senden und Token holen.
   * Gibt { ok: true } oder { ok: false, code, error } zurück.
   */
  const verify = useCallback(
    async (password: string): Promise<{ ok: boolean; code?: string; error?: string }> => {
      try {
        const res = await fetch("/api/auth/stepup", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        });

        const j = (await res.json()) as {
          ok: boolean;
          token?: string;
          code?: string;
          error?: string;
        };

        if (!res.ok || !j.ok || !j.token) {
          return { ok: false, code: j.code, error: j.error ?? "Verification failed" };
        }

        setState({ status: "verified", token: j.token, verifiedAt: Date.now() });

        // Lokaler Timer der Token-State nach TTL zurücksetzt
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setState({ status: "expired" }), TTL_MS);

        return { ok: true };
      } catch {
        return { ok: false, error: "Network error" };
      }
    },
    []
  );

  /**
   * Gibt den x-stepup-token Header zurück, falls ein gültiges Token vorhanden ist.
   * Gibt {} zurück wenn kein Token – damit kannst du den Header einfach spreaden.
   */
  const stepUpHeaders = useCallback((): Record<string, string> => {
    if (!isVerified || state.status !== "verified") return {};
    return { "x-stepup-token": state.token };
  }, [isVerified, state]);

  /** Token manuell entwerten (z.B. nach erfolgter Aktion) */
  const invalidate = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setState({ status: "idle" });
  }, []);

  return { isVerified, verify, stepUpHeaders, invalidate, state };
}