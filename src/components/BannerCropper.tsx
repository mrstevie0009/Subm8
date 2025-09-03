'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';

type Props = {
  open: boolean;
  /** ObjectURL/Base64 der zu croppenden Grafik */
  imageSrc: string | null;
  onCancel: () => void;
  onComplete: (blob: Blob) => void;
};

const BANNER_ASPECT = 3 / 1;

export default function BannerCropper({ open, imageSrc, onCancel, onComplete }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [pixels, setPixels] = React.useState<Area | null>(null);

  React.useEffect(() => setMounted(true), []);
  if (!mounted || !open || !imageSrc) return null;

  const handleUse = async () => {
    if (!pixels || !imageSrc) return;
    const blob = await cropImageToBlobRect(imageSrc, pixels);
    onComplete(blob);
  };

  const overlay = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Crop banner"
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
        <div className="px-4 py-3 border-b border-white/10 font-semibold">Crop banner</div>

        <div style={{ position: 'relative', height: 420 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={BANNER_ASPECT}
            cropShape="rect"
            showGrid={false}
            objectFit="contain"
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, p) => setPixels(p)}
          />
        </div>

        <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
          <input
            type="range"
            min={0.5}
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

/** Rechteckig zuschneiden (ohne runde Maske) und als PNG-Blob zurückgeben */
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
