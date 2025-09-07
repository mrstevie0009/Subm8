// src/app/api/user/[handle]/posts/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { handle: string };

export const dynamic = 'force-dynamic';

function normalizeMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/')) return url;
  if (/^[a-f0-9-]+\.(png|jpe?g|webp|gif)$/i.test(url)) return `/uploads/${url}`;
  if (url.startsWith('uploads/')) return `/${url}`;
  return url;
}

export async function GET(_req: Request, { params }: { params: Params }) {
  try {
    const handle = params.handle.toLowerCase();

    const user = await prisma.user.findFirst({
      where: { handle: { equals: handle, mode: 'insensitive' } },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // Posts dieses Users – inkl. evtl. Reposts/Quotes
    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        text: true,
        mediaUrl: true,
        mediaAlt: true,
        nsfw: true,
        // Autor (Reposter bei Repost)
        author: {
          select: {
            id: true,
            handle: true,
            displayName: true,
            avatarUrl: true,
            role: true,
          },
        },
        // Original bei Repost
        repostOf: {
          select: {
            id: true,
            createdAt: true,
            text: true,
            mediaUrl: true,
            mediaAlt: true,
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
        // Original bei Quote
        quoteOf: {
          select: {
            id: true,
            createdAt: true,
            text: true,
            mediaUrl: true,
            mediaAlt: true,
            author: {
              select: {
                id: true,
                handle: true,
                displayName: true,
                avatarUrl: true,
                role: true,
              },
            },
          },
        },
      },
      take: 50,
    });

    // Härtung + Normalisierung
    const items = posts
      .filter((p) => !!p.author) // zur Sicherheit, sollte bei validen Daten immer true sein
      .map((p) => ({
        id: p.id,
        createdAt: p.createdAt.toISOString(),
        text: p.text,
        mediaUrl: normalizeMediaUrl(p.mediaUrl),
        mediaAlt: p.mediaAlt ?? undefined,
        nsfw: p.nsfw,
        author: {
          id: p.author!.id,
          handle: p.author!.handle,
          displayName: p.author!.displayName,
          avatarUrl: p.author!.avatarUrl ?? undefined,
          role: p.author!.role ?? null,
        },
        repostOf: p.repostOf
          ? {
              id: p.repostOf.id,
              createdAt: p.repostOf.createdAt.toISOString(),
              text: p.repostOf.text,
              mediaUrl: normalizeMediaUrl(p.repostOf.mediaUrl),
              mediaAlt: p.repostOf.mediaAlt ?? undefined,
              author: {
                id: p.repostOf.author.id,
                handle: p.repostOf.author.handle,
                displayName: p.repostOf.author.displayName,
                avatarUrl: p.repostOf.author.avatarUrl ?? undefined,
                role: p.repostOf.author.role ?? null,
              },
            }
          : null,
        quoteOf: p.quoteOf
          ? {
              id: p.quoteOf.id,
              createdAt: p.quoteOf.createdAt.toISOString(),
              text: p.quoteOf.text,
              mediaUrl: normalizeMediaUrl(p.quoteOf.mediaUrl),
              mediaAlt: p.quoteOf.mediaAlt ?? undefined,
              author: {
                id: p.quoteOf.author.id,
                handle: p.quoteOf.author.handle,
                displayName: p.quoteOf.author.displayName,
                avatarUrl: p.quoteOf.author.avatarUrl ?? undefined,
                role: p.quoteOf.author.role ?? null,
              },
            }
          : null,
      }));

    return NextResponse.json({ ok: true, items });
  } catch {
    return NextResponse.json({ ok: false, error: 'Failed to load posts' }, { status: 500 });
  }
}
