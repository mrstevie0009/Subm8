//src/app/api/contracts/[id]/private-upload-urls/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { presignPut } from '@/lib/r2sign';

export const runtime = 'nodejs';

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;

  const contract = await prisma.contract.findFirst({
    where: {
      id,
      OR: [{ ownerId: me.id }, { counterpartyId: me.id }],
      status: { not: 'DELETED' },
    },
    select: { id: true },
  });

  if (!contract) return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const files = Array.isArray(body.files) ? body.files.slice(0, 10) : [];

  if (!files.length) return NextResponse.json({ ok: false, error: 'No files' }, { status: 400 });

  const items = await Promise.all(files.map(async (f: { name?: string; type?: string }) => {
    const name = String(f.name || 'file');
    const type = String(f.type || '');

    if (!ALLOWED.has(type)) {
      throw new Error(`File type not allowed: ${type}`);
    }

    const signed = await presignPut('contract-private', name, type);

    return {
      key: signed.key,
      uploadUrl: signed.uploadUrl,
      contentType: signed.contentType,
      filename: name,
      mimeType: type,
    };
  }));

  return NextResponse.json({ ok: true, items });
}