import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const raw = (url.searchParams.get('handles') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && /^[a-z0-9_]{3,20}$/.test(s));

    const handles = Array.from(new Set(raw));
    if (handles.length === 0) {
      return Response.json({ ok: true, existing: [] });
    }

    const rows = await prisma.user.findMany({
      where: { handle: { in: handles } },
      select: { handle: true },
    });

    return Response.json({
      ok: true,
      existing: rows.map((r) => r.handle.toLowerCase()),
    });
  } catch {
    return Response.json({ ok: false, existing: [] }, { status: 500 });
  }
}
