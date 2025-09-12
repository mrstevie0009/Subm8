// src/lib/adminFilter.ts
import type { Prisma } from '@prisma/client';

const ADMIN_EMAIL  = (process.env.ADMIN_EMAIL  || '').toLowerCase();
const ADMIN_HANDLE = (process.env.ADMIN_HANDLE || '').toLowerCase();

/**
 * Liefert eine Liste von User-Where-Conditions, die den Admin matchen.
 * Diese Liste kannst du in "NOT: [...]" stecken.
 */
export function adminNotUserWheres(): Prisma.UserWhereInput[] {
  const nots: Prisma.UserWhereInput[] = [{ isAdmin: true }]; // alle Admin-Accounts
  if (ADMIN_HANDLE) nots.push({ handle: { equals: ADMIN_HANDLE, mode: 'insensitive' } });
  if (ADMIN_EMAIL)  nots.push({ email:  { equals: ADMIN_EMAIL,  mode: 'insensitive' } });
  return nots;
}

/** Kombiniert ein beliebiges User-Where mit einem Admin-Ausschluss. */
export function excludeAdminFromUsers(
  base: Prisma.UserWhereInput = {}
): Prisma.UserWhereInput {
  const nots = adminNotUserWheres();
  return nots.length ? { AND: [base, { NOT: nots }] } : base;
}

/** Für Post-Queries: Autor darf nicht Admin sein. */
export function excludeAdminAuthor(
  base: Prisma.UserWhereInput = {}
): Prisma.UserWhereInput {
  const nots = adminNotUserWheres();
  return nots.length ? { AND: [base, { NOT: nots }] } : base;
}
