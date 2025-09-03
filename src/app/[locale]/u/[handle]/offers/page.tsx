// src/app/[locale]/u/[handle]/offers/page.tsx
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";

type OfferData = {
  user: { displayName: string; handle: string; avatarUrl: string | null };
  offer: { title: string; text: string; bgUrl: string; bgDim: number };
};

export default function OffersEditorPage() {
  const { handle, locale } = useParams<{ handle: string; locale: string }>();
  const router = useRouter();

  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [text, setText] = React.useState("");
  const [bgUrl, setBgUrl] = React.useState<string>("");
  const [bgPreview, setBgPreview] = React.useState<string>("");
  const [dim, setDim] = React.useState(0.35);
  const [file, setFile] = React.useState<File | null>(null);

  const hasBackground = Boolean(bgPreview || bgUrl);

  React.useEffect(() => {
    let dead = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const res = await fetch(`/api/offers/${handle}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { ok: boolean } & OfferData;
        if (!json.ok) throw new Error("Failed to load");
        if (dead) return;
        setTitle(json.offer.title ?? "");
        setText(json.offer.text ?? "");
        setBgUrl(json.offer.bgUrl ?? "");
        setBgPreview(json.offer.bgUrl ?? "");
        setDim(typeof json.offer.bgDim === "number" ? json.offer.bgDim : 0.35);
      } catch (e) {
        if (!dead) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!dead) setLoading(false);
      }
    })();
    return () => {
      dead = true;
      if (bgPreview.startsWith("blob:")) URL.revokeObjectURL(bgPreview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle]);

  const onPickBg = (f?: File | null) => {
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    if (bgPreview && bgPreview.startsWith("blob:")) URL.revokeObjectURL(bgPreview);
    setBgPreview(url);
  };

  const onRemoveBg = () => {
    if (bgPreview && bgPreview.startsWith("blob:")) URL.revokeObjectURL(bgPreview);
    setBgPreview("");
    setBgUrl("");
    setFile(null);
  };

  const onSave = async () => {
    try {
      setErr(null);
      const fd = new FormData();
      fd.append("title", title);
      fd.append("text", text);
      fd.append("dim", String(dim));
      if (file) fd.append("bg", file);
      if (!file && !bgUrl && !bgPreview) fd.append("removeBg", "1");

      const res = await fetch(`/api/offers/${handle}`, { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setBgUrl(json.offer.bgUrl ?? "");
      if (file) setFile(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  };

  return (
    <main className="px-3 py-4">
      <div
        className="mx-auto w-full max-w-[720px] rounded-2xl border border-white/10 bg-white/[.04] shadow-app overflow-hidden"
        style={{ position: "relative" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="leading-tight">
            <div className="font-semibold">
              Edit Offer Menu
              {loading && <span className="ml-2 text-xs text-white/60">Loading…</span>}
            </div>
            <div className="text-xs text-white/60">@{handle}</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/${locale}/u/${handle}/edit`)}
              className="px-4 py-1.5 rounded-full border border-white/15 hover:bg-white/5"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95 disabled:opacity-60"
              disabled={loading}
            >
              {loading ? "Loading…" : "Save"}
            </button>
          </div>
        </div>

        {/* Hintergrund-Preview */}
        <div
          className="relative"
          style={{
            minHeight: 180,
            backgroundImage: hasBackground ? `url(${bgPreview || bgUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {hasBackground && (
            <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${dim})` }} />
          )}

          <div className="relative p-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title…"
              className="w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2 font-semibold"
              disabled={loading}
            />
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Content…"
              rows={7}
              className="mt-3 w-full rounded-xl bg-black/40 border border-white/15 px-3 py-2"
              disabled={loading}
            />
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5 hover:bg-white/5 cursor-pointer">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onPickBg(e.currentTarget.files?.[0] || null)}
                disabled={loading}
              />
              Change background
            </label>

            <button
              type="button"
              onClick={onRemoveBg}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 px-3 py-1.5 hover:bg-white/5 disabled:opacity-60"
              disabled={!hasBackground || loading}
            >
              Remove
            </button>
          </div>

          {/* Dimmer – nur bei Bild, und lila */}
          {hasBackground && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/70">Dim</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={dim}
                onChange={(e) => setDim(Number(e.target.value))}
                style={{ accentColor: "var(--purple)" }}
                disabled={loading}
              />
            </div>
          )}
        </div>

        {err && <div className="px-4 pb-4 text-sm text-red-300">Error: {err}</div>}
      </div>
    </main>
  );
}
