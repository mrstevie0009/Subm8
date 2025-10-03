//src/app/api/posts/[id]/route.ts
import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { purgePostAndReposts } from '@/lib/posts';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getAuth();
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // WICHTIG: id aus params holen (nicht contentId)
  const id = await params.id; // oder: const id = (params as any).id ?? (params as any).contentId;
  if (!id) {
    return NextResponse.json({ ok: false, error: 'MISSING_ID' }, { status: 400 });
  }

  const me = String(session.user.id);

  const target = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, repostOfId: true },
  });

  if (!target) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
  if (String(target.authorId) !== me) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  if (target.repostOfId) {
    await prisma.post.delete({ where: { id: target.id } });
    return NextResponse.json({ ok: true });
  }

  const cascade = new URL(req.url).searchParams.get('cascade');
  if (cascade !== 'reposts') {
    return NextResponse.json({ ok: false, error: 'Missing cascade=reposts' }, { status: 400 });
  }

  await purgePostAndReposts(target.id, me);
  return NextResponse.json({ ok: true });
}
