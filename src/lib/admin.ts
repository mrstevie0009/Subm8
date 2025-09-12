//src/lib/admin.ts
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/currentUser';

export type AdminIdentity = { id: string; handle: string; email: string | null };

/**
 * Prüft anhand der ENV-Variablen, ob der aktuelle User Admin ist.
 * Erlaubt sind (beliebig kombinierbar):
 *   ADMIN_EMAIL     – E-Mail (case-insensitive)
 *   ADMIN_HANDLE    – Handle (case-insensitive)
 */
export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  const me = await getCurrentUser().catch(() => null);
  if (!me) return null;

  const dbUser = await prisma.user.findUnique({
    where: { id: me.id },
    select: { id: true, handle: true, email: true },
  });

  if (!dbUser) return null;

  const { ADMIN_USER_ID, ADMIN_EMAIL, ADMIN_HANDLE } = process.env;

  const ok =
    (!!ADMIN_USER_ID && dbUser.id === ADMIN_USER_ID) ||
    (!!ADMIN_EMAIL && dbUser.email && dbUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) ||
    (!!ADMIN_HANDLE && dbUser.handle.toLowerCase() === ADMIN_HANDLE.toLowerCase());

  return ok ? dbUser : null;
}

export async function assertAdmin(): Promise<AdminIdentity> {
  const admin = await getAdminIdentity();
  if (!admin) {
    // Absicherung auch in Server Actions
    throw new Error('FORBIDDEN');
  }
  return admin;
}
