// src/app/api/me/offer/route.ts
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

async function ensureOfferTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserOffer" (
      "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "title" TEXT,
      "body"  TEXT,
      "bgUrl" TEXT,
      "bgOpacity" REAL NOT NULL DEFAULT 0.35,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function isImage(type: string) {
  return /^image\//.test(type || '');
}
function sanitizeFileName(name: string) {
  const base = name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
  return base.length ? base : `upload_${Date.now()}`;
}

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  await ensureOfferTable();

  const rows = await prisma.$queryRaw<
    { title: string | null; body: string | null; bgUrl: string | null; bgOpacity: number | null }[]
  >`SELECT "title","body","bgUrl","bgOpacity" FROM "UserOffer" WHERE "userId" = ${me.id} LIMIT 1`;

  return Response.json({ ok: true, offer: rows[0] ?? null });
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!me) return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });

  await ensureOfferTable();

  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('multipart/form-data')) {
    return Response.json({ ok: false, error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const form = await req.formData();
  const title = String(form.get('title') ?? '').slice(0, 120).trim();
  const body  = String(form.get('body') ?? '').slice(0, 4000).trim();
  const bgOpacity = Math.max(0, Math.min(1, Number(form.get('bgOpacity') ?? 0.35)));

  let bgUrl: string | null = null;

  const file = form.get('bg') as File | null;
  if (file && typeof file !== 'string' && file.size > 0) {
    if (!isImage(file.type)) {
      return Response.json({ ok: false, error: 'Unsupported file type' }, { status: 400 });
    }
    if (file.size > 20 * 1024 * 1024) {
      return Response.json({ ok: false, error: 'File too large' }, { status: 413 });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await fs.mkdir(uploadsDir, { recursive: true });
    const safeName = `${randomUUID()}_${sanitizeFileName(file.name)}`;
    const full = path.join(uploadsDir, safeName);
    await fs.writeFile(full, Buffer.from(await file.arrayBuffer()));
    bgUrl = `/uploads/${encodeURIComponent(safeName)}`;
  } else {
    // kein neues Bild hochgeladen → vorhandenes behalten, außer removeBg=true
    const remove = String(form.get('removeBg') ?? '') === 'true';
    if (!remove) {
      const current = await prisma.$queryRaw<{ bgUrl: string | null }[]>`
        SELECT "bgUrl" FROM "UserOffer" WHERE "userId" = ${me.id} LIMIT 1`;
      bgUrl = current[0]?.bgUrl ?? null;
    } else {
      bgUrl = null;
    }
  }

  await prisma.$executeRaw`
    INSERT INTO "UserOffer" ("userId","title","body","bgUrl","bgOpacity","updatedAt")
    VALUES (${me.id}, ${title}, ${body}, ${bgUrl}, ${bgOpacity}, CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET
      "title" = EXCLUDED."title",
      "body"  = EXCLUDED."body",
      "bgUrl" = EXCLUDED."bgUrl",
      "bgOpacity" = EXCLUDED."bgOpacity",
      "updatedAt" = CURRENT_TIMESTAMP
  `;

  return Response.json({ ok: true, offer: { title, body, bgUrl, bgOpacity } });
}
