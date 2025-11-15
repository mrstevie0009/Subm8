// src/app/api/comments/[id]/like/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const me = await getCurrentUser();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.commentLike.findUnique({
      where: { userId_commentId: { userId: me.id, commentId: id } },
    });

    if (existing) {
      await prisma.commentLike.delete({
        where: { userId_commentId: { userId: me.id, commentId: id } },
      });
      return NextResponse.json({ ok: true, liked: false });
    } else {
      await prisma.commentLike.create({
        data: { userId: me.id, commentId: id },
      });
      return NextResponse.json({ ok: true, liked: true });
    }
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { ok: false, error: 'SERVER_ERROR' },
      { status: 500 },
    );
  }
}
