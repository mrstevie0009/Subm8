// src/lib/auth.ts
import type {NextAuthOptions} from 'next-auth';
import {PrismaAdapter} from '@next-auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import {prisma} from '@/lib/prisma';
import {verifyPassword} from '@/lib/password';
import type {JWT} from 'next-auth/jwt';
import type {Session} from 'next-auth';
import {getServerSession} from 'next-auth';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {strategy: 'jwt'},

  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),

    CredentialsProvider({
      name: 'E-Mail & Passwort',
      credentials: {
        email: {label: 'E-Mail', type: 'email'},
        password: {label: 'Passwort', type: 'password'},
      },
      authorize: (async (credentials: Record<'email' | 'password', string> | undefined) => {
        const email = (credentials?.email || '').trim().toLowerCase();
        const password = (credentials?.password || '').toString();
        if (!email || !password) return null;

        // inkl. handle & role selektieren
        const user = await prisma.user.findUnique({
          where: {email},
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

        // Extra-Felder (handle/role) dürfen im returned user vorhanden sein
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.displayName,
          image: user.avatarUrl ?? undefined,
          handle: user.handle,
          role: user.role,
        } as any;
      }) as any,
    }) as any,
  ],

  pages: {signIn: '/signin'},

  callbacks: {
    // Schreibe id/handle/role in den JWT
    async jwt({token, user}: {token: JWT; user?: any}) {
      if (user) {
        token.uid = user.id as string;
        if (user.handle) token.handle = user.handle as string;
        if (user.role) token.role = user.role as any;
      }

      // Falls wir noch keinen handle/role im Token haben (z. B. nach Google-Login): aus DB nachladen
      if ((!token.handle || !token.role) && token.uid) {
        const dbUser = await prisma.user.findUnique({
          where: {id: token.uid as string},
          select: {handle: true, role: true, displayName: true, avatarUrl: true, email: true},
        });
        if (dbUser) {
          token.handle = dbUser.handle ?? token.handle;
          token.role = (dbUser.role as any) ?? token.role;
          // optional Name/Bild refreshen
          if (dbUser.displayName) token.name = dbUser.displayName;
          if (dbUser.avatarUrl) token.picture = dbUser.avatarUrl;
          if (dbUser.email) token.email = dbUser.email;
        }
      }

      return token;
    },

    // Und aus dem JWT in die Session schieben → Client & Server können darauf zugreifen
    async session({session, token}: {session: Session; token: JWT}) {
      if (!session.user) (session as any).user = {};
      if (token?.uid) (session.user as any).id = token.uid as string;
      if (token?.handle) (session.user as any).handle = token.handle as string;
      if (token?.role) (session.user as any).role = token.role as any;
      // optional konsistent halten:
      if (token?.name) session.user.name = token.name as string;
      if (token?.picture) session.user.image = token.picture as string;
      if (token?.email) session.user.email = token.email as string;
      return session;
    },
  },
};

// Helper für Server Components/Actions
export const getAuth = () => getServerSession(authOptions);
