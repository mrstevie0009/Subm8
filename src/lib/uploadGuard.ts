// src/lib/uploadGuard.ts
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { processImage } from './imageProcess';

export type AllowedMime =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/gif';

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
      code:
        | 'EMPTY_FILE'
        | 'MIME_NOT_ALLOWED'
        | 'SIZE_EXCEEDED'
        | 'WRITE_FAILED'
        | 'UNKNOWN';
      message: string;
    };

const DEFAULT_ALLOWED: AllowedMime[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const DEFAULT_MAX = 5 * 1024 * 1024; // 5 MB

function extForMime(mime: AllowedMime): string {
  switch (mime) {
    case 'image/jpeg':
      return '.jpg';
    case 'image/png':
      return '.png';
    case 'image/webp':
      return '.webp';
    case 'image/gif':
      return '.gif';
    default:
      return '.bin';
  }
}

function sniffMime(bytes: Uint8Array): AllowedMime | null {
  // JPEG: FF D8 FF
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return 'image/jpeg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return 'image/png';
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  )
    return 'image/webp';
  // GIF: GIF87a / GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  )
    return 'image/gif';
  return null;
}

export async function guardAndSave(file: File, opts: GuardOptions = {}): Promise<GuardResult> {
  const allowed = opts.allowed ?? DEFAULT_ALLOWED;
  const maxSize = opts.maxSize ?? DEFAULT_MAX;
  const publicSubdir = (opts.publicSubdir ?? 'uploads').replace(/\.+/g, '');

  if (!file || file.size === 0) {
    return { ok: false, code: 'EMPTY_FILE', message: 'Die Datei ist leer oder fehlt.' };
  }
  if (file.size > maxSize) {
    return {
      ok: false,
      code: 'SIZE_EXCEEDED',
      message: `Die Datei ist größer als ${Math.floor(maxSize / 1024 / 1024)}MB.`,
    };
  }

  // MIME sniff (Magic Bytes)
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const detected = sniffMime(header);
  if (!detected || !allowed.includes(detected)) {
    return {
      ok: false,
      code: 'MIME_NOT_ALLOWED',
      message: 'Dateityp nicht erlaubt. Erlaubt: JPEG, PNG, WebP, GIF.',
    };
  }

  // Daten lesen (Uint8Array → Buffer) → TS- und Runtimesicher
  const ab = (await file.arrayBuffer()) as ArrayBuffer;
  const rawArray = new Uint8Array(ab);
  let dataToSave: Buffer = Buffer.from(rawArray);
  let finalMime: AllowedMime = detected;
  let finalExt = extForMime(detected);

  // Bildverarbeitung (try/catch – falls sharp fehlt, speichern wir Original)
  try {
    const {
      IMG_MAX_W,
      IMG_MAX_H,
      IMG_QUALITY,
      IMG_CONVERT_TO_WEBP,
    } = readImageEnv();

    const processed = await processImage(dataToSave, detected, {
      maxW: IMG_MAX_W,
      maxH: IMG_MAX_H,
      quality: IMG_QUALITY,
      convertToWebP: IMG_CONVERT_TO_WEBP,
      stripMetadata: true,
    });

    dataToSave = processed.data;
    finalMime = processed.mime;
    finalExt = processed.ext;
  } catch {
    // Fallback: original speichern
  }

  // Zielverzeichnis sicherstellen
  const publicDir = join(process.cwd(), 'public', publicSubdir);
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }

  const uuid =
    (globalThis as any).crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  const filename = `${uuid}${finalExt}`;
  const filepath = join(publicDir, filename);
  const publicPath = `/${publicSubdir}/${filename}`;

  try {
    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(filepath, { flags: 'wx' }); // verhindert Überschreiben
      ws.on('error', reject);
      ws.on('finish', () => resolve());
      ws.end(dataToSave);
    });
  } catch {
    return { ok: false, code: 'WRITE_FAILED', message: 'Upload konnte nicht gespeichert werden.' };
  }

  return { ok: true, filepath, publicPath, filename, mime: finalMime, size: dataToSave.length };
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
