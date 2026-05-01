// src/lib/r2sign.ts
import crypto from 'node:crypto';
import { buildKey } from './storage';

// Kleine Helfer
function sha256Hex(input: string) {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
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

// Baut eine presigned PUT-URL für R2/S3 (path-style: endpoint/bucket/key)
const ALLOWED_UPLOAD_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-matroska',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg',
]);

export async function presignPut(
  kind: 'post-media' | 'avatars' | 'banners' | 'offers' | 'profile' | 'chat-media' | 'contract-private' | 'chat-media-private',
  filename: string,
  contentType: string
) {
  // ✅ MIME-Type validieren bevor Presigned URL ausgestellt wird
  if (!ALLOWED_UPLOAD_TYPES.has(contentType)) {
    throw new Error(`Upload MIME type not allowed: ${contentType}`);
  }

  const bucket = process.env.S3_BUCKET!;
  const endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '');
  const region = process.env.S3_REGION || 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY!;
  const secretKey = process.env.S3_SECRET_KEY!;
  const basePublic = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/, '');

  if (!bucket || !endpoint || !accessKeyId || !secretKey) {
    throw new Error('Missing S3/R2 env vars for presignPut');
  }

  const key = buildKey(kind, filename);
  const ct = contentType;

  if (!bucket || !endpoint || !accessKeyId || !secretKey) {
    throw new Error('Missing S3/R2 env vars for presignPut');
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // YYYYMMDDTHHMMSSZ
  const dateStamp = amzDate.slice(0, 8);                          // YYYYMMDD

  const service = 's3';

  const urlPath = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  const urlObj = new URL(endpoint + urlPath);
  const host = urlObj.host;

  // Query-Parameter für SigV4
  const query: Record<string, string> = {
  'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
  'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`,
  'X-Amz-Date': amzDate,
  'X-Amz-Expires': String(60 * 5),
  'X-Amz-SignedHeaders': 'host',
};

  const sortedKeys = Object.keys(query).sort();
  const canonicalQuery = sortedKeys
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = 'host';

  // Wir nutzen UNSIGNED-PAYLOAD, Payload-Hash muss nicht bekannt sein
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    'PUT',
    urlPath,
    canonicalQuery,
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

  const presignedUrl = `${endpoint}${urlPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  const publicUrl = basePublic
    ? `${basePublic}/${key}`
    : `https://${bucket}.s3.amazonaws.com/${key}`;

  // ct zurückgeben → kann der Client als Content-Type-Header nutzen
  return { key, uploadUrl: presignedUrl, publicUrl, contentType: ct };
}

export async function presignGet(key: string, expiresSeconds = 60) {
  if (!key.startsWith('contract-private/') && !key.startsWith('chat-media-private/')) {
    throw new Error('Only private media can be signed here');
  }

  const bucket = process.env.S3_BUCKET!;
  const endpoint = (process.env.S3_ENDPOINT || '').replace(/\/$/, '');
  const region = process.env.S3_REGION || 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY!;
  const secretKey = process.env.S3_SECRET_KEY!;

  if (!bucket || !endpoint || !accessKeyId || !secretKey) {
    throw new Error('Missing S3/R2 env vars for presignGet');
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const service = 's3';

  const urlPath = `/${bucket}/${encodeURIComponent(key).replace(/%2F/g, '/')}`;
  const urlObj = new URL(endpoint + urlPath);
  const host = urlObj.host;

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKeyId}/${dateStamp}/${region}/${service}/aws4_request`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  };

  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join('&');

  const canonicalRequest = [
    'GET',
    urlPath,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    `${dateStamp}/${region}/${service}/aws4_request`,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signingKey = getSigningKey(secretKey, dateStamp, region, service);
  const signature = hmacHex(signingKey, stringToSign);

  return `${endpoint}${urlPath}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
