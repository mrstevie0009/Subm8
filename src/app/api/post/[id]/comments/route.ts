// src/app/api/post/[id]/comments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// Optional: du kannst 'force-dynamic' weglassen; Route Handlers sind ohnehin dynamisch.
// export const dynamic = 'force-dynamic';

type Params = { id: string };

// --- einfacher In-Memory-Rate-Limiter (pro Client+Post) ---
const MIN_GAP_MS = 800; // Mindestabstand zwischen Requests
const lastHit = new Map<string, number>();

function clientKey(req: Request, postId: string) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'local';
  const ua = req.headers.get('user-agent') || '';
  return `${ip}:${postId}:${ua.slice(0, 40)}`;
}

export async function GET(req: Request, ctx: { params: Promise<Params> }) {
  const { id } = await ctx.params;

  // 1) offensichtliche Prefetches ignorieren (Next / Browser)
  const prefetch =
    req.headers.get('purpose') === 'prefetch' ||
    req.headers.get('sec-purpose') === 'prefetch' ||
    req.headers.get('x-middleware-prefetch') === '1' ||
    req.headers.get('next-router-prefetch') === '1';
  if (prefetch) {
    return new NextResponse(null, { status: 204 }); // kein Body, kein Log-Spam
  }

  // 2) Mindestabstand pro Client × Post
  const key = clientKey(req, id);
  const now = Date.now();
  const last = lastHit.get(key) ?? 0;
  if (now - last < MIN_GAP_MS) {
    return NextResponse.json(
      { ok: true, throttled: true, items: [], nextCursor: null },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Comments-Throttled': '1',
        },
      },
    );
  }
  lastHit.set(key, now);

  try {
    // Cursor aus Query lesen (optional)
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor'); // id des letzten Elements

    const take = 50; // page size – passe an deine UI an
    const rows = await prisma.comment.findMany({
      where: { postId: id },
      orderBy: { createdAt: 'asc' },
      // Cursor-Pagination (skip=1 bei Cursor)
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
      select: {
        id: true,
        createdAt: true,
        text: true,
        User: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const items = rows.map((c) => ({
      id: c.id,
      createdAt: c.createdAt.toISOString(),
      text: c.text,
      author: {
        id: c.User.id,
        handle: c.User.handle,
        displayName: c.User.displayName,
        avatarUrl: c.User.avatarUrl ?? null,
      },
    }));

    const nextCursor = rows.length === take ? rows[rows.length - 1]!.id : null;

    return NextResponse.json(
      { ok: true, items, nextCursor },
      {
        headers: {
          // kein HTTP-Caching, aber auch keine Proxies, die „helfen“ wollen
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (e) {
    console.error('GET /api/post/[id]/comments failed:', e);
    return NextResponse.json(
        { ok: false, error: 'Failed to load comments' },
        { status: 500 },
    );
  }

}
