// src/app/api/mentions/search/route.ts
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const limit = Math.min(Number(searchParams.get('limit') || 8), 20);

    // nur bei "@<min. 1 zeichen>" sinnvoll
    if (!q || q.length < 1) {
      return Response.json({ ok: true, users: [] });
    }

    // Handles vorne gewichten, Displayname als Fallback
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { handle: { startsWith: q, mode: 'insensitive' } },
          { displayName: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        avatarUrl: true,
        role: true, // 'DOMME' | 'SUBMISSIVE'
      },
      orderBy: [{ handle: 'asc' }],
      take: limit,
    });

    return Response.json({
      ok: true,
      users: users.map(u => ({
        id: u.id,
        handle: u.handle,
        displayName: u.displayName ?? u.handle,
        avatarUrl: u.avatarUrl,
        role: u.role, // passt so durch
      })),
    });
  } catch (e) {
    console.error('GET /api/mentions/search failed', e);
    return Response.json({ ok: false, error: 'Internal error' }, { status: 500 });
  }
}
