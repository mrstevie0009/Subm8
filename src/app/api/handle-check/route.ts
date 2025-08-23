import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get('handle') || '').toLowerCase();

  const ok = /^[a-z0-9_]{3,20}$/.test(handle);
  if (!ok) return Response.json({ ok: true, available: false });

  const exists = await prisma.user.findFirst({
    where: { handle: { equals: handle, mode: 'insensitive' } },
    select: { id: true },
  });

  return Response.json({ ok: true, available: !exists });
}
