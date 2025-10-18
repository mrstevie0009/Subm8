// src/components/OfferViewerModal.tsx
"use client";

import * as React from "react";
import { useTranslations } from 'next-intl';


type Props = { open: boolean; onClose: () => void; handle: string };

type OfferPayload =
  | {
      ok: true;
      user: { displayName: string; handle: string; avatarUrl: string | null };
      offer: { title: string; text: string; bgUrl: string; bgDim: number };
    }
  | { ok: false; error: string };

export default function OfferViewerModal({ open, onClose, handle }: Props) {
  const t = useTranslations('offer.offerViewer');
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [data, setData] =
    React.useState<Extract<OfferPayload, { ok: true }> | null>(null);

  // Schrift + Farbe aus localStorage übernehmen
  const [fontStack, setFontStack] = React.useState<string | null>(null);
  const [fontColor, setFontColor] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const fKey = `offer_font_${handle}`;
    const cKey = `offer_color_${handle}`;
    const map: Record<string, string> = {
      system:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji", sans-serif',
      serif:
        'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
      mono:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      rounded:
        'system-ui, "SF Pro Rounded", "Nunito", "Quicksand", Arial, sans-serif',
    };
    try {
      const keyVal =
        typeof window !== "undefined"
          ? window.localStorage.getItem(fKey) || "system"
          : "system";
      setFontStack(map[keyVal] || map.system);

      const colorVal =
        typeof window !== "undefined"
          ? window.localStorage.getItem(cKey) || "#ffffff"
          : "#ffffff";
      setFontColor(colorVal);
    } catch {
      setFontStack(map.system);
      setFontColor("#ffffff");
    }
  }, [open, handle]);

  React.useEffect(() => {
    if (!open) return;
    let dead = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        setData(null);
        const res = await fetch(`/api/offers/${handle}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as OfferPayload;
        if (!json.ok) throw new Error("Failed to load");
        if (!dead) setData(json);
      } catch (e) {
        if (!dead) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
    };
  }, [open, handle]);

  if (!open) return null;

  const BODY_HEIGHT_CLASS = "h-[520px]"; // Editor-ähnliche Höhe

  return (
    <div
      className="fixed inset-0 z-[2147483600] bg-black/70 backdrop-blur-sm grid place-items-center px-3"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={t('aria.modalLabel')}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/12 bg-[#202022] text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--purple)]/60">
          <div className="leading-tight">
            <div className="font-semibold">
              {data ? data.user.displayName : handle}
            </div>
            <div className="text-xs text-white/60">@{handle}</div>
          </div>
          <button
            type="button"
            className="px-4 py-1.5 rounded-full border border-white/15 hover:bg-white/5"
            onClick={onClose}
          >
            {t('actions.close')}
          </button>
        </div>

        {/* Body – feste Höhe, mit Layern wie im Editor */}
        <div
          className={`relative p-4 isolate ${BODY_HEIGHT_CLASS}`}
          style={{
            fontFamily: fontStack ?? undefined,
            color: fontColor ?? undefined,
          }}
        >
          {/* Background layers */}
          {data?.offer.bgUrl && (
            <>
              <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  backgroundImage: `url(${data.offer.bgUrl})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
                aria-hidden
              />
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{ background: `rgba(0,0,0,${data.offer.bgDim})` }}
                aria-hidden
              />
            </>
          )}

          {/* Content – scrollt, bleibt aber in fester Box */}
          <div className="relative z-20 h-full overflow-y-auto">
            {loading && <div className="text-sm opacity-80">{t('states.loading')}</div>}
            {!loading && err && (
              <div className="text-sm text-red-300">{t('states.loadError')}</div>
            )}
            {!loading && !err && data && (
              <div className="space-y-2 pr-1">
                <div className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">
                  {data.offer.title || t('placeholders.noTitle')}
                </div>
                <div className="whitespace-pre-wrap opacity-95 text-[15px] sm:text-base">
                  {data.offer.text || t('placeholders.noContent')}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
