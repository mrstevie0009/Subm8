import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const MAX_IMAGE_MB = 10;
const ALLOWED_PREFIX = 'image/';

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const form = await req.formData();
    const text = String(form.get('text') ?? '').trim();
    const image = form.get('image');

    if (!text && !(image instanceof File)) {
      return NextResponse.json(
        { ok: false, error: 'Feedback text or image is required.' },
        { status: 400 }
      );
    }

    let imageUrl: string | null = null;

    if (image instanceof File && image.size > 0) {
      if (!image.type.startsWith(ALLOWED_PREFIX)) {
        return NextResponse.json(
          { ok: false, error: 'Only image uploads are allowed.' },
          { status: 400 }
        );
      }

      if (image.size > MAX_IMAGE_MB * 1024 * 1024) {
        return NextResponse.json(
          { ok: false, error: `Image must be <= ${MAX_IMAGE_MB} MB.` },
          { status: 400 }
        );
      }

      const bytes = Buffer.from(await image.arrayBuffer());
      const dir = path.join(process.cwd(), 'public', 'uploads', 'feedback');
      await mkdir(dir, { recursive: true });

      const filename = `${Date.now()}-${crypto.randomUUID()}-${safeName(image.name || 'feedback-image')}`;
      const filePath = path.join(dir, filename);

      await writeFile(filePath, bytes);
      imageUrl = `/uploads/feedback/${filename}`;
    }

    await prisma.feedback.create({
      data: {
        userId: session.user.id,
        text: text || null,
        imageUrl,
        userAgent: req.headers.get('user-agent') || null,
        status: 'OPEN',
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Internal server error.' },
      { status: 500 }
    );
  }
}