//src/app/api/contracts/[id]/media/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const runtime = 'nodejs';

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
  const files = Array.isArray(body.files) ? body.files : [];

  await prisma.$transaction(async (tx) => {
    for (const f of files.slice(0, 10)) {
      const mimeType = String(f.mimeType || '');
      const key = String(f.key || '');
      if (!key.startsWith('contract-private/')) continue;
      if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) continue;

      await tx.contractPrivateMedia.create({
        data: {
          contractId: id,
          uploadedById: me.id,
          key,
          filename: typeof f.filename === 'string' ? f.filename.slice(0, 180) : null,
          mimeType,
          kind: mimeType.startsWith('video/') ? 'VIDEO' : 'IMAGE',
          sizeBytes: Number.isFinite(Number(f.sizeBytes)) ? Math.round(Number(f.sizeBytes)) : null,
        },
      });
    }

    await tx.contractEvent.create({
      data: {
        contractId: id,
        actorId: me.id,
        type: 'PRIVATE_MEDIA_ADDED',
      },
    });
  });

  return NextResponse.json({ ok: true });
}