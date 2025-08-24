// src/app/api/user/[handle]/posts/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { handle: string };

export const dynamic = 'force-dynamic'; // kein statisches Caching für den Feed

function normalizeMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  // already absolute or correct public path
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) {
    return url;
  }
  // bare filename like "ee0a-...-b2d8.png" -> prefix with /uploads/
  if (/^[a-f0-9-]+\.(png|jpe?g|webp|gif)$/i.test(url)) {
    return `/uploads/${url}`;
  }
  // legacy relative like "uploads/..." -> ensure it has leading slash
  if (url.startsWith('uploads/')) {
    return `/${url}`;
  }
  return url;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const handle = params.handle.toLowerCase();

    const user = await prisma.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        text: true,
        mediaUrl: true,
        mediaAlt: true,
        nsfw: true,
        author: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
      take: 50, // optional: begrenzen
    });

    const items = posts.map((p) => ({
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      text: p.text,
      mediaUrl: normalizeMediaUrl(p.mediaUrl),
      mediaAlt: p.mediaAlt ?? undefined,
      nsfw: p.nsfw,
      author: {
        id: p.author.id,
        handle: p.author.handle,
        displayName: p.author.displayName,
        avatarUrl: p.author.avatarUrl ?? undefined,
      },
    }));

    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load posts' }, { status: 500 });
  }
}
