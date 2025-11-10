//src/lib/auth.ts
import type { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/password';
import type { JWT } from 'next-auth/jwt';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import type { Role } from '@prisma/client';
import type { Adapter, AdapterUser } from 'next-auth/adapters';
import { cookies } from 'next/headers';
import { getClientIp } from '@/lib/ip';
import { isBlocked, recordFailure, recordSuccess } from '@/lib/bruteforce';

// ---- Base URL (lokal, bis Domain live ist)
const SITE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';

// Cookie-Key für Signup-Flow
const PENDING_SIGNUP_COOKIE = 'subm8_pending_signup';

// --- Module Augmentation ---
declare module 'next-auth' {
  interface User {
    handle: string;
    role: Role;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id: string;
    /** ⇨ hinzugefügt: Altersstatus in der DB */
    ageVerified?: boolean | null;
  }
  interface Session {
    user: {
      id: string;
      handle?: string;
      role?: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** ⇨ hinzugefügt: Altersstatus in der Session */
      ageVerified?: boolean | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    handle?: string;
    role?: Role;
    name?: string | null;
    email?: string | null;
    picture?: string | null;
    /** ⇨ hinzugefügt: Altersstatus im Token */
    ageVerified?: boolean | null;
  }
}

async function generateUniqueHandle(base = 'user'): Promise<string> {
  const rand = () => Math.random().toString(36).slice(2, 8);
  for (let i = 0; i < 10; i++) {
    const candidate = `${base}_${rand()}`.toLowerCase();
    const exists = await prisma.user.findUnique({
      where: { handle: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  return `${base}_${Date.now().toString(36)}`.toLowerCase();
}

async function ensureAvailableHandle(desired: string): Promise<string> {
  const clean = desired.toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  if (!clean || !/^[a-z0-9_]{3,20}$/.test(clean)) {
    return generateUniqueHandle('user');
  }
  const taken = await prisma.user.findUnique({ where: { handle: clean }, select: { id: true } });
  if (!taken) return clean;

  for (let i = 0; i < 12; i++) {
    const suffix = Math.random().toString(36).slice(2, 5);
    const cand = `${clean}_${suffix}`.slice(0, 20);
    const exists = await prisma.user.findUnique({ where: { handle: cand }, select: { id: true } });
    if (!exists) return cand;
  }
  return generateUniqueHandle(clean);
}

function augmentedPrismaAdapter(): Adapter {
  const base = PrismaAdapter(prisma);
  return {
    ...base,
    async createUser(data: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
      const name = (data.name ?? '') as string;
      const email = (data.email ?? null) as string | null;
      const image = (data.image ?? null) as string | null;

      const displayName = name || (email ? email.split('@')[0] : '') || 'User';
      const handle = await generateUniqueHandle('user');
      const role: Role = 'SUBMISSIVE';

      const created = await prisma.user.create({
        data: {
          email,
          displayName,
          avatarUrl: image,
          handle,
          role,
        },
      });

      // AdapterUser – inkl. augmentierter Felder (handle/role)
      const adapterUser: AdapterUser = {
        id: created.id,
        name: created.displayName,
        email: created.email ?? '',
        emailVerified: null,
        image: created.avatarUrl ?? null,
        // ts-expect-error: augmentierte Felder
        handle: created.handle,
        // ts-expect-error: augmentierte Felder
        role: created.role,
      } as unknown as AdapterUser;

      return adapterUser;
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: augmentedPrismaAdapter(),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    CredentialsProvider({
      name: 'Handle/E-Mail & Passwort',
      credentials: {
        identifier: { label: 'E-Mail oder Handle', type: 'text' },
        email: { label: 'E-Mail', type: 'text' },
        handle: { label: 'Handle', type: 'text' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials) return null;

        const rawInput =
          (credentials.identifier as string | undefined)?.trim() ||
          (credentials.email as string | undefined)?.trim() ||
          (credentials.handle as string | undefined)?.trim() || '';
        const password = String(credentials.password ?? '');

        if (!rawInput || !password) return null;

        const ip = await getClientIp();

          // 1) Vorab: Block prüfen (ohne Throw, einfach early-return)
        const block = await isBlocked(ip, rawInput);
        console.log('auth.authorize: isBlocked', { ip, rawInput, block });
        if (!block.ok) {
          // KEIN throw – gib null zurück.
          // Die UI ruft danach /api/auth/brute-status auf und zeigt die richtige Meldung.
          return null;
        }

        // 2) User lookup wie gehabt
        const emailLike = rawInput.toLowerCase();
        const handleLike = rawInput.replace(/^@/, '').toLowerCase();

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: emailLike }, { handle: { equals: handleLike, mode: 'insensitive' } }],
          },
          select: {
            id: true, email: true, displayName: true, avatarUrl: true,
            passwordHash: true, handle: true, role: true, isDeactivated: true, ageVerified: true,
          },
        });

        if (!user || !user.passwordHash) {
          try {
            void recordFailure(ip, rawInput);
            console.log('auth.authorize: queued recordFailure (no user)', { ip, rawInput });
          } catch (err) {
            console.error('auth.authorize: recordFailure error (no user)', { err, ip, rawInput });
          }
          return null;
        }
        if (user.isDeactivated) {
          // gesperrte Accounts nicht in Throttle zählen (optional)
          throw new Error('ACCOUNT_DEACTIVATED');
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          try {
            // Fire-and-forget: don't delay authorize response on DB write
            void recordFailure(ip, rawInput);
            console.log('auth.authorize: queued recordFailure (bad password)', { ip, rawInput });
          } catch (err) {
            console.error('auth.authorize: recordFailure error (bad password)', { err, ip, rawInput });
          }
          return null;
        }

        // 3) Erfolg → Reset Throttle (fire-and-forget)
        try {
          void recordSuccess(ip, rawInput);
          console.log('auth.authorize: queued recordSuccess', { ip, rawInput, userId: user.id });
        } catch (err) {
          console.error('auth.authorize: recordSuccess error', { err, ip, rawInput });
        }

        // include ageVerified so callers / jwt callback can avoid another DB hit
        const authUser: NextAuthUser = {
        id: user.id,
        email: user.email ?? null,
        name: user.displayName ?? null,
        image: user.avatarUrl ?? null,
        handle: user.handle,
        role: user.role,
        ageVerified: user.ageVerified ?? false, // ← sauber typisiert dank Module Augmentation
      };
        return authUser;
      }
    }),
  ],

  // Bridge, damit NextAuth nicht auf /signin ohne Locale leitet
  pages: { signIn: '/signin-bridge' },

  callbacks: {
    async redirect({ url, baseUrl }) {
      const devBase = SITE_URL;
      if (url.startsWith('/')) return `${devBase}${url}`;
      try {
        const u = new URL(url);
        if (u.origin === baseUrl || u.origin === devBase) return url;
      } catch {}
      return devBase;
    },

    async jwt({ token, user }: { token: JWT; user?: NextAuthUser | undefined }) {
      if (user) {
        token.uid = user.id;

        // Dank Module Augmentation hat NextAuthUser diese Felder typisiert:
        const u = user as NextAuthUser;

        if (u.handle || u.role || typeof u.ageVerified !== 'undefined') {
          token.handle = u.handle ?? token.handle;
          token.role = u.role ?? token.role;
          token.name = typeof u.name !== 'undefined' ? u.name : token.name ?? null;
          token.picture = typeof u.image !== 'undefined' ? u.image : token.picture ?? null;
          token.email = typeof u.email !== 'undefined' ? u.email : token.email ?? null;
          token.ageVerified = typeof u.ageVerified !== 'undefined' ? u.ageVerified : token.ageVerified;
        } else {
          // Fallback: nur wenn Felder fehlen, DB lesen
          const dbUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              handle: true,
              role: true,
              displayName: true,
              avatarUrl: true,
              email: true,
              ageVerified: true,
            },
          });
          if (dbUser) {
            token.handle = dbUser.handle;
            token.role = dbUser.role;
            token.name = dbUser.displayName ?? token.name ?? null;
            token.picture = dbUser.avatarUrl ?? token.picture ?? null;
            token.email = dbUser.email ?? token.email ?? null;
            token.ageVerified = dbUser.ageVerified ?? token.ageVerified ?? false;
          }
        }
      }

      if (token.uid && (!token.handle || !token.role || typeof token.ageVerified === 'undefined')) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid },
          select: {
            handle: true,
            role: true,
            displayName: true,
            avatarUrl: true,
            email: true,
            /** ⇨ neu: Altersstatus aus DB */
            ageVerified: true,
          },
        });
        if (dbUser) {
          token.handle = dbUser.handle ?? token.handle;
          token.role = dbUser.role ?? token.role;
          token.name = dbUser.displayName ?? token.name ?? null;
          token.picture = dbUser.avatarUrl ?? token.picture ?? null;
          token.email = dbUser.email ?? token.email ?? null;
          token.ageVerified = dbUser.ageVerified ?? token.ageVerified ?? false;
        }
      }

      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (!session.user) session.user = { id: token.uid ?? '' };

      if (token.uid) session.user.id = token.uid;
      if (token.handle) session.user.handle = token.handle;
      if (token.role) session.user.role = token.role;

      if (typeof token.name !== 'undefined') session.user.name = token.name;
      if (typeof token.picture !== 'undefined') session.user.image = token.picture;
      if (typeof token.email !== 'undefined') session.user.email = token.email;

      /** ⇨ neu: Altersstatus in die Session mappen */
      if (typeof token.ageVerified !== 'undefined') {
        session.user.ageVerified = token.ageVerified ?? false;
      }

      return session;
    },
  },

  events: {
    // Nach erstem OAuth-Create: Wunsch-Handle/Rolle aus Cookie übernehmen
    async createUser(message) {
      const c = await cookies(); // async in deiner Umgebung
      const raw = c.get(PENDING_SIGNUP_COOKIE)?.value;
      if (!raw) return;

      try {
        const decoded = decodeURIComponent(atob(raw));
        const parsed = JSON.parse(decoded) as {
          handle?: string;
          role?: Role | 'DOMME' | 'SUBMISSIVE' | 'domme' | 'sub';
        };

        const desiredHandle = parsed.handle ? String(parsed.handle) : undefined;
        const desiredRole = ((): Role | undefined => {
          const v = parsed.role;
          if (!v) return undefined;
          if (v === 'DOMME' || v === 'SUBMISSIVE') return v;
          const low = String(v).toLowerCase();
          if (low === 'domme') return 'DOMME';
          if (low === 'sub' || low === 'submissive') return 'SUBMISSIVE';
          return undefined;
        })();

        const updates: { handle?: string; role?: Role } = {};
        if (desiredHandle) updates.handle = await ensureAvailableHandle(desiredHandle);
        if (desiredRole) updates.role = desiredRole;

        if (updates.handle || updates.role) {
          await prisma.user.update({
            where: { id: message.user.id },
            data: updates,
          });
        }
      } catch {
        // still ok – Account existiert
      }
      // Cookie bleibt (readonly). Es verfällt automatisch per Max-Age.
    },
  },
};

// Helper für Server Components/Actions
export const getAuth = () => getServerSession(authOptions);
export const auth = getAuth;
