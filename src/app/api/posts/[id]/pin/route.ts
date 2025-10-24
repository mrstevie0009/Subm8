// src/app/api/posts/[Id]/pin/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, ctx: { params: { postId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: 'UNAUTHENTICATED' }, { status: 401 });

  const { postId } = await ctx.params;
  const { pin } = await req.json().catch(() => ({ pin: true })); // default: pin

  // Ownership prüfen (nur eigene Posts dürfen gepinnt werden)
  const owns = await prisma.post.findFirst({
    where: { id: postId, authorId: session.user.id },
    select: { id: true },
  });
  if (!owns) return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { pinnedPostId: pin ? postId : null },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, pinnedPostId: pin ? postId : null });
}
