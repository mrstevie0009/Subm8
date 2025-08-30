/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient, Prisma, Role } from '@prisma/client';

const prisma = new PrismaClient();

/** Prüft, ob eine Spalte in public."User" existiert */
async function userHasColumn(column: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'User' AND column_name = ${column}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Legt UserNotificationSettings an (falls nicht vorhanden)
 *  und stellt sicher, dass updatedAt einen DEFAULT + NOT NULL hat.
 */
async function ensureNotificationSettingsTable() {
  // Tabelle (falls fehlt) anlegen
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "UserNotificationSettings" (
      "userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE,
      "pushEnabled" BOOLEAN NOT NULL DEFAULT true,

      "dmMessages" BOOLEAN NOT NULL DEFAULT true,
      "dmReactions" BOOLEAN NOT NULL DEFAULT true,

      "mentions" BOOLEAN NOT NULL DEFAULT true,
      "comments" BOOLEAN NOT NULL DEFAULT true,
      "likes" BOOLEAN NOT NULL DEFAULT true,
      "newFollowers" BOOLEAN NOT NULL DEFAULT true,
      "photoTags" BOOLEAN NOT NULL DEFAULT true,

      "emailMessages" BOOLEAN NOT NULL DEFAULT false,
      "emailDigest"  BOOLEAN NOT NULL DEFAULT false,

      "muteNotFollowing"     BOOLEAN NOT NULL DEFAULT false,
      "muteNotFollowers"     BOOLEAN NOT NULL DEFAULT false,
      "muteNewAccounts"      BOOLEAN NOT NULL DEFAULT false,
      "muteNoAvatar"         BOOLEAN NOT NULL DEFAULT false,
      "requireEmailVerified" BOOLEAN NOT NULL DEFAULT false,
      "requirePhoneVerified" BOOLEAN NOT NULL DEFAULT false,

      "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Falls die Tabelle früher ohne Default/NotNull existierte: nachziehen (idempotent)
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'UserNotificationSettings'
          AND column_name = 'updatedAt'
      ) THEN
        EXECUTE 'ALTER TABLE "UserNotificationSettings"
                 ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP';
        EXECUTE 'ALTER TABLE "UserNotificationSettings"
                 ALTER COLUMN "updatedAt" SET NOT NULL';
      END IF;
    END
    $$;
  `);
}

/** Schreibt Default-Settings für einen User (idempotent & NOT NULL-safe) */
async function upsertNotifDefaults(userId: string) {
  await ensureNotificationSettingsTable();

  await prisma.$executeRaw/*
    POSTGRES
  */`
    INSERT INTO "UserNotificationSettings" (
      "userId",
      "pushEnabled",
      "dmMessages", "dmReactions",
      "mentions", "comments", "likes", "newFollowers", "photoTags",
      "emailMessages", "emailDigest",
      "muteNotFollowing", "muteNotFollowers", "muteNewAccounts", "muteNoAvatar",
      "requireEmailVerified", "requirePhoneVerified",
      "createdAt", "updatedAt"
    )
    VALUES (
      ${userId},
      TRUE,
      TRUE, TRUE,
      TRUE, TRUE, TRUE, TRUE, TRUE,
      FALSE, FALSE,
      FALSE, FALSE, FALSE, FALSE,
      FALSE, FALSE,
      NOW(), NOW()
    )
    ON CONFLICT ("userId") DO UPDATE SET
      "updatedAt" = NOW();
  `;
}

async function main() {
  // Welche Spalten gibt es wirklich?
  const [hasIsAdmin, hasPhone, hasCountry, hasIsDeactivated, hasPasswordHash] = await Promise.all([
    userHasColumn('isAdmin'),
    userHasColumn('phone'),
    userHasColumn('country'),
    userHasColumn('isDeactivated'),
    userHasColumn('passwordHash'),
  ]);

  // Demo-User – passe nach Bedarf an
  const users = [
    {
      handle: 'admin',
      displayName: 'Admin',
      role: Role.DOMME as Role,
      email: 'admin@example.com',
      phone: '+49123456789' as string | null,
      country: 'DE' as string | null,
      isAdmin: true as boolean | undefined,
      passwordHash: null as string | null, // ggf. mit bcrypt setzen
    },
    {
      handle: 'alice',
      displayName: 'Alice',
      role: Role.SUBMISSIVE as Role,
      email: 'alice@example.com',
      phone: null as string | null,
      country: 'DE' as string | null,
      isAdmin: false as boolean | undefined,
      passwordHash: null as string | null,
    },
  ];

  for (const u of users) {
    // --- create ---
    const createData: Prisma.UserCreateInput = {
      handle: u.handle,
      displayName: u.displayName,
      role: u.role,
      email: u.email ?? null,
      ...(hasPhone ? ({ phone: u.phone ?? null } as any) : {}),
      ...(hasCountry ? ({ country: u.country ?? null } as any) : {}),
      ...(hasIsDeactivated ? ({ isDeactivated: false } as any) : {}),
      ...(hasPasswordHash ? ({ passwordHash: u.passwordHash ?? null } as any) : {}),
      ...(hasIsAdmin ? ({ isAdmin: u.isAdmin ?? false } as any) : {}),
    };

    // --- update ---
    const updateData: Prisma.UserUpdateInput = {
      displayName: u.displayName,
      role: u.role,
      email: u.email ?? null,
      ...(hasPhone ? ({ phone: u.phone ?? null } as any) : {}),
      ...(hasCountry ? ({ country: u.country ?? null } as any) : {}),
      ...(hasIsDeactivated ? ({ isDeactivated: false } as any) : {}),
      ...(hasPasswordHash ? ({ passwordHash: u.passwordHash ?? null } as any) : {}),
      ...(hasIsAdmin ? ({ isAdmin: u.isAdmin ?? false } as any) : {}),
    };

    await prisma.user.upsert({
      where: { handle: u.handle },
      create: createData,
      update: updateData,
    });
  }

  // Notification-Defaults für alle angelegten Users
  const seeded = await prisma.user.findMany({
    where: { handle: { in: users.map((x) => x.handle) } },
    select: { id: true, handle: true },
  });
  for (const u of seeded) {
    await upsertNotifDefaults(u.id);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
