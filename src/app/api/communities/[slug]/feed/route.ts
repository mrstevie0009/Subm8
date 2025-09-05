import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const { searchParams } = new URL(_req.url);
  const sinceISO = searchParams.get('since');
  const onlyCount = searchParams.get('onlyCount') === '1';
  const slug = params.slug.toLowerCase();

  const community = await prisma.community.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!community) return NextResponse.json({ posts: [], count: 0 });

  const sinceDate = sinceISO ? new Date(sinceISO) : new Date(0);
  if (Number.isNaN(sinceDate.getTime())) return NextResponse.json({ posts: [], count: 0 });

  if (onlyCount) {
    const count = await prisma.post.count({
      where: { communityId: community.id, createdAt: { gt: sinceDate } },
    });
    return NextResponse.json({ count });
  }

  const posts = await prisma.post.findMany({
    where: { communityId: community.id, createdAt: { gt: sinceDate } },
    orderBy: { createdAt: 'desc' },
    include: {
      author: {
        select: {
          displayName: true,
          handle: true,
          role: true,
          avatarUrl: true,
        },
      },
      _count: { select: { Like: true, Comment: true } },
    },
    take: 50,
  });

  return NextResponse.json({
    posts: posts.map((p) => ({
      id: p.id,
      text: p.text,
      mediaUrl: p.mediaUrl,
      mediaAlt: p.mediaAlt,
      createdAt: p.createdAt.toISOString(),
      _count: p._count,
      author: {
        displayName: p.author.displayName,
        handle: p.author.handle,
        role: p.author.role,
        avatarUrl: p.author.avatarUrl,
      },
    })),
  });
}
