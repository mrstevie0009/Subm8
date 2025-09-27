//src/lib/currentUser.ts
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import type { Role, User } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { readActiveUserId } from '@/lib/activeUserCookie';

type UserShape = { id: string; handle: string; role: Role };

function isUserShape(u: unknown): u is UserShape {
  if (!u || typeof u !== 'object') return false;
  const o = u as Record<string, unknown>;
  return (
    typeof o.id === 'string' &&
    typeof o.handle === 'string' &&
    typeof o.role === 'string'
  );
}

/**
 * Liefert den aktuell „aktiven“ User:
 * - Wenn ein signiertes active_user_id-Cookie existiert und der verlinkte
 *   Account dem eingeloggten Owner gehört → dieser verlinkte User.
 * - Sonst der normale Session-User.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isUserShape(session.user)) return null;

  const sessionUserId = session.user.id;

  // 1) Aktiven Account aus Cookie versuchen
  const activeId = await readActiveUserId();
  if (activeId && activeId !== sessionUserId) {
    const link = await prisma.accountLink.findFirst({
      where: { ownerId: sessionUserId, linkedUserId: activeId },
      select: { linkedUserId: true },
    });

    if (link) {
      // Cookie ist gültig → aktiven (verlinkten) User zurückgeben
      const active = await prisma.user.findUnique({ where: { id: activeId } });
      if (active) return active;
    }
    // Fallback: Wenn Cookie ungültig → ignorieren und Owner liefern
  }

  // 2) Owner (Session-User)
  const owner = await prisma.user.findUnique({ where: { id: sessionUserId } });
  return owner ?? null;
}
