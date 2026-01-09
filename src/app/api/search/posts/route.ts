// src/app/api/search/posts/route.ts
import { prisma } from '@/lib/prisma';
import { excludeAdminAuthor } from '@/lib/adminFilter';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(sp.get('limit') || 20), 1), 50);
  const sort = (sp.get('sort') || 'latest') as 'latest' | 'top';

  if (!q) return Response.json({ ok: true, posts: [] });

  // 1) Author-IDs finden, deren kinks[] partial match auf q haben (Postgres unnest + ILIKE)
  //    - Optional: ab 2 Zeichen, um "%a%" Explosionen zu vermeiden
  const kinkAuthorIds =
    q.length >= 2
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT u.id
          FROM "User" u
          WHERE u."isDeactivated" = false
            AND u."isAdmin" = false
            AND EXISTS (
              SELECT 1
              FROM unnest(u.kinks) AS k
              WHERE k ILIKE ('%' || ${q} || '%')
            )
        `
      : [];

  const kinkIds = kinkAuthorIds.map((x) => x.id);

  // 2) Posts suchen: (Text matcht q) ODER (Autor in kinkIds)
  //    + weiterhin: excludeAdminAuthor() auf Autor-Relation anwenden
  const posts = await prisma.post.findMany({
    where: {
      AND: [
        { author: excludeAdminAuthor() }, // Autor darf nicht Admin sein (und ggf. nicht deaktiviert, je nach deiner impl.)
        {
          OR: [
            { text: { contains: q, mode: 'insensitive' } },
            ...(kinkIds.length > 0 ? [{ authorId: { in: kinkIds } }] : []),
          ],
        },
      ],
    },
    select: {
      id: true,
      text: true,
      mediaUrl: true,
      mediaAlt: true,
      createdAt: true,
      author: {
        select: {
          id: true,
          handle: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          premiumUntil: true,
          isFirstAdopter: true,
        },
      },
      _count: { select: { Like: true, Comment: true, bookmarks: true } },
    },
    orderBy:
      sort === 'latest'
        ? [{ createdAt: 'desc' }]
        : [{ Like: { _count: 'desc' } }, { createdAt: 'desc' }],
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
        id: p.author.id,
        handle: p.author.handle,
        name: p.author.displayName || p.author.handle,
        avatar: p.author.avatarUrl ?? undefined,
        role: p.author.role,
        premiumUntil: p.author.premiumUntil ? p.author.premiumUntil.toISOString() : null,
        isFirstAdopter: !!p.author.isFirstAdopter,
      },
      counts: {
        likes: p._count.Like,
        comments: p._count.Comment,
        bookmarks: p._count.bookmarks,
      },
    })),
  });
}
