// src/app/api/user/[handle]/posts/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { handle: string };

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

    // Posts des Users inkl. Autor-Infos (für PostCard)
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
        // Wenn du Zähler/Viewer-Infos hast, hier ergänzen:
        // _count: { select: { likes: true, comments: true, reposts: true } },
      },
    });

    // schlanke Form zurückgeben – PostCard kann diese Struktur i. d. R. adaptieren
    const items = posts.map((p) => ({
      id: p.id,
      createdAt: p.createdAt.toISOString(),
      text: p.text,
      mediaUrl: p.mediaUrl,
      mediaAlt: p.mediaAlt,
      nsfw: p.nsfw,
      author: {
        id: p.author.id,
        handle: p.author.handle,
        displayName: p.author.displayName,
        avatarUrl: p.author.avatarUrl,
      },
      // Optional: stats/viewer falls dein PostCard das erwartet
      // stats: { likes: 0, replies: 0, reposts: 0 },
      // viewer: { liked: false, bookmarked: false },
    }));

    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load posts' }, { status: 500 });
  }
}
