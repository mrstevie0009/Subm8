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
 * Für GIF (möglicherweise animiert) wird aus Sicherheitsgründen standardmäßig NICHT konvertiert,
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

  // sharp dynamisch importieren (vermeidet Build-Probleme falls nicht installiert)
  // Achtung: Stelle sicher, dass "sharp" in package.json installiert ist.
  let sharpMod: any;
  try {
    sharpMod = await import('sharp');
  } catch {
    // Fallback: keine Verarbeitung, nur zurückgeben
    return mapBypass(input, mime);
  }

  const sharp = sharpMod.default ?? sharpMod;
  let img = sharp(input, { failOn: 'none' }).rotate(); // Auto-rotate gemäß EXIF

  // Resize nur wenn größer als max
  const { maxW, maxH } = opts;
  img = img.resize({ width: maxW, height: maxH, fit: 'inside', withoutEnlargement: true });

  const strip = opts.stripMetadata !== false; // default true
  const quality = Number.isFinite(opts.quality) ? (opts.quality as number) : 82;

  if (opts.convertToWebP) {
    img = img.webp({ quality });
    const data = await (strip ? img.withMetadata({ exif: undefined, icc: undefined }).toBuffer() : img.toBuffer());
    return { data, mime: 'image/webp', ext: '.webp' };
  }

  // Behalte Ursprungsformat (jpg/png/webp)
  switch (mime) {
    case 'image/jpeg': {
      img = img.jpeg({ quality });
      const data = await (strip ? img.withMetadata({ exif: undefined, icc: undefined }).toBuffer() : img.toBuffer());
      return { data, mime: 'image/jpeg', ext: '.jpg' };
    }
    case 'image/png': {
      // PNG ist lossless; leichtes Quantizing durch Qualität nicht vorgesehen. Wir lassen PNG.
      img = img.png();
      const data = await (strip ? img.withMetadata({ exif: undefined, icc: undefined }).toBuffer() : img.toBuffer());
      return { data, mime: 'image/png', ext: '.png' };
    }
    case 'image/webp': {
      img = img.webp({ quality });
      const data = await (strip ? img.withMetadata({ exif: undefined, icc: undefined }).toBuffer() : img.toBuffer());
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
