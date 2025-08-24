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

// --- Module Augmentation: eigene Felder in User, Session & JWT typisieren ---
declare module 'next-auth' {
  interface User {
    handle: string;
    role: Role;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id: string;
  }
  interface Session {
    user: {
      id: string;
      handle?: string;
      role?: Role;
      name?: string | null;
      email?: string | null;
      image?: string | null;
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
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),

    // Login mit E-Mail ODER Handle
    CredentialsProvider({
      name: 'Handle/E-Mail & Passwort',
      credentials: {
        identifier: { label: 'E-Mail oder Handle', type: 'text' },
        password: { label: 'Passwort', type: 'password' },
      },
      async authorize(credentials): Promise<NextAuthUser | null> {
        if (!credentials) return null;

        const raw = (credentials.identifier ?? '').trim();
        const password = String(credentials.password ?? '');
        if (!raw || !password) return null;

        const emailLike = raw.toLowerCase();
        const handle = raw.replace(/^@/, '').toLowerCase();

        // User per E-Mail ODER Handle finden (Handle case-insensitive)
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: emailLike },
              { handle: { equals: handle, mode: 'insensitive' } },
            ],
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            passwordHash: true,
            handle: true,
            role: true,
          },
        });
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        // Wichtig: handle & role MIT zurückgeben (Projekt-Erweiterung von User)
        const authUser: NextAuthUser = {
          id: user.id,
          email: user.email ?? null,
          name: user.displayName ?? null,
          image: user.avatarUrl ?? null,
          handle: user.handle,
          role: user.role,
        };
        return authUser;
      },
    }),
  ],

  // Falls du eine feste (nicht-lokalisierte) Signin-Seite verwendest
  pages: { signIn: '/signin' },

  callbacks: {
    async jwt({
      token,
      user,
    }: {
      token: JWT;
      user?: NextAuthUser | undefined;
    }) {
      // Bei Login: Basisdaten setzen
      if (user) {
        token.uid = user.id;
        if (user.handle) token.handle = user.handle;
        if (user.role) token.role = user.role;
        if (typeof user.name !== 'undefined') token.name = user.name ?? null;
        if (typeof user.image !== 'undefined') token.picture = user.image ?? null;
        if (typeof user.email !== 'undefined') token.email = user.email ?? null;
      }

      // handle/role bei Bedarf aus DB nachladen (z. B. Social Login)
      if (token.uid && (!token.handle || !token.role)) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.uid },
          select: {
            handle: true,
            role: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        });
        if (dbUser) {
          token.handle = dbUser.handle ?? token.handle;
          token.role = dbUser.role ?? token.role;
          token.name = dbUser.displayName ?? token.name ?? null;
          token.picture = dbUser.avatarUrl ?? token.picture ?? null;
          token.email = dbUser.email ?? token.email ?? null;
        }
      }

      return token;
    },

    async session({
      session,
      token,
    }: {
      session: Session;
      token: JWT;
    }) {
      // Session-User sicherstellen
      if (!session.user) {
        session.user = { id: token.uid ?? '' };
      }

      if (token.uid) session.user.id = token.uid;
      if (token.handle) session.user.handle = token.handle;
      if (token.role) session.user.role = token.role;

      if (typeof token.name !== 'undefined') session.user.name = token.name;
      if (typeof token.picture !== 'undefined') session.user.image = token.picture;
      if (typeof token.email !== 'undefined') session.user.email = token.email;

      return session;
    },
  },
};

// Helper für Server Components/Actions
export const getAuth = () => getServerSession(authOptions);
