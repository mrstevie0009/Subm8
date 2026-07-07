//src/api/search/route.ts
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/ip';
import { rateLimit } from '@/lib/rateLimitStore';

type Person = { handle: string; name: string; avatar?: string };
type TrendingItem = { tag: string; posts: number };

export async function GET(req: Request) {
  const ip = await getClientIp();
  const gate = await rateLimit(`search:${ip}`, 120, 60 * 1000); // 120/min
  if (!gate.ok) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': String(gate.retryAfterSec) },
    });
  }
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const limit = Math.min(Math.max(Number(searchParams.get('limit') || 8), 1), 20);

  // ---- People (handle/displayName match) ----
  let people: Person[] = [];
  if (q) {
    const users = await prisma.user.findMany({
      where: {
        isDeactivated: false,
        isAdmin: false,
        OR: [
          { handle: { contains: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { handle: true, displayName: true, avatarUrl: true },
      take: limit,
      orderBy: [{ handle: 'asc' }],
    });

    people = users.map((u) => ({
      handle: u.handle,
      name: u.displayName || u.handle,
      avatar: u.avatarUrl ?? undefined,
    }));
  }

  // ---- Trending (Hashtags aus den letzten 7 Tagen) ----
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentPosts = await prisma.post.findMany({
    where: { createdAt: { gte: since } },
    select: { text: true },
    take: 1000,
    orderBy: { createdAt: 'desc' },
  });

  const counts = new Map<string, number>();
  const tagRegex = /#([a-z0-9_]{2,50})/gi;
  for (const p of recentPosts) {
    if (!p.text) continue;
    let m: RegExpExecArray | null;
    while ((m = tagRegex.exec(p.text)) !== null) {
      const tag = m[1].toLowerCase();
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  const trending: TrendingItem[] = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, posts]) => ({ tag, posts }));

  return Response.json({ ok: true, people, trending });
}
