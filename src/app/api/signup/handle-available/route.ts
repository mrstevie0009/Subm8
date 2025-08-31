// src/app/api/signup/handle-available/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = (searchParams.get('handle') || '').toLowerCase();
  if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
    return NextResponse.json({ available: false }, { status: 200 });
  }
  const exists = await prisma.user.findUnique({
    where: { handle },
    select: { id: true },
  });
  return NextResponse.json({ available: !exists }, { status: 200 });
}
