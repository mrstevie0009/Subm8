import { NextResponse } from 'next/server';
import { presignPut } from '@/lib/r2sign';

export async function POST(req: Request) {
  try {
    const { files } = (await req.json()) as { files: { name: string; type: string }[] };

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'No files' }, { status: 400 });
    }

    const items = await Promise.all(
      files.map(async (f) => {
        const { uploadUrl, publicUrl } = await presignPut('post-media', f.name, f.type);
        return { uploadUrl, publicUrl };
      })
    );

    return NextResponse.json({ items });
  } catch (e) {
    console.error('upload-urls error:', e);
    return NextResponse.json({ error: 'Failed to presign upload URLs' }, { status: 500 });
  }
}
