// src/lib/activeUserCookie.ts
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';

export const ACTIVE_COOKIE_NAME = 'active_user_id';
const ALG = 'HS256';
const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'devsecret');

/**
 * Erzeugt (signiert) den Cookie-Wert für eine aktive User-ID.
 * Das eigentliche Setzen des Cookies passiert in der Route via `res.cookies.set(...)`.
 */
export async function buildActiveUserCookieValue(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  return await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: ALG })
    .setExpirationTime('7d')
    .sign(secret);
}

/**
 * Liest (serverseitig) die aktive User-ID aus dem Cookie und verifiziert sie.
 * Praktisch für Serverfunktionen wie getCurrentUser().
 */
export async function readActiveUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(ACTIVE_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    const uid = typeof payload.uid === 'string' ? payload.uid : null;
    return uid ?? null;
  } catch {
    return null;
  }
}
