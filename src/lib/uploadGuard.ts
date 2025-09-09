// src/lib/uploadGuard.ts
/// <reference lib="dom" />
/// <reference types="node" />

import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { processImage } from './imageProcess';

export type AllowedMime =
  // images
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif'
  // videos
  | 'video/mp4'
  | 'video/webm'
  | 'video/ogg'
  | 'video/quicktime'     // .mov
  | 'video/x-matroska';   // .mkv

export type GuardOptions = {
  allowed?: AllowedMime[];
  /** Maximalgröße in Bytes (default 5 MB) */
  maxSize?: number;
  /** Unterordner unter /public (default: 'uploads') */
  publicSubdir?: string;
};

export type GuardResult =
  | {
      ok: true;
      filepath: string;
      publicPath: string;
      filename: string;
      mime: AllowedMime;
      size: number;
    }
  | {
      ok: false;
      code: 'EMPTY_FILE' | 'MIME_NOT_ALLOWED' | 'SIZE_EXCEEDED' | 'WRITE_FAILED' | 'UNKNOWN';
      message: string;
    };

// Standard: Bilder + gängige Videos
const DEFAULT_ALLOWED: AllowedMime[] = [
  // images
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // videos
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-matroska',
];

const DEFAULT_MAX = 5 * 1024 * 1024; // 5 MB

function isImageMime(mime: AllowedMime): boolean {
  return mime.startsWith('image/');
}

function extForMime(mime: AllowedMime): string {
  switch (mime) {
    // images
    case 'image/jpeg':  return '.jpg';
    case 'image/png':   return '.png';
    case 'image/webp':  return '.webp';
    case 'image/gif':   return '.gif';
    // videos
    case 'video/mp4':        return '.mp4';
    case 'video/webm':       return '.webm';
    case 'video/ogg':        return '.ogv';
    case 'video/quicktime':  return '.mov';
    case 'video/x-matroska': return '.mkv';
    default:                 return '.bin';
  }
}

/**
 * Magic-Bytes/MINIMAL container sniffing.
 * Für WebM/MKV lesen wir etwas mehr vom Header (bis 512 B), um DocType zu erkennen.
 */
function sniffMime(bytes: Uint8Array): AllowedMime | null {
  // --- IMAGES ---
  // JPEG
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  // PNG
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  // WebP (RIFF....WEBP)
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50  // "WEBP"
  ) return 'image/webp';
  // GIF (GIF87a/GIF89a)
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
  ) return 'image/gif';

  // --- VIDEOS ---
  // ISO BMFF (MP4/MOV): 00 00 00 ?? 66 74 79 70 ("ftyp" an Offset 4)
  if (
    bytes.length >= 12 &&
    bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 // "ftyp"
  ) {
    // Brand an Offset 8..11
    const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (brand === 'qt  ') return 'video/quicktime';
    // sonst MP4 (isom/mp42/avc1/…)
    return 'video/mp4';
  }

  // Ogg (z.B. Theora/Ogg)
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53 // "OggS"
  ) return 'video/ogg';

  // EBML (Matroska/WebM): 1A 45 DF A3
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3
  ) {
    // Suche "webm" / "matroska" im Header (bis 512 B)
    const headStr = new TextDecoder().decode(bytes);
    if (headStr.toLowerCase().includes('webm')) return 'video/webm';
    return 'video/x-matroska';
  }

  return null;
}

/**
 * Server-seitiger Guard + Save.
 * Tipp: API-Route auf nodejs Runtime setzen (kein Edge): export const runtime = 'nodejs'
 */
export async function guardAndSave(file: File | Blob, opts: GuardOptions = {}): Promise<GuardResult> {
  try {
    const allowed = opts.allowed ?? DEFAULT_ALLOWED;
    const maxSize = opts.maxSize ?? DEFAULT_MAX;
    const publicSubdir = (opts.publicSubdir ?? 'uploads')
      .replace(/[\\\/]+/g, '/')
      .replace(/\.+/g, '')
      .replace(/^\/+|\/+$/g, '');

    // Basis-Validierung
    const size = (file as File).size ?? (file as Blob).size;
    if (!file || size === 0) {
      return { ok: false, code: 'EMPTY_FILE', message: 'Die Datei ist leer oder fehlt.' };
    }
    if (size > maxSize) {
      return {
        ok: false,
        code: 'SIZE_EXCEEDED',
        message: `Die Datei ist größer als ${Math.floor(maxSize / 1024 / 1024)}MB.`,
      };
    }

    // Mehr Header lesen (bis 512 B), um Video-Container besser zu erkennen
    const sniffLen = Math.min(size, 512);
    const header = new Uint8Array(await file.slice(0, sniffLen).arrayBuffer());
    const detected = sniffMime(header);
    if (!detected || !allowed.includes(detected)) {
      return {
        ok: false,
        code: 'MIME_NOT_ALLOWED',
        message: 'Dateityp nicht erlaubt. Erlaubt: JPEG, PNG, WebP, GIF, MP4, WebM, OGG, MOV, MKV.',
      };
    }

    // Daten lesen
    const ab = await file.arrayBuffer(); // -> ArrayBuffer | SharedArrayBuffer
    let dataToSave = Buffer.from(ab as ArrayBuffer) as unknown as Buffer;
    let finalMime: AllowedMime = detected;
    let finalExt = extForMime(detected);

    // Nur Bilder optional verarbeiten (resize/reencode); Videos NICHT anfassen
    if (isImageMime(detected)) {
      try {
        const { IMG_MAX_W, IMG_MAX_H, IMG_QUALITY, IMG_CONVERT_TO_WEBP } = readImageEnv();
        const processed = await processImage(dataToSave, detected, {
          maxW: IMG_MAX_W,
          maxH: IMG_MAX_H,
          quality: IMG_QUALITY,
          convertToWebP: IMG_CONVERT_TO_WEBP,
          stripMetadata: true,
        });
        // TS-Safety: generische Buffer-Typen auf Node-Buffer abbilden
        dataToSave = (processed.data as unknown) as Buffer;
        finalMime  = processed.mime as AllowedMime;
        finalExt   = processed.ext;
      } catch {
        // Fallback: original speichern
      }
    }

    // Zielverzeichnis sicherstellen
    const publicDir = join(process.cwd(), 'public', publicSubdir);
    if (!existsSync(publicDir)) mkdirSync(publicDir, { recursive: true });

    const filename = `${randomUUID()}${finalExt}`;
    const filepath = join(publicDir, filename);
    const publicPath = `/${publicSubdir}/${filename}`;

    // Schreiben (atomar, nicht überschreiben)
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(filepath, { flags: 'wx' });
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      ws.end(dataToSave);
    });

    return { ok: true, filepath, publicPath, filename, mime: finalMime, size: dataToSave.length };
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('guardAndSave failed:', err);
    }
    return { ok: false, code: 'UNKNOWN', message: 'Unbekannter Fehler beim Upload.' };
  }
}

// ENV → Bytes (Uploadlimit)
export function envMaxUploadBytes(defaultMB = 5): number {
  const v = process.env.NEXT_MAX_UPLOAD_MB;
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n * 1024 * 1024 : defaultMB * 1024 * 1024;
}

// Bild-ENV lesen (mit Defaults)
function readImageEnv() {
  const maxW = parseInt(process.env.NEXT_IMG_MAX_W ?? '', 10);
  const maxH = parseInt(process.env.NEXT_IMG_MAX_H ?? '', 10);
  const q = parseInt(process.env.NEXT_IMG_QUALITY ?? '', 10);
  const toWebP = (process.env.NEXT_IMG_CONVERT_TO_WEBP ?? 'false').toLowerCase() === 'true';
  return {
    IMG_MAX_W: Number.isFinite(maxW) && maxW > 0 ? maxW : 2000,
    IMG_MAX_H: Number.isFinite(maxH) && maxH > 0 ? maxH : 2000,
    IMG_QUALITY: Number.isFinite(q) && q >= 1 && q <= 100 ? q : 82,
    IMG_CONVERT_TO_WEBP: toWebP,
  };
}
