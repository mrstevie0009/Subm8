'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Cropper, { type MediaSize } from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

type Props = {
  open: boolean;
  imageSrc: string | null;   // ObjectURL/Base64
  onCancel: () => void;
  onComplete: (blob: Blob) => void;
};

// ===== Einheitliche Bühne (Viewport) =====
const OFFER_ASPECT = 9 / 12;      // Portrait
const STAGE_H = 560;              // <— HIER Höhe ändern, wenn gewünscht
const STAGE_W = Math.round(STAGE_H * OFFER_ASPECT); // abgeleitete Breite (315px)

export default function OfferBgCropper({ open, imageSrc, onCancel, onComplete }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [minZoom, setMinZoom] = React.useState(1);
  const [pixels, setPixels] = React.useState<Area | null>(null);

  React.useEffect(() => setMounted(true), []);
  if (!mounted || !open || !imageSrc) return null;

  // Ganzes Bild sichtbar (object-contain-Feeling)
  const onMediaLoaded = (m: MediaSize) => {
    const fitZoom = Math.min(STAGE_W / m.naturalWidth, STAGE_H / m.naturalHeight);
    const z = Math.max(0.05, fitZoom);
    setMinZoom(z);
    setZoom(z);
  };

  const handleUse = async () => {
    if (!pixels || !imageSrc) return;
    const blob = await cropImageToBlobRect(imageSrc, pixels);
    onComplete(blob);
  };

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop background"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483600,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        style={{
          width: 'min(92vw, 720px)',
          background: '#0b0b0b',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 16,
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-white/10 font-semibold">
          Crop background
        </div>

        {/* Feste, exakt gleiche Bühne wie im Viewer */}
        <div
          style={{
            position: 'relative',
            height: STAGE_H,
            // Die Bühne hat exakte Breite – wird bei schmalen Screens zentriert.
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <div style={{ position: 'relative', width: STAGE_W, height: STAGE_H }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              minZoom={minZoom}
              aspect={OFFER_ASPECT}
              cropShape="rect"
              showGrid={false}
              objectFit="contain"
              restrictPosition={false}
              onMediaLoaded={onMediaLoaded}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, p) => setPixels(p)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
          <input
            type="range"
            min={minZoom}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1"
          />
          <button
            type="button"
            className="px-4 py-1.5 rounded-full border border-white/20 hover:bg-white/5"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="px-4 py-1.5 rounded-full bg-[var(--purple)] text-white hover:opacity-95"
            onClick={handleUse}
          >
            Use
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

/** Rechteckig (Portrait 9:16) zuschneiden und als PNG-Blob zurückgeben */
async function cropImageToBlobRect(imageUrl: string, crop: Area): Promise<Blob> {
  const img = await loadImage(imageUrl);

  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(crop.width));
  out.height = Math.max(1, Math.round(crop.height));
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';

  ctx.drawImage(
    img,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, out.width, out.height
  );

  return await new Promise<Blob>((resolve) =>
    out.toBlob((b) => resolve(b as Blob), 'image/png', 0.95)
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
