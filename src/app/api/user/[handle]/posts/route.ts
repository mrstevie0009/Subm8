// src/app/api/user/[handle]/posts/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

type Role = 'DOMME' | 'SUBMISSIVE' | null;

function mapUploaded(
  rows: Array<{ url: string; alt: string | null; type: string | null }> | null | undefined,
) {
  return (rows ?? []).map((u) => {
    const mime = u.type ?? null;
    const kind: 'image' | 'video' | 'gif' =
      mime === 'image/gif' ? 'gif' : mime && mime.startsWith('video/') ? 'video' : 'image';
    return { url: u.url, alt: u.alt ?? null, kind, mime };
  });
}

export async function GET(req: Request, ctx: { params: { handle: string } }) {
  try {
    const { handle } = await ctx.params;

    const url = new URL(req.url);
    const beforeISO = url.searchParams.get('before');
    const sinceISO  = url.searchParams.get('since');
    const onlyCount = url.searchParams.get('onlyCount') === '1';
    const limitRaw  = Number(url.searchParams.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 && limitRaw <= 50 ? limitRaw : 20;

    const beforeDate = beforeISO ? new Date(beforeISO) : null;
    if (beforeISO && Number.isNaN(beforeDate!.getTime())) {
      return NextResponse.json({ ok: true, posts: [], hasMore: false, nextCursor: null });
    }
    const sinceDate = sinceISO ? new Date(sinceISO) : null;
    if (sinceISO && Number.isNaN(sinceDate!.getTime())) {
      return NextResponse.json({ ok: true, posts: [], count: 0 });
    }

    // Handle normalisieren
    const raw = handle.startsWith('@') ? handle.slice(1) : handle;
    const normalized = raw.toLowerCase();

    // User auflösen (inkl. pinnedPostId), Fallback auf ID
    let user = await prisma.user.findFirst({
      where: { handle: { equals: normalized, mode: 'insensitive' } },
      select: { id: true, pinnedPostId: true },
    });
    if (!user && /^[a-f0-9-]{24,}$/.test(raw)) {
      user = await prisma.user.findUnique({
        where: { id: raw },
        select: { id: true, pinnedPostId: true },
      });
    }
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found', posts: [], hasMore: false, nextCursor: null },
        { status: 404 }
      );
    }

    // --- Nur zählen (Polling) ---
    if (onlyCount) {
      const rows = await prisma.post.findMany({
        where: {
          authorId: user.id,
          ...(sinceDate ? { createdAt: { gt: sinceDate } } : {}),
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return NextResponse.json({ ok: true, count: rows.length });
    }

    // Pinned nur auf der ersten Seite (wenn kein before-Parameter)
    const pinnedId = !beforeDate ? user.pinnedPostId : null;

    // Gemeinsamer Include-Block (als const, damit Prisma-Typen ableitbar sind)
    const commonInclude = {
      author: {
        select: { id: true, handle: true, displayName: true, role: true, avatarUrl: true },
      },
      uploaded: true,
      repostOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true, mediaAlt: true,
          uploaded: true,
          createdAt: true,
          author: {
            select: { id: true, handle: true, displayName: true, role: true, avatarUrl: true },
          },
          _count: { select: { Like: true, Comment: true, reposts: true } },
        },
      },
      quoteOf: {
        select: {
          id: true,
          text: true,
          mediaUrl: true, mediaAlt: true,
          uploaded: true,
          createdAt: true,
          author: {
            select: { id: true, handle: true, displayName: true, role: true, avatarUrl: true },
          },
        },
      },
      _count: { select: { Like: true, Comment: true, reposts: true } },
    } as const;

    // Exakten Rückgabe-Typ aus dem Include ableiten
    type PostWithRels = Prisma.PostGetPayload<{ include: typeof commonInclude }>;

    // Gepinnten Post im selben Shape laden (damit der Typ identisch ist)
    const pinnedArr = pinnedId
      ? (await prisma.post.findMany({
          where: { id: pinnedId, authorId: user.id },
          orderBy: { createdAt: 'desc' },
          include: commonInclude,
          take: 1,
        })) as PostWithRels[]
      : [];

    const pinned: PostWithRels | null = pinnedArr[0] ?? null;

    // --- Seite laden (Pagination nach unten) ---
    const rows = (await prisma.post.findMany({
      where: {
        authorId: user.id,
        ...(beforeDate ? { createdAt: { lt: beforeDate } } : {}),
        ...(pinned?.id ? { id: { not: pinned.id } } : {}), // gepinnten aus Liste ausschließen
      },
      orderBy: { createdAt: 'desc' },
      include: commonInclude,
      take: limit + 1, // +1 um "hasMore" zu bestimmen
    })) as PostWithRels[];

    const hasMore = rows.length > limit;
    const pageRows: PostWithRels[] = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? pageRows[pageRows.length - 1]!.createdAt.toISOString() : null;

    const mapPost = (p: PostWithRels) => {
      const isRepost = !!p.repostOf;
      const isQuote = !!p.quoteOf;
      return {
        id: p.id,
        text: p.text ?? null,
        mediaUrl: p.mediaUrl ?? null,
        mediaAlt: p.mediaAlt ?? null,
        uploaded: mapUploaded(p.uploaded),
        createdAt: p.createdAt.toISOString(),
        _count: {
          Like: p._count.Like ?? 0,
          Comment: p._count.Comment ?? 0,
          reposts: p._count.reposts ?? 0,
        },
        author: {
          id: p.author.id,
          handle: p.author.handle,
          displayName: p.author.displayName,
          role: (p.author.role as Role) ?? null,
          avatarUrl: p.author.avatarUrl,
        },
        repostOf: isRepost
          ? {
              id: p.repostOf!.id,
              text: p.repostOf!.text ?? null,
              mediaUrl: p.repostOf!.mediaUrl ?? null,
              mediaAlt: p.repostOf!.mediaAlt ?? null,
              uploaded: mapUploaded(p.repostOf!.uploaded),
              createdAt: p.repostOf!.createdAt.toISOString(),
              author: {
                id: p.repostOf!.author.id,
                handle: p.repostOf!.author.handle,
                displayName: p.repostOf!.author.displayName,
                role: (p.repostOf!.author.role as Role) ?? null,
                avatarUrl: p.repostOf!.author.avatarUrl,
              },
            }
          : null,
        quoteOf: isQuote
          ? {
              id: p.quoteOf!.id,
              text: p.quoteOf!.text ?? null,
              mediaUrl: p.quoteOf!.mediaUrl ?? null,
              mediaAlt: p.quoteOf!.mediaAlt ?? null,
              uploaded: mapUploaded(p.quoteOf!.uploaded),
              createdAt: p.quoteOf!.createdAt.toISOString(),
              author: {
                id: p.quoteOf!.author.id,
                handle: p.quoteOf!.author.handle,
                displayName: p.quoteOf!.author.displayName,
                role: (p.quoteOf!.author.role as Role) ?? null,
                avatarUrl: p.quoteOf!.author.avatarUrl,
              },
            }
          : null,
        viewer: {
          liked: false,
          bookmarked: false,
          hasBlockedAuthor: false,
          blockedByAuthor: false,
        },
        community: null,
      };
    };

    // pinned (falls vorhanden) voranstellen, mit Flag
    const posts = [
      ...(pinned ? [{ ...mapPost(pinned), isPinned: true }] : []),
      ...pageRows.map((p) => ({ ...mapPost(p), isPinned: false })),
    ];

    return NextResponse.json({ ok: true, posts, hasMore, nextCursor });
  } catch (err) {
    console.error('GET /api/user/[handle]/posts failed:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load posts' }, { status: 500 });
  }
}
