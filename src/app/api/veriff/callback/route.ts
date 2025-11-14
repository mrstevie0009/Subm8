// src/app/api/veriff/callback/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const FAKE_MODE = process.env.VERIFF_FAKE_MODE === 'true';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const back = searchParams.get('back') ?? '/';
  const locale = (searchParams.get('locale') ?? 'en').toLowerCase();

  // Wenn Fake-Mode aus ist → geh einfach auf die echte Verify-Complete-Page
  if (!FAKE_MODE) {
    const target = `/${locale}/verify/complete?back=${encodeURIComponent(back)}`;
    return NextResponse.redirect(new URL(target, req.url));
  }

  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    const signinUrl = `/${locale}/signin?callbackUrl=${encodeURIComponent(back)}`;
    return NextResponse.redirect(new URL(signinUrl, req.url));
  }

  const verifiedAt = new Date();

  try {
    // Haupt-User verifizieren
    await prisma.user.update({
      where: { id: userId },
      data: {
        ageVerified: true,
        verifiedAt,
      },
    });

    // Kinder-Accounts (inherit verify) ebenso
    await prisma.user.updateMany({
      where: { verifiedByUserId: userId },
      data: {
        ageVerified: true,
        verifiedAt,
      },
    });

    console.log('🔧 VERIFF_FAKE_MODE: user marked ageVerified', { userId });
  } catch (e) {
    console.error('❌ Fake verify failed to update DB:', e);
  }

  // Zurück zur ursprünglichen Seite
  const target = back.startsWith('/') ? back : `/${locale}`;
  return NextResponse.redirect(new URL(target, req.url));
}
