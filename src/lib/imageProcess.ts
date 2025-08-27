// src/lib/imageProcess.ts
import type { AllowedMime } from './uploadGuard';

export type ImageProcessOptions = {
  maxW: number;
  maxH: number;
  /** 0..100 – nur relevant für JPEG/WebP/PNG, default 82 */
  quality?: number;
  /** Nach WebP konvertieren (außer GIF), default false */
  convertToWebP?: boolean;
  /** EXIF/Metadata entfernen, default true */
  stripMetadata?: boolean;
};

export type ImageProcessResult = {
  data: Buffer;
  mime: AllowedMime;
  ext: '.jpg' | '.png' | '.webp' | '.gif';
};

/**
 * Prozessiert ein Bild (Auto-Rotate, Resize, EXIF strip).
 * Für GIF (möglicherweise animiert) wird standardmäßig NICHT konvertiert,
 * um Animation nicht zu zerstören.
 */
export async function processImage(
  input: Buffer,
  mime: AllowedMime,
  opts: ImageProcessOptions
): Promise<ImageProcessResult> {
  // GIF: standardmäßig unangetastet lassen
  if (mime === 'image/gif') {
    return { data: input, mime: 'image/gif', ext: '.gif' };
  }

  // sharp dynamisch importieren (robust für ESM und CJS), ohne "any"
  type SharpModule = typeof import('sharp');
  let sharpFactory: SharpModule;
  try {
    const mod = (await import('sharp')) as unknown;
    sharpFactory = (mod as { default?: SharpModule }).default ?? (mod as SharpModule);
  } catch {
    // Fallback: keine Verarbeitung, nur zurückgeben
    return mapBypass(input, mime);
  }

  let img = sharpFactory(input, { failOn: 'none' }).rotate(); // Auto-rotate gemäß EXIF

  // Resize nur wenn größer als max
  const { maxW, maxH } = opts;
  img = img.resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true });

  // Standard: strippen (== true), nur behalten wenn explizit false
  const preserveMetadata = opts.stripMetadata === false;
  const quality = Number.isFinite(opts.quality) ? (opts.quality as number) : 82;

  const toBuf = () => (preserveMetadata ? img.withMetadata().toBuffer() : img.toBuffer());

  if (opts.convertToWebP) {
    img = img.webp({ quality });
    const data = await toBuf();
    return { data, mime: 'image/webp', ext: '.webp' };
  }

  // Behalte Ursprungsformat (jpg/png/webp)
  switch (mime) {
    case 'image/jpeg': {
      img = img.jpeg({ quality });
      const data = await toBuf();
      return { data, mime: 'image/jpeg', ext: '.jpg' };
    }
    case 'image/png': {
      // PNG: optional kann quality (0-100) für Quantisierung genutzt werden
      img = img.png({ quality });
      const data = await toBuf();
      return { data, mime: 'image/png', ext: '.png' };
    }
    case 'image/webp': {
      img = img.webp({ quality });
      const data = await toBuf();
      return { data, mime: 'image/webp', ext: '.webp' };
    }
  }

  // Unbekanntes Bildformat sollte hier nicht landen – fallback:
  return mapBypass(input, mime);
}

function mapBypass(input: Buffer, mime: AllowedMime): ImageProcessResult {
  switch (mime) {
    case 'image/jpeg':
      return { data: input, mime, ext: '.jpg' };
    case 'image/png':
      return { data: input, mime, ext: '.png' };
    case 'image/webp':
      return { data: input, mime, ext: '.webp' };
    case 'image/gif':
      return { data: input, mime, ext: '.gif' };
  }
}
