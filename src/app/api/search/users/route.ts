// src/app/api/search/users/route.ts
import { prisma } from '@/lib/prisma';
import { excludeAdminFromUsers } from '@/lib/adminFilter';

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(sp.get('limit') || 8), 1), 25);
  const sort = (sp.get('sort') || 'followers') as 'followers' | 'alpha';

  if (!q) return Response.json({ ok: true, users: [] });

  const where = excludeAdminFromUsers({
    isDeactivated: false,
    OR: [
      { handle: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
      { bio: { contains: q, mode: 'insensitive' } },
    ],
  });

  const users = await prisma.user.findMany({
    where,
    select: {
      handle: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      role: true,               
      premiumUntil: true,       
      isFirstAdopter: true,
      _count: { select: { followers: true } },
    },
    orderBy:
      sort === 'followers'
        ? [
            { followers: { _count: 'desc' } }, // Meiste Follower zuerst
            { handle: 'asc' },
          ]
        : [{ handle: 'asc' }],
    take: limit,
  });

  return Response.json({
    ok: true,
    users: users.map((u) => ({
      handle: u.handle,
      name: u.displayName || u.handle,
      avatar: u.avatarUrl ?? undefined,
      followers: u._count.followers,
      bio: u.bio ?? null,
      role: u.role,
      premiumUntil: u.premiumUntil ? u.premiumUntil.toISOString() : null,
      isFirstAdopter: !!u.isFirstAdopter,
    })),
  });
}
