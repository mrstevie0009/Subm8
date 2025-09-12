// src/app/api/suggestions/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';
import { excludeAdminFromUsers } from '@/lib/adminFilter';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const me = await getCurrentUser().catch(() => null);

    const url = new URL(req.url);
    const takeParam = Number(url.searchParams.get('take') ?? 3);
    const take = Number.isFinite(takeParam) ? Math.min(Math.max(takeParam, 1), 10) : 3;

    const excludeParam = String(url.searchParams.get('exclude') ?? '');
    const excludeIds = excludeParam
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    // Zielrolle abhängig von mir
    const targetRole = me?.role === 'DOMME' ? 'SUBMISSIVE' : 'DOMME';

    // mich + excludeIds in eine Liste packen
    const notInIds = [...excludeIds, me?.id ?? ''].filter(Boolean);

    // Kandidaten holen (mit Admin-Ausschluss), Puffer dann randomisieren
    const candidates = await prisma.user.findMany({
      where: excludeAdminFromUsers({
        role: targetRole,
        isDeactivated: false,
        id: notInIds.length ? { notIn: notInIds } : undefined,
      }),
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
      take: 50,
    });

    // Block-Filter (wer mich blockt / wen ich blocke) entfernen
    let filtered = candidates;
    if (me && candidates.length) {
      const [iBlock, blocksMe] = await Promise.all([
        prisma.block.findMany({
          where: { blockerId: me.id, blockedId: { in: candidates.map((c) => c.id) } },
          select: { blockedId: true },
        }),
        prisma.block.findMany({
          where: { blockerId: { in: candidates.map((c) => c.id) }, blockedId: me.id },
          select: { blockerId: true },
        }),
      ]);
      const iBlockSet = new Set(iBlock.map((b) => b.blockedId));
      const blocksMeSet = new Set(blocksMe.map((b) => b.blockerId));
      filtered = candidates.filter((c) => !iBlockSet.has(c.id) && !blocksMeSet.has(c.id));
    }

    // Zufällig mischen
    for (let i = filtered.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
    }

    const picked = filtered.slice(0, take);

    // Follow-Status anreichern
    let followingSet = new Set<string>();
    if (me && picked.length) {
      const following = await prisma.follow.findMany({
        where: { followerId: me.id, followeeId: { in: picked.map((p) => p.id) } },
        select: { followeeId: true },
      });
      followingSet = new Set(following.map((f) => f.followeeId));
    }

    return Response.json({
      ok: true,
      users: picked.map((u) => ({
        id: u.id,
        handle: u.handle,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl ?? null,
        role: u.role, // 'DOMME' | 'SUBMISSIVE'
        isFollowing: me ? followingSet.has(u.id) : false,
      })),
      headline: me?.role === 'SUBMISSIVE' ? 'Findomme for hire' : 'Subs you might like',
    });
  } catch (e) {
    console.error('GET /api/suggestions failed:', e);
    return Response.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
