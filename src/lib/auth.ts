// src/lib/auth.ts
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

const SITE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
const PENDING_SIGNUP_COOKIE = 'subm8_pending_signup';

// ✅ NEU: Cookie für OAuth-Pending
const OAUTH_PENDING_COOKIE = 'subm8_oauth_pending';

declare module 'next-auth' {
  interface User {
    handle: string;
    role: Role;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id: string;
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
    const email = (data.email ?? null) as string | null;

      // ✅ NEU: Check ob User schon existiert (via Email)
      if (email) {
        const existing = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: { 
            id: true, 
            handle: true, 
            role: true, 
            displayName: true, 
            avatarUrl: true,
            ageVerified: true,
          },
        });

        if (existing) {
          // User existiert bereits → return AdapterUser
          return {
            id: existing.id,
            name: existing.displayName,
            email: email,
            emailVerified: new Date(),
            image: existing.avatarUrl ?? null,
            handle: existing.handle,
            role: existing.role,
          } as unknown as AdapterUser;
        }
      }

      // ✅ WICHTIG: User existiert NICHT → NICHT erstellen, sondern Error werfen
      // Damit wird der OAuth-Flow abgebrochen und wir können zum Signup leiten
      throw new Error('OAUTH_USER_NOT_FOUND');
    },
  };
}

export const authOptions: NextAuthOptions = {
  adapter: augmentedPrismaAdapter(),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },

  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-next-auth.session-token'
          : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax' as const,
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },

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

        const block = await isBlocked(ip, rawInput);
        console.log('auth.authorize: isBlocked', { ip, rawInput, block });
        if (!block.ok) {
          return null;
        }

        const emailLike = rawInput.toLowerCase();
        const handleLike = rawInput.replace(/^@/, '').toLowerCase();

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: emailLike }, { handle: { equals: handleLike, mode: 'insensitive' } }],
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            passwordHash: true,
            handle: true,
            role: true,
            isDeactivated: true,
            ageVerified: true,
            emailVerifiedAt: true,
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
          throw new Error('ACCOUNT_DEACTIVATED');
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          try {
            void recordFailure(ip, rawInput);
            console.log('auth.authorize: queued recordFailure (bad password)', { ip, rawInput });
          } catch (err) {
            console.error('auth.authorize: recordFailure error (bad password)', { err, ip, rawInput });
          }
          return null;
        }

        try {
          void recordSuccess(ip, rawInput);
          console.log('auth.authorize: queued recordSuccess', { ip, rawInput, userId: user.id });
        } catch (err) {
          console.error('auth.authorize: recordSuccess error', { err, ip, rawInput });
        }

        if (!user.emailVerifiedAt) {
          throw new Error('EMAIL_NOT_VERIFIED');
        }

        const authUser: NextAuthUser = {
          id: user.id,
          email: user.email ?? null,
          name: user.displayName ?? null,
          image: user.avatarUrl ?? null,
          handle: user.handle,
          role: user.role,
          ageVerified: user.ageVerified ?? false,
        };
        return authUser;
      }
    }),
  ],

  pages: { signIn: '/signin-bridge' },

  callbacks: {
    // ✅ NEU: signIn Callback für OAuth-User-Check
    async signIn({ user, account }) {
      // Nur für OAuth-Provider
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        // Check ob User existiert
        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        // User existiert → normal einloggen
        if (existing) {
          return true;
        }

        // User existiert NICHT → Cookie setzen & zu Signup leiten
        const c = await cookies();
        c.set(OAUTH_PENDING_COOKIE, email, {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 600, // 10 Minuten
        });

        // NextAuth wird zum error-Parameter redirecten
        return `/signup?error=OAuthAccountNotLinked`;
      }

      return true;
    },

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

        const u = user as NextAuthUser;

        if (u.handle || u.role || typeof u.ageVerified !== 'undefined') {
          token.handle = u.handle ?? token.handle;
          token.role = u.role ?? token.role;
          token.name = typeof u.name !== 'undefined' ? u.name : token.name ?? null;
          token.picture = typeof u.image !== 'undefined' ? u.image : token.picture ?? null;
          token.email = typeof u.email !== 'undefined' ? u.email : token.email ?? null;
          token.ageVerified = typeof u.ageVerified !== 'undefined' ? u.ageVerified : token.ageVerified;
        } else {
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

      if (
        token.uid &&
        (
          !token.handle ||
          !token.role ||
          typeof token.ageVerified === 'undefined' ||
          token.ageVerified === false
        )
      ) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid },
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

      if (typeof token.ageVerified !== 'undefined') {
        session.user.ageVerified = token.ageVerified ?? false;
      }

      return session;
    },
  },

  events: {
    async createUser(message) {
      const c = await cookies();
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
        // still ok
      }
    },
  },
};

export const getAuth = () => getServerSession(authOptions);
export const auth = getAuth;