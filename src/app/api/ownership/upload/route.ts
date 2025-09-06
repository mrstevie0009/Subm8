import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export const runtime = 'nodejs';         // wir brauchen Node-FS, kein Edge
export const dynamic = 'force-dynamic';  // nicht cachen

function extFromMime(m: string): string {
  switch (m) {
    case 'image/jpeg': return '.jpg';
    case 'image/png':  return '.png';
    case 'image/webp': return '.webp';
    case 'image/gif':  return '.gif';
    default:           return '';
  }
}

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

export async function POST(req: Request) {
  try {
    const form = await req.formData();

    // Wir akzeptieren EITHER ein echtes File oder eine Base64-DataURL
    const file = form.get('file') as File | null;
    let buf: Buffer;
    let mime = '';
    let ext = '';

    if (file && 'arrayBuffer' in file) {
      if (file.size > MAX_BYTES) {
        return NextResponse.json({ ok: false, error: 'File too large' }, { status: 413 });
      }
      mime = file.type || 'application/octet-stream';
      ext = extFromMime(mime) || path.extname((file as unknown as { name?: string }).name || '') || '.bin';
      buf = Buffer.from(await file.arrayBuffer());
    } else {
      const dataUrl = (form.get('dataUrl') as string | null) ?? null;
      if (!dataUrl) {
        return NextResponse.json({ ok: false, error: 'Missing file' }, { status: 400 });
      }
      const m = /^data:([\w/+.-]+);base64,(.+)$/i.exec(dataUrl);
      if (!m) {
        return NextResponse.json({ ok: false, error: 'Bad data URL' }, { status: 400 });
      }
      mime = m[1];
      ext = extFromMime(mime) || '.bin';
      buf = Buffer.from(m[2], 'base64');
      if (buf.length > MAX_BYTES) {
        return NextResponse.json({ ok: false, error: 'File too large' }, { status: 413 });
      }
    }

    if (!/^image\//.test(mime)) {
      return NextResponse.json({ ok: false, error: 'Only images allowed' }, { status: 415 });
    }

    // Zielordner vorbereiten
    const id = randomBytes(16).toString('hex');
    const filename = id + ext;
    const dir = path.join(process.cwd(), 'public', 'uploads', 'ownership');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), buf);

    const url = `/uploads/ownership/${filename}`;

    return NextResponse.json({
      ok: true,
      id,
      url,
      mime,
      bytes: buf.length,
    });
  } catch (err) {
    console.error('Ownership upload failed:', err);
    return NextResponse.json({ ok: false, error: 'Upload failed' }, { status: 500 });
  }
}
