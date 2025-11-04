// src/lib/r2sign.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { buildKey } from './storage';

const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'auto',
  endpoint: process.env.S3_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true,
});

export async function presignPut(
  kind: 'post-media'|'avatars'|'banners'|'offers'|'profile'|'chat-media',
  filename: string,
  contentType: string
) {
  const key = buildKey(kind, filename);
  const cmd = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    ContentType: contentType || 'application/octet-stream',
    CacheControl:
      contentType?.startsWith('video/') ? 'public, max-age=604800' :           // 7 Tage
      contentType?.startsWith('audio/') ? 'public, max-age=2592000' :          // 30 Tage (Voice)
      'public, max-age=31536000, immutable',
  });
  const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 60 * 5 }); // 5 min
  const base = (process.env.S3_PUBLIC_BASE_URL || '').replace(/\/$/,'');
  const publicUrl = base ? `${base}/${key}` : `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}`;
  return { key, uploadUrl, publicUrl };
}
