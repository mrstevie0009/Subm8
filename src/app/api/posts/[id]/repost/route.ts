// src/app/api/posts/[id]/repost/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

// POST /api/posts/:id/repost
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentUser().catch(() => null);
  if (!me) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const { id } = await params;

  // Existiert der Ziel-Post?
  const target = await prisma.post.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json(
      { ok: false, error: 'NOT_FOUND' },
      { status: 404 },
    );
  }

  // Repost anlegen (Text leer – Inhalt kommt vom Original)
  const created = await prisma.post.create({
    data: { authorId: me.id, repostOfId: target.id, text: '' },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    id: created.id,
    createdAt: created.createdAt.toISOString(),
  });
}
