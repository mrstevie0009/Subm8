// src/lib/storage.ts
import crypto from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

// Einheitliche Schnittstelle für lokale Dev & S3/R2 Prod
export type PutParams = {
  key: string;                // z.B. "post-media/2025/11/uuid.jpg"
  contentType: string;
  data: ArrayBuffer;          // Server Action: from `file.arrayBuffer()`
  cacheControl?: string;      // z.B. "public, max-age=31536000, immutable"
};

export type StorageAdapter = {
  put(o: PutParams): Promise<{ publicUrl: string }>;
  url(key: string): string;
};

function yyyymm(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0')].join('/');
}

export function buildKey(
  kind: 'post-media' | 'avatars' | 'banners' | 'offers' | 'profile' | 'chat-media' | 'contract-private',
  fileName: string
) {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  return `${kind}/${yyyymm()}/${crypto.randomUUID()}.${ext}`;
}

/* ---------------- Local (Dev) ---------------- */

export function localAdapter(baseDir = 'public/uploads'): StorageAdapter {
  return {
    async put({ key, data /* , cacheControl */ }) {
      const abs = join(process.cwd(), baseDir, key);
      await mkdir(dirname(abs), { recursive: true });

      // ArrayBuffer -> Uint8Array -> Buffer
      const buf = Buffer.from(new Uint8Array(data));

      await writeFile(abs, buf);
      // dev-URL unter /uploads/...
      return { publicUrl: `/${baseDir.replace(/^public\//, '')}/${key}` };
    },
    url(key) {
      return `/${baseDir.replace(/^public\//, '')}/${key}`;
    },
  };
}

/* ---------------- S3 / R2 (Prod) ohne AWS SDK ---------------- */

type S3Cfg = {
  bucket: string;
  publicBaseUrl?: string; // optional CDN base, z.B. https://cdn.example.com
  endpoint?: string;      // R2: https://<accountid>.r2.cloudflarestorage.com
  region?: string;        // für R2 egal, z.B. "auto"
  accessKeyId: string;
  secretAccessKey: string;
};

function sha256Hex(input: string | Uint8Array): string {
  const h = crypto.createHash('sha256');
  if (typeof input === 'string') {
    h.update(input, 'utf8');
  } else {
    h.update(input);
  }
  return h.digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

function hmacHex(key: Buffer | string, data: string): string {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

function getSigningKey(secretKey: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac('AWS4' + secretKey, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
}

export function s3Adapter(cfg: S3Cfg): StorageAdapter {
  const bucket = cfg.bucket;
  const region = cfg.region || 'auto';
  const endpoint =
    (cfg.endpoint || `https://${bucket}.s3.amazonaws.com`).replace(/\/$/, '');
  const publicBase = (cfg.publicBaseUrl || '').replace(/\/$/, '');
  const accessKeyId = cfg.accessKeyId;
  const secretKey = cfg.secretAccessKey;
  const service = 's3';

  return {
    async put({ key, data, contentType, cacheControl }) {
      // ArrayBuffer -> Uint8Array (BodyInit-kompatibel)
      const body = new Uint8Array(data);

      const urlPath = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
      const fullUrl = endpoint + urlPath;
      const urlObj = new URL(fullUrl);
      const host = urlObj.host;

      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
      const dateStamp = amzDate.slice(0, 8);                          // YYYYMMDD

      const payloadHash = sha256Hex(body);

      // Header, die wir signieren
      const headers: Record<string, string> = {
        host,
        'content-type': contentType || 'application/octet-stream',
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'x-amz-acl': 'public-read',
      };
      if (cacheControl) {
        headers['cache-control'] = cacheControl;
      }

      const signedHeaderNames = Object.keys(headers)
        .map((h) => h.toLowerCase())
        .sort();

      const canonicalHeaders = signedHeaderNames
        .map((h) => `${h}:${headers[h]}\n`)
        .join('');

      const signedHeaders = signedHeaderNames.join(';');

      const canonicalRequest = [
        'PUT',
        urlPath,
        '', // Querystring leer
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join('\n');

      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        `${dateStamp}/${region}/${service}/aws4_request`,
        sha256Hex(canonicalRequest),
      ].join('\n');

      const signingKey = getSigningKey(secretKey, dateStamp, region, service);
      const signature = hmacHex(signingKey, stringToSign);

      const authorizationHeader =
        `AWS4-HMAC-SHA256 ` +
        `Credential=${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request, ` +
        `SignedHeaders=${signedHeaders}, ` +
        `Signature=${signature}`;

      const fetchHeaders: Record<string, string> = {
        ...headers,
        Authorization: authorizationHeader,
      };

      const res = await fetch(fullUrl, {
        method: 'PUT',
        headers: fetchHeaders,
        body, // Uint8Array => BodyInit ok
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `S3/R2 upload failed: ${res.status} ${res.statusText} ${text}`
        );
      }

      const publicUrl = publicBase
        ? `${publicBase}/${key}`
        : `https://${bucket}.s3.amazonaws.com/${key}`;

      return { publicUrl };
    },

    url(key: string) {
      return publicBase
        ? `${publicBase}/${key}`
        : `https://${bucket}.s3.amazonaws.com/${key}`;
    },
  };
}

/* ---------------- Factory ---------------- */
export function getStorage(): StorageAdapter {
  if (process.env.STORAGE_DRIVER === 's3') {
    const required = ['S3_BUCKET', 'S3_ACCESS_KEY', 'S3_SECRET_KEY'];
    for (const k of required) if (!process.env[k]) throw new Error(`Missing env ${k}`);
    return s3Adapter({
      bucket: process.env.S3_BUCKET!,
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL, // z.B. deine CDN-Domain
      endpoint: process.env.S3_ENDPOINT,             // R2-Endpunkt
      region: process.env.S3_REGION ?? 'auto',
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    });
  }
  return localAdapter(); // default: dev
}
