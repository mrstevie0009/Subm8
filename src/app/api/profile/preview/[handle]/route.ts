// src/app/api/profile/preview/[handle]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = { params: Promise<{ handle: string }> };

export async function GET(_: Request, { params }: Params) {
  const { handle } = await params;
  const safeHandle = (() => {
    try {
      return decodeURIComponent(handle);
    } catch {
      return handle;
    }
  })();

  const user = await prisma.user.findUnique({
    where: { handle: safeHandle },
    select: { handle: true, displayName: true, avatarUrl: true, bannerUrl: true },
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
    },
  });
}
