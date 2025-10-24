// src/app/api/account-links/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { ACTIVE_COOKIE_NAME, buildActiveUserCookieValue } from '@/lib/activeUserCookie';
import { readActiveUserId } from '@/lib/activeUserCookie'; // <-- NEU

export const dynamic = 'force-dynamic';

function json(data: unknown, init: number = 200) {
  return NextResponse.json(data, { status: init });
}

/** GET -> Liste der verknüpften Accounts (inkl. Owner) */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);
  const me = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true },
  });
  const links = await prisma.accountLink.findMany({
    where: { ownerId: session.user.id },
    include: { linked: { select: { id: true, handle: true, displayName: true, avatarUrl: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return json({
    ok: true,
    items: [me, ...links.map((l) => l.linked)],
    canAddMore: links.length < 2, // + Owner = max 3
  });
}

/** POST -> Aktionen */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return json({ ok: false, error: 'UNAUTHENTICATED' }, 401);

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'switch';

  if (action === 'switch') {
    const { userId } = await req.json().catch(() => ({}));
    if (!userId) return json({ ok: false, error: 'Missing userId' }, 400);

    const res = NextResponse.json({ ok: true });

    if (userId === session.user.id) {
      res.cookies.delete(ACTIVE_COOKIE_NAME); // zurück auf Owner
      return res;
    }

    const link = await prisma.accountLink.findFirst({
      where: { ownerId: session.user.id, linkedUserId: userId },
      select: { id: true },
    });
    if (!link) return NextResponse.json({ ok: false, error: 'NOT_LINKED' }, { status: 403 });

    const value = await buildActiveUserCookieValue(userId);
    res.cookies.set(ACTIVE_COOKIE_NAME, value!, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  if (action === 'unlink') {
    const { userId } = await req.json().catch(() => ({}));
    if (!userId) return json({ ok: false, error: 'Missing userId' }, 400);

    await prisma.accountLink.deleteMany({
      where: { ownerId: session.user.id, linkedUserId: userId },
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.delete(ACTIVE_COOKIE_NAME); // falls aktiv → raus
    return res;
  }

  if (action === 'connect-existing') {
    const { identifier, password } = await req.json().catch(() => ({}));
    if (!identifier || !password) return json({ ok: false, error: 'MISSING_CREDENTIALS' }, 400);

    const count = await prisma.accountLink.count({ where: { ownerId: session.user.id } });
    if (count >= 2) return json({ ok: false, error: 'LIMIT_REACHED' }, 409);

    const ident = String(identifier).trim().toLowerCase().replace(/^@/, '');
    const candidate = await prisma.user.findFirst({
      where: { OR: [{ email: ident }, { handle: { equals: ident, mode: 'insensitive' } }] },
      select: { id: true, passwordHash: true },
    });
    if (!candidate?.passwordHash) return json({ ok: false, error: 'INVALID' }, 401);

    const ok = await verifyPassword(password, candidate.passwordHash);
    if (!ok) return json({ ok: false, error: 'INVALID' }, 401);

    if (candidate.id === session.user.id) return NextResponse.json({ ok: true });

    // --- INHERIT VERIFY: Falls Owner verifiziert ist, Kandidaten sofort verifizieren + Herkunft merken
    {
      const owner = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { ageVerified: true, verifiedAt: true, dob: true },
      });

      if (owner?.ageVerified && owner.verifiedAt) {
        await prisma.user.update({
          where: { id: candidate.id },
          data: {
            ageVerified: true,
            verifiedAt: owner.verifiedAt,
            // dob nur setzen, wenn vorhanden. (Ist optional.)
            ...(owner.dob ? { dob: owner.dob } : {}),
            verifiedByUserId: session.user.id, // <- NEU (aus dem Schema)
          },
        });
      }
    }

    await prisma.accountLink.upsert({
      where: { ownerId_linkedUserId: { ownerId: session.user.id, linkedUserId: candidate.id } },
      create: { ownerId: session.user.id, linkedUserId: candidate.id },
      update: {},
    });

    const res = NextResponse.json({ ok: true, switched: true });
    const value = await buildActiveUserCookieValue(candidate.id);
    res.cookies.set(ACTIVE_COOKIE_NAME, value!, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  if (action === 'create-new') {
    const { email, handle, password, role } = await req.json().catch(() => ({}));
    if (!email || !handle || !password || !role) return json({ ok: false, error: 'MISSING' }, 400);

    const count = await prisma.accountLink.count({ where: { ownerId: session.user.id } });
    if (count >= 2) return json({ ok: false, error: 'LIMIT_REACHED' }, 409);

    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: String(email).toLowerCase() }, { handle: String(handle).toLowerCase() }] },
      select: { id: true },
    });
    if (exists) return json({ ok: false, error: 'ALREADY_EXISTS' }, 409);

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        email: String(email).toLowerCase(),
        handle: String(handle).toLowerCase(),
        passwordHash,
        displayName: handle,
        role: role === 'DOMME' ? 'DOMME' : 'SUBMISSIVE',
      },
      select: { id: true },
    });

    await prisma.accountLink.create({
      data: { ownerId: session.user.id, linkedUserId: newUser.id },
    });

    // --- INHERIT VERIFY: Falls Owner verifiziert ist, neuen User sofort verifizieren + Herkunft merken
    {
      const owner = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { ageVerified: true, verifiedAt: true, dob: true },
      });

      if (owner?.ageVerified && owner.verifiedAt) {
        await prisma.user.update({
          where: { id: newUser.id },
          data: {
            ageVerified: true,
            verifiedAt: owner.verifiedAt,
            ...(owner.dob ? { dob: owner.dob } : {}),
            verifiedByUserId: session.user.id, // <- NEU
          },
        });
      }
    }

    const res = NextResponse.json({ ok: true, switched: true });
    const value = await buildActiveUserCookieValue(newUser.id);
    res.cookies.set(ACTIVE_COOKIE_NAME, value!, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  }

  /** NEU: aktiven Account „abmelden“ ohne Session zu zerstören */
  if (action === 'signout-active') {
    const ownerId = session.user.id;
    const activeId = await readActiveUserId(); // kann null sein (Owner ist aktiv)

    // hole alle verknüpften (sortiert)
    const links = await prisma.accountLink.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'asc' },
      select: { linkedUserId: true }
    });

    const res = NextResponse.json({ ok: true, fullSignOut: false });

    // Fall A: aktiver ist verknüpfter User -> unlink ihn, dann zu einem anderen oder Owner wechseln
    if (activeId && activeId !== ownerId) {
      await prisma.accountLink.deleteMany({
        where: { ownerId, linkedUserId: activeId },
      });

      const remaining = links.map(l => l.linkedUserId).filter(id => id !== activeId);
      const nextLinked = remaining[0];

      if (nextLinked) {
        const val = await buildActiveUserCookieValue(nextLinked);
        res.cookies.set(ACTIVE_COOKIE_NAME, val!, {
          httpOnly: true, sameSite: 'lax', path: '/',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7,
        });
      } else {
        // kein weiterer verknüpfter -> zurück zum Owner
        res.cookies.delete(ACTIVE_COOKIE_NAME);
      }
      return res;
    }

    // Fall B: Owner ist aktiv
    if (!activeId || activeId === ownerId) {
      if (links.length > 0) {
        // zu erstem verknüpften wechseln, Session behalten
        const nextLinked = links[0].linkedUserId;
        const val = await buildActiveUserCookieValue(nextLinked);
        res.cookies.set(ACTIVE_COOKIE_NAME, val!, {
          httpOnly: true, sameSite: 'lax', path: '/',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 60 * 60 * 24 * 7,
        });
        return res; // fullSignOut: false
      } else {
        // keine verknüpften -> echtes Logout im Client nötig
        return NextResponse.json({ ok: true, fullSignOut: true });
      }
    }

    return res;
  }

  return json({ ok: false, error: 'UNKNOWN_ACTION' }, 400);
}
