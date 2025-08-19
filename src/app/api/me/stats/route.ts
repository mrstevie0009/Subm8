// src/app/api/me/stats/route.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export const dynamic = 'force-dynamic';

export async function GET() {
  const me = await getCurrentUser();
  if (!me) {
    return Response.json({ ok: false, error: 'Not authenticated' }, { status: 401 });
  }

  const [followers, following] = await Promise.all([
    prisma.follow.count({ where: { followeeId: me.id } }), // wer mir folgt
    prisma.follow.count({ where: { followerId: me.id } }), // wem ich folge
  ]);

  return Response.json({ ok: true, followers, following });
}
