// src/app/api/profile/preview/[handle]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { handle: string };

// Hinweis: In Next 15 ist params asynchron → Promise abwarten.
export async function GET(_req: Request, ctx: { params: Promise<Params> }) {
  const { handle } = await ctx.params;

  const safeHandle = (() => {
    try {
      return decodeURIComponent(handle);
    } catch {
      return handle;
    }
  })();

  const user = await prisma.user.findUnique({
    where: { handle: safeHandle.toLowerCase() },
    select: {
      handle: true,
      displayName: true,
      avatarUrl: true,
      bannerUrl: true,
      websiteUrl: true, // ⇐ NEU
    },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: 'NOT_FOUND' }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    profile: {
      handle: user.handle,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bannerUrl: user.bannerUrl ?? null,
      websiteUrl: user.websiteUrl ?? null, // ⇐ NEU
    },
  });
}
