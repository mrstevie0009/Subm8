// src/app/api/posts/preview([id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (!id) return NextResponse.json({ ok: false, error: 'MISSING_ID' }, { status: 400 });

    const p = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        text: true,
        mediaUrl: true,
        mediaAlt: true,
        uploaded: {
          select: {
            url: true,
            alt: true,
            type: true,
          },
        },
        createdAt: true,
        author: { select: { handle: true, displayName: true, avatarUrl: true } },
      },
    });
    if (!p) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    return NextResponse.json({
      ok: true,
      post: {
        id: p.id,
        text: p.text ?? '',
        createdAt: p.createdAt.toISOString(),
        mediaUrl: p.mediaUrl ?? null,
        mediaAlt: p.mediaAlt ?? null,
        uploaded: p.uploaded ?? [],
        author: {
          handle: p.author.handle,
          displayName: p.author.displayName || p.author.handle,
          avatarUrl: p.author.avatarUrl ?? null,
        },
      },
    });
  } catch (e) {
    console.error('GET /api/posts/preview/[id] failed:', e);
    return NextResponse.json({ ok: false, error: 'INTERNAL' }, { status: 500 });
  }
}