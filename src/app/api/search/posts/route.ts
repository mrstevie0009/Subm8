// src/app/api/search/posts/route.ts
import { prisma } from '@/lib/prisma';
import { excludeAdminAuthor } from '@/lib/adminFilter';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(sp.get('limit') || 20), 1), 50);
  const sort = (sp.get('sort') || 'latest') as 'latest' | 'top';

  if (!q) return Response.json({ ok: true, posts: [] });

  const posts = await prisma.post.findMany({
    where: {
      AND: [
        { text: { contains: q, mode: 'insensitive' } },
        { author: excludeAdminAuthor() }, // Autor darf nicht Admin sein
      ],
    },
    select: {
      id: true,
      text: true,
      mediaUrl: true,
      mediaAlt: true,
      createdAt: true,
      author: { select: { handle: true, displayName: true, avatarUrl: true } },
      _count: { select: { Like: true, Comment: true, bookmarks: true } },
    },
    orderBy:
      sort === 'latest'
        ? [{ createdAt: 'desc' }]
        : [
            { Like: { _count: 'desc' } }, // „Top“ = nach Like-Anzahl
            { createdAt: 'desc' },
          ],
    take: limit,
  });

  return Response.json({
    ok: true,
    posts: posts.map((p) => ({
      id: p.id,
      text: p.text,
      mediaUrl: p.mediaUrl ?? undefined,
      mediaAlt: p.mediaAlt ?? undefined,
      createdAt: p.createdAt,
      author: {
        handle: p.author.handle,
        name: p.author.displayName || p.author.handle,
        avatar: p.author.avatarUrl ?? undefined,
      },
      counts: {
        likes: p._count.Like,
        comments: p._count.Comment,
        bookmarks: p._count.bookmarks,
      },
    })),
  });
}
