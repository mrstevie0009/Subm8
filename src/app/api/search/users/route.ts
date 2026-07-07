import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/ip';
import { rateLimit } from '@/lib/rateLimitStore';
import { excludeAdminFromUsers } from '@/lib/adminFilter';

export async function GET(req: Request) {
  const ip = await getClientIp();
  const gate = await rateLimit(`search:${ip}`, 120, 60 * 1000); // 120/min
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(gate.retryAfterSec) },
    });
  }
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(sp.get('limit') || 8), 1), 25);
  const sort = (sp.get('sort') || 'followers') as 'followers' | 'alpha';

  if (!q) return Response.json({ ok: true, users: [] });

  // 1) Normal: handle/displayName/bio
  const baseWhere = excludeAdminFromUsers({
    isDeactivated: false,
    OR: [
      { handle: { contains: q, mode: 'insensitive' } },
      { displayName: { contains: q, mode: 'insensitive' } },
      { bio: { contains: q, mode: 'insensitive' } },
    ],
  });

  // 2) Kinks: partial match auf Array-Elementen via Postgres unnest + ILIKE
  const qForLike = q;
  const kinkIds =
    qForLike.length >= 2
      ? await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT u.id
          FROM "User" u
          WHERE u."isDeactivated" = false
            AND u."isAdmin" = false
            AND EXISTS (
              SELECT 1
              FROM unnest(u.kinks) AS k
              WHERE k ILIKE ('%' || ${qForLike} || '%')
            )
          LIMIT ${limit}
        `
      : [];

  // 3) Base users laden
  const baseUsers = await prisma.user.findMany({
    where: baseWhere,
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      role: true,
      premiumUntil: true,
      isFirstAdopter: true,
      kinks: true,
      _count: { select: { followers: true } },
    },
    orderBy:
      sort === 'followers'
        ? [{ followers: { _count: 'desc' } }, { handle: 'asc' }]
        : [{ handle: 'asc' }],
    take: limit,
  });

  // 4) Kink users laden (Details via Prisma, damit select/shape gleich ist)
  const kinkUsers =
    kinkIds.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { in: kinkIds.map((x) => x.id) },
          },
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            role: true,
            premiumUntil: true,
            isFirstAdopter: true,
            kinks: true,
            _count: { select: { followers: true } },
          },
        })
      : [];

  // 5) Merge + uniq by handle (oder id)
  const merged = new Map<string, typeof baseUsers[number]>();
  for (const u of baseUsers) merged.set(u.handle, u);
  for (const u of kinkUsers) merged.set(u.handle, u);

  const usersArr = Array.from(merged.values());

  // 6) Sort nach Wunsch + limit
  usersArr.sort((a, b) => {
    if (sort === 'followers') {
      const da = a._count.followers;
      const db = b._count.followers;
      if (db !== da) return db - da;
    }
    return a.handle.localeCompare(b.handle);
  });

  const users = usersArr.slice(0, limit);

  return Response.json({
    ok: true,
    users: users.map((u) => ({
      id: u.id,
      handle: u.handle,
      name: u.displayName || u.handle,
      avatar: u.avatarUrl ?? undefined,
      followers: u._count.followers,
      bio: u.bio ?? null,
      role: u.role,
      premiumUntil: u.premiumUntil ? u.premiumUntil.toISOString() : null,
      isFirstAdopter: !!u.isFirstAdopter,
      kinks: Array.isArray(u.kinks) ? u.kinks : (u.kinks ?? null),
    })),
  });
}
