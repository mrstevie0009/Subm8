import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export const runtime = 'nodejs';

type Params = { slug: string };

/**
 * DELETE /api/communities/:slug
 * Nur der/die Ersteller:in darf löschen.
 * Löscht in einer TX: Posts -> Members -> Community.
 */
export async function DELETE(req: Request, ctx: { params: Promise<Params> }) {
  try {
    const session = await getAuth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const { slug } = await ctx.params;
    const comm = await prisma.community.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true, createdById: true },
    });
    if (!comm) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    if (comm.createdById !== userId) {
      return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
    }

    // Kaskadierende Löschung (anpassen, falls weitere Relationen existieren)
    await prisma.$transaction([
      prisma.post.deleteMany({ where: { communityId: comm.id } }),
      prisma.communityMember.deleteMany({ where: { communityId: comm.id } }),
      prisma.community.delete({ where: { id: comm.id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('DELETE /communities/[slug] failed:', e);
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
