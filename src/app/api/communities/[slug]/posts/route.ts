// src/app/api/communities/[slug]/posts/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuth } from '@/lib/auth';

export const runtime = 'nodejs';

type Params = { slug: string };

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const session = await getAuth();
    const userId = session?.user?.id;
    if (!userId) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 });

    const slug = params.slug.toLowerCase();
    const community = await prisma.community.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!community) return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });

    // posten nur für Mitglieder
    const member = await prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
      select: { communityId: true },
    });
    if (!member) return NextResponse.json({ ok: false, error: 'NOT_MEMBER' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const text = (body?.text || '').toString().trim();
    const nsfw = Boolean(body?.nsfw);

    if (text.length < 1 || text.length > 4000) {
      return NextResponse.json({ ok: false, error: 'INVALID_TEXT' }, { status: 400 });
    }

    const created = await prisma.post.create({
      data: {
        authorId: userId,
        communityId: community.id,
        text,
        nsfw,
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, id: created.id });
  } catch {
    return NextResponse.json({ ok: false, error: 'FAILED' }, { status: 500 });
  }
}
