// src/app/api/communities/preview/[slug]/route.ts
import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type CommunityPreview = {
  slug: string;
  name: string;
  bannerUrl: string | null;
  description: string | null;
  memberCount: number;
  // Community has no avatar in schema; keep nullable for UI placeholder
  avatarUrl: string | null;
};

type ApiResponse =
  | { ok: true; community: CommunityPreview }
  | { ok: false; error: string };

type Params = { slug: string };
type Ctx = { params: Promise<Params> };

export async function GET(_req: Request, { params }: Ctx) {
  const { slug } = await params;

  try {
    const community = await prisma.community.findUnique({
      where: { slug },
      select: {
        slug: true,
        name: true,
        bannerUrl: true,
        description: true,
        _count: { select: { CommunityMember: true } },
      },
    });

    if (!community) {
      return NextResponse.json<ApiResponse>(
        { ok: false, error: 'Not found' },
        { status: 404 }
      );
    }

    const payload: CommunityPreview = {
      slug: community.slug,
      name: community.name,
      bannerUrl: community.bannerUrl ?? null,
      description: community.description ?? null,
      memberCount: community._count.CommunityMember,
      // Not in schema -> let the client show a placeholder
      avatarUrl: null,
    };

    return NextResponse.json<ApiResponse>({ ok: true, community: payload }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal error';
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
