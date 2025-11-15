// src/app/api/profile/ownership/apply/route.ts
import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ──────────────────────────────────────────────────────────────────────────────

function extFromMime(mime: string): string {
  const m = (mime || '').toLowerCase();
  if (m.includes('jpeg')) return 'jpg';
  if (m.includes('png')) return 'png';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  return 'bin';
}

async function saveIncomingFile(
  file: File,
  userId: string,
  kind: 'avatar' | 'banner',
): Promise<string> {
  const arrayBuf = await file.arrayBuffer();
  const buf = Buffer.from(arrayBuf);

  const dir = path.join(process.cwd(), 'public', 'uploads', 'profile');
  await mkdir(dir, { recursive: true });

  const ext = extFromMime(file.type);
  const filename = `${userId}.${kind}.${Date.now()}.${ext}`;
  const filepath = path.join(dir, filename);

  await writeFile(filepath, buf);

  // öffentliche URL
  return `/uploads/profile/${filename}`;
}

/** User-ID aus Request-Headern ermitteln (für dein Auth-System ggf. anpassen) */
function getCurrentUserId(req: Request): string | null {
  const devId = req.headers.get('x-user-id');
  return devId || null;
}

// ──────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const userId = getCurrentUserId(req);
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const form = await req.formData();

    const bioRaw = form.get('bio');
    const bio =
      typeof bioRaw === 'string'
        ? bioRaw.trim().slice(0, 300) // Prisma: VarChar(300)
        : undefined;

    const avatarFile = form.get('avatar');
    const bannerFile = form.get('banner');

    if (avatarFile && !(avatarFile instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Invalid avatar' }, { status: 400 });
    }
    if (bannerFile && !(bannerFile instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Invalid banner' }, { status: 400 });
    }

    let avatarUrl: string | undefined;
    let bannerUrl: string | undefined;

    if (avatarFile instanceof File && avatarFile.size > 0) {
      avatarUrl = await saveIncomingFile(avatarFile, userId, 'avatar');
    }
    if (bannerFile instanceof File && bannerFile.size > 0) {
      bannerUrl = await saveIncomingFile(bannerFile, userId, 'banner');
    }

    if (!avatarUrl && !bannerUrl && typeof bio !== 'string') {
      return NextResponse.json({ ok: false, error: 'Nothing to apply' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(bannerUrl ? { bannerUrl } : {}),
        ...(typeof bio === 'string' ? { bio } : {}),
      },
    });

    return NextResponse.json({ ok: true, avatarUrl, bannerUrl, bio });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Apply failed';
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
