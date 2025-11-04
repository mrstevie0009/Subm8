//src/lib/storage.ts
// Einheitliche Schnittstelle für lokale Dev & S3/R2 Prod
export type PutParams = {
  key: string;                // z.B. "post-media/2025/11/uuid.jpg"
  contentType: string;
  data: Buffer | ArrayBuffer | Uint8Array | Blob; // Server Action: from `file.arrayBuffer()`
  cacheControl?: string;      // z.B. "public, max-age=31536000, immutable"
};

export type StorageAdapter = {
  put(o: PutParams): Promise<{ publicUrl: string }>;
  url(key: string): string;
};

function yyyymm(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0')].join('/');
}

export function buildKey(kind: 'post-media'|'avatars'|'banners'|'offers'|'profile'|'chat-media', fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'bin';
  return `${kind}/${yyyymm()}/${crypto.randomUUID()}.${ext}`;
}

/* ---------------- Local (Dev) ---------------- */
import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

export function localAdapter(baseDir = 'public/uploads'): StorageAdapter {
  return {
    async put({ key, data /* , cacheControl */ }) {
      const abs = join(process.cwd(), baseDir, key);
      await mkdir(dirname(abs), { recursive: true });
      const buf = data instanceof Buffer ? data : Buffer.from(await (data as ArrayBuffer));
      await writeFile(abs, buf);
      // dev-URL unter /uploads/...
      return { publicUrl: `/${baseDir.replace(/^public\//,'')}/${key}` };
    },
    url(key) {
      return `/${baseDir.replace(/^public\//,'')}/${key}`;
    },
  };
}

/* ---------------- S3 / R2 (Prod) ---------------- */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

type S3Cfg = {
  bucket: string;
  publicBaseUrl?: string; // optional CDN base, z.B. https://cdn.example.com
  endpoint?: string;      // R2: https://<accountid>.r2.cloudflarestorage.com
  region?: string;        // für R2 egal, z.B. "auto"
  accessKeyId: string;
  secretAccessKey: string;
};

export function s3Adapter(cfg: S3Cfg): StorageAdapter {
  const s3 = new S3Client({
    region: cfg.region ?? 'auto',
    endpoint: cfg.endpoint,
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
    forcePathStyle: true, // R2/B2 mögen das oft
  });

  return {
    async put({ key, data, contentType, cacheControl }) {
      const Body = data instanceof Buffer ? data : Buffer.from(await (data as ArrayBuffer));
      await s3.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body,
        ContentType: contentType,
        ACL: 'public-read',           // R2: Bucket-Policy erlauben; ACL optional
        CacheControl: cacheControl ?? 'public, max-age=31536000, immutable',
      }));
      const url = cfg.publicBaseUrl
        ? `${cfg.publicBaseUrl.replace(/\/$/,'')}/${key}`
        : `https://${cfg.bucket}.s3.amazonaws.com/${key}`;
      return { publicUrl: url };
    },
    url(key) {
      return cfg.publicBaseUrl
        ? `${cfg.publicBaseUrl.replace(/\/$/,'')}/${key}`
        : `https://${cfg.bucket}.s3.amazonaws.com/${key}`;
    },
  };
}

/* ---------------- Factory ---------------- */
export function getStorage(): StorageAdapter {
  if (process.env.STORAGE_DRIVER === 's3') {
    const required = ['S3_BUCKET','S3_ACCESS_KEY','S3_SECRET_KEY'];
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
