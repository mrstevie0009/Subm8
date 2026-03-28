import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';
import { guardAndSave, envMaxUploadBytes } from '@/lib/uploadGuard';

export const runtime = 'nodejs';

// Rate-Limit: max 10 Posts pro Minute pro User
const postHits = new Map<string, number[]>();
const POST_RATE_WINDOW_MS = 60_000;
const POST_RATE_MAX = 10;

function isPostRateLimited(userId: string): boolean {
  const now = Date.now();
  const hits = (postHits.get(userId) ?? []).filter((t) => now - t < POST_RATE_WINDOW_MS);
  hits.push(now);
  postHits.set(userId, hits);
  if (Math.random() < 0.05) {
    for (const [k, v] of postHits) {
      if (v.every((t) => now - t > POST_RATE_WINDOW_MS)) postHits.delete(k);
    }
  }
  return hits.length > POST_RATE_MAX;
}

// GIF-Host-Allowlist
const ALLOWED_GIF_HOSTS = [
  'media.giphy.com',
  'i.giphy.com',
  'media.tenor.com',
  'c.tenor.com',
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const session = await getAuth();
    const userId = session?.user?.id;
    if (!userId) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const community = await prisma.community.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true },
    });
    if (!community) {
      return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
    }

    const member = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
      select: { communityId: true },
    });
    if (!member) {
      return NextResponse.json({ ok: false, error: 'NOT_MEMBER' }, { status: 403 });
    }

    // Rate-Limit nach Member-Check
    if (isPostRateLimited(userId)) {
      return NextResponse.json({ ok: false, error: 'RATE_LIMITED' }, { status: 429 });
    }

    const ct = req.headers.get('content-type') || '';
    let text = '';
    let mediaUrl: string | null = null;
    let mediaAlt: string | null = null;

    if (ct.startsWith('multipart/form-data')) {
      const fd = await req.formData();
      text = (fd.get('text') ?? '').toString().trim();

      const media = fd.get('media');
      const gifUrl = (fd.get('gifUrl') ?? '').toString().trim();

      if (media && media instanceof File && media.size > 0) {
        const saved = await guardAndSave(media, {
          publicSubdir: 'post-media',
          maxSize: envMaxUploadBytes(100),
        });
        if (!saved.ok) {
          return NextResponse.json({ ok: false, error: saved.message }, { status: 400 });
        }
        mediaUrl = saved.publicPath;
      } else if (gifUrl) {
        //GIF-Host-Allowlist statt nur Regex
        try {
          const u = new URL(gifUrl);
          if (!ALLOWED_GIF_HOSTS.includes(u.hostname)) {
            return NextResponse.json({ ok: false, error: 'INVALID_GIF_HOST' }, { status: 400 });
          }
          mediaUrl = gifUrl;
        } catch {
          return NextResponse.json({ ok: false, error: 'INVALID_GIF_URL' }, { status: 400 });
        }
      }
    } else {
      const body = (await req.json().catch(() => ({}))) as {
        text?: string;
        nsfw?: boolean;
        mediaUrl?: string;
        mediaAlt?: string;
      };
      text = (body?.text || '').toString().trim();
      mediaUrl = body?.mediaUrl ? body.mediaUrl.toString() : null;
      mediaAlt = body?.mediaAlt ? body.mediaAlt.toString() : null;
    }

    if (text.length < 1 && !mediaUrl) {
      return NextResponse.json({ ok: false, error: 'EMPTY_POST' }, { status: 400 });
    }
    if (text.length > 4000) {
      return NextResponse.json({ ok: false, error: 'INVALID_TEXT' }, { status: 400 });
    }

    const created = await prisma.post.create({
      data: {
        authorId: userId,
        communityId: community.id,
        text,
        nsfw: true,
        mediaUrl,
        mediaAlt,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}