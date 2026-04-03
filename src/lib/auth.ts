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
const OAUTH_PENDING_COOKIE = 'subm8_oauth_pending';
const OAUTH_PENDING_DATA_COOKIE = 'subm8_oauth_pending_data';

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

export async function ensureAvailableHandle(desired: string): Promise<string> {
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
      if (!email) {
        throw new Error('OAUTH_EMAIL_MISSING');
      }

      const normalizedEmail = email.toLowerCase();

      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
        select: {
          id: true,
          handle: true,
          role: true,
          displayName: true,
          avatarUrl: true,
        },
      });

      if (existing) {
        return {
          id: existing.id,
          name: existing.displayName,
          email: normalizedEmail,
          emailVerified: new Date(),
          image: existing.avatarUrl ?? null,
          handle: existing.handle,
          role: existing.role,
        } as unknown as AdapterUser;
      }

      // Dieser Fall sollte mit dem neuen Flow nicht mehr normal auftreten.
      throw new Error('OAUTH_SIGNUP_REQUIRED');
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
      allowDangerousEmailAccountLinking: true,
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
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        const existing = await prisma.user.findUnique({
          where: { email },
          select: { id: true },
        });

        if (existing) {
          return true;
        }

        const c = await cookies();

        const pendingPayload = {
          email,
          provider: 'google',
          providerAccountId: account.providerAccountId,
          name: user.name ?? null,
          image: user.image ?? null,
        };

        c.set(OAUTH_PENDING_COOKIE, email, {
          httpOnly: false,
          sameSite: 'lax',
          path: '/',
          maxAge: 600,
          secure: process.env.NODE_ENV === 'production',
        });

        c.set(
          OAUTH_PENDING_DATA_COOKIE,
          encodeURIComponent(JSON.stringify(pendingPayload)),
          {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 600,
            secure: process.env.NODE_ENV === 'production',
          }
        );

        const locale = c.get('NEXT_LOCALE')?.value || 'en';
        return `/${locale}/signup?error=OAuthAccountNotLinked`;
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

    async jwt({ token, user }: { token: JWT; user?: NextAuthUser }) {
      if (user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            handle: true,
            role: true,
            displayName: true,
            avatarUrl: true,
            email: true,
            ageVerified: true,
          },
        });

        if (dbUser) {
          token.uid = dbUser.id;
          token.handle = dbUser.handle;
          token.role = dbUser.role;
          token.name = dbUser.displayName ?? null;
          token.picture = dbUser.avatarUrl ?? null;
          token.email = dbUser.email ?? null;
          token.ageVerified = dbUser.ageVerified ?? false;
          
          console.log('✅ JWT populated from DB:', { 
            id: dbUser.id, 
            handle: dbUser.handle, 
            role: dbUser.role 
          });
        } else {
          console.error('❌ User not found in DB:', user.id);
        }
      }

      if (token.uid && (!token.handle || !token.role)) {
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
          token.handle = dbUser.handle;
          token.role = dbUser.role;
          token.name = dbUser.displayName ?? token.name ?? null;
          token.picture = dbUser.avatarUrl ?? token.picture ?? null;
          token.email = dbUser.email ?? token.email ?? null;
          token.ageVerified = dbUser.ageVerified ?? token.ageVerified ?? false;
        }
      }

      return token;
    },

    async session({ session, token }: { session: Session; token: JWT }) {
      if (!session.user) {
        session.user = { id: '' };
      }

      session.user.id = token.uid ?? '';
      session.user.handle = token.handle ?? '';
      session.user.role = token.role as Role;
      session.user.name = token.name ?? null;
      session.user.image = token.picture ?? null;
      session.user.email = token.email ?? null;
      session.user.ageVerified = token.ageVerified ?? false;

      return session;
    },
  },
};

export const getAuth = () => getServerSession(authOptions);
export const auth = getAuth;