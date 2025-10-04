// src/app/api/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getToken } from 'next-auth/jwt';
import { prisma } from '@/lib/prisma';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET!;

export async function GET(req: NextRequest) {
  // 1) Session holen
  const session = await getServerSession(authOptions);

  // 2) User-ID bestimmen (Session oder JWT-Fallback)
  let userId = session?.user?.id ?? null;
  if (!userId) {
    const token = await getToken({ req, secret: NEXTAUTH_SECRET });
    userId = (token?.uid as string | undefined) ?? null;
  }

  // 3) Eingeloggt → ageVerified frisch aus DB lesen (unabhängig vom JWT)
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        ageVerified: true,
        handle: true,
        role: true,
        displayName: true,
        avatarUrl: true,
        email: true,
      },
    });

    return NextResponse.json({
      user: {
        id: userId,
        handle: session?.user?.handle ?? user?.handle ?? null,
        role: session?.user?.role ?? user?.role ?? null,
        name: session?.user?.name ?? user?.displayName ?? null,
        email: session?.user?.email ?? user?.email ?? null,
        image: session?.user?.image ?? user?.avatarUrl ?? null,
        ageVerified: user?.ageVerified ?? false, // <- live aus DB
      },
    });
  }

  // nicht eingeloggt
  return NextResponse.json({});
}
