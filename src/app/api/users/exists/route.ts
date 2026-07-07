import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/ip';
import { rateLimit } from '@/lib/rateLimitStore';

export const dynamic = 'force-dynamic';

// Max. Handles pro Request – verhindert Masse-Scraping in einem Call
const MAX_HANDLES_PER_REQUEST = 50;

export async function GET(req: Request) {
  try {
    const ip = await getClientIp();
    const gate = await rateLimit(`users-exists:${ip}`, 60, 60 * 1000); // 60/min
    if (!gate.ok) {
      return Response.json({ ok: false, error: 'Too many requests' }, { status: 429 });
    }

    const url = new URL(req.url);
    const raw = (url.searchParams.get('handles') || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && /^[a-z0-9_]{3,20}$/.test(s));

    // ✅ Batch begrenzen (nach Dedupe abschneiden)
    const handles = Array.from(new Set(raw)).slice(0, MAX_HANDLES_PER_REQUEST);
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
