import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

  await prisma.$executeRaw/* POSTGRES */`
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

async function removeDemoUsers() {
  // bekannte Demo-Konten/Emails entfernen (idempotent, falls nicht vorhanden kein Effekt)
  await prisma.user.deleteMany({
    where: {
      OR: [
        { handle: { in: ['admin', 'alice'] } },
        { email: { in: ['admin@example.com', 'alice@example.com'] } },
      ],
    },
  });
}

async function main() {
  // 1) Demo-User sicher löschen (inkl. Admin)
  await removeDemoUsers();

  // 2) Notification-Defaults für alle EXISTIERENDEN echten User setzen
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  await Promise.all(allUsers.map((u) => upsertNotifDefaults(u.id)));

  console.log(`Seed done. Users in DB: ${allUsers.length}`);
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
