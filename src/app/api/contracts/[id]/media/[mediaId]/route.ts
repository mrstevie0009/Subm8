//src/app/api/contracts/[id]/media/[mediaId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { presignGet } from '@/lib/r2sign';

export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; mediaId: string }> }
) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return NextResponse.json({ ok: false }, { status: 401 });

  const { id, mediaId } = await params;

  const media = await prisma.contractPrivateMedia.findFirst({
    where: {
      id: mediaId,
      contractId: id,
      contract: {
        status: { not: 'DELETED' },
        OR: [{ ownerId: me.id }, { counterpartyId: me.id }],
      },
    },
    select: {
      key: true,
      mimeType: true,
    },
  });

  if (!media) {
    return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
  }

  const url = await presignGet(media.key, 60);

  return NextResponse.redirect(url);
}