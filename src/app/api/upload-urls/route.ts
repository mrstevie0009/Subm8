//src/app/api/upload-urls/route.ts
import { NextResponse } from 'next/server';
import { presignPut } from '@/lib/r2sign';
import { getCurrentUser } from '@/lib/currentUser';
import { getClientIp } from '@/lib/ip';
import { rateLimit } from '@/lib/rateLimitStore';

export const runtime = 'nodejs';

// Erlaubte "kind" Buckets (gleicher Union wie in r2sign/buildKey)
const ALLOWED_KINDS = new Set([
  'post-media',
  'chat-media',
  'avatars',
  'banners',
  'offers',
  'profile',
] as const);
type Kind =
  | 'post-media'
  | 'chat-media'
  | 'avatars'
  | 'banners'
  | 'offers'
  | 'profile';

export async function POST(req: Request) {
  try {
    //Auth-Pflicht: presigned URLs nur für eingeloggte User
    const me = await getCurrentUser();
    if (!me) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    //Rate-Limit gegen Bucket-Missbrauch: max. 60 präsignierte URLs/Stunde/User
    const ip = await getClientIp();
    const gate = await rateLimit(`upload-urls:${me.id}:${ip}`, 60, 60 * 60 * 1000);
    if (!gate.ok) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } }
      );
    }

    const { files } = (await req.json()) as { files: { name: string; type: string }[] };

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    // ✅ Anzahl pro Request begrenzen (verhindert 1000-Datei-Requests)
    if (files.length > 10) {
      return NextResponse.json({ error: 'Too many files per request' }, { status: 400 });
    }

    //?kind=chat-media (Default: post-media)
    const url = new URL(req.url);
    const rawKind = (url.searchParams.get('kind') || 'post-media') as Kind;
    const kind: Kind = (ALLOWED_KINDS.has(rawKind) ? rawKind : 'post-media') as Kind;

    // Avatare: nur Bilder
    if (kind === 'avatars' && files.some(f => !/^image\//.test(f.type || ''))) {
      return NextResponse.json({ error: 'images only' }, { status: 400 });
    }

    // Banner: Bilder + Videos (inkl. GIF = image/gif)
    if (
      kind === 'banners' &&
      files.some(f => {
        const t = (f.type || '').toLowerCase();
        return !(t.startsWith('image/') || t.startsWith('video/'));
      })
    ) {
      return NextResponse.json({ error: 'images or videos only' }, { status: 400 });
    }

    const items = await Promise.all(
      files.map(async (f) => {
        const { uploadUrl, publicUrl } = await presignPut(kind, f.name, f.type);
        return { uploadUrl, publicUrl, kind };
      })
    );

    return NextResponse.json({ items });
  } catch (e) {
    console.error('upload-urls error:', e);
    return NextResponse.json({ error: 'Failed to presign upload URLs' }, { status: 500 });
  }
}
