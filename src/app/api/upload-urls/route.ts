//src/app/api/upload-urls/route.ts
import { NextResponse } from 'next/server';
import { presignPut } from '@/lib/r2sign';

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
    const { files } = (await req.json()) as { files: { name: string; type: string }[] };

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    // ⬇️ NEU: ?kind=chat-media (Default: post-media)
    const url = new URL(req.url);
    const rawKind = (url.searchParams.get('kind') || 'post-media') as Kind;
    const kind: Kind = (ALLOWED_KINDS.has(rawKind) ? rawKind : 'post-media') as Kind;

    if ((kind === 'avatars' || kind === 'banners') &&
        files.some(f => !/^image\//.test(f.type || ''))) {
      return NextResponse.json({ error: 'images only' }, { status: 400 });
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
