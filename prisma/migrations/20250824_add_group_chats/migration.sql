-- ==============================================================
-- Group Chats Migration (robust + idempotent)
--  - Enums: ConversationType, ConversationMemberRole
--  - Conversation: ensure table + columns (type, title, createdById, updatedAt,
--                 lastMessageId/At, dommeId/subId nullable, unread counters)
--  - Unique: (type, dommeId, subId)
--  - ConversationMember table + FKs + indexes
--  - Backfill ConversationMember for existing DMs (uses unread counters)
-- ==============================================================

-- 0) Ensure "User" table exists minimally (safety; in real DB schon da)
CREATE TABLE IF NOT EXISTS "public"."User" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "handle" VARCHAR(20) NOT NULL,
  "displayName" VARCHAR(40) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- 1) Enums -----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationType') THEN
    CREATE TYPE "ConversationType" AS ENUM ('DM','GROUP');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ConversationMemberRole') THEN
    CREATE TYPE "ConversationMemberRole" AS ENUM ('ADMIN','MEMBER');
  END IF;
END$$;

-- 2) Conversation base table (minimal baseline)
CREATE TABLE IF NOT EXISTS "public"."Conversation" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dommeId" TEXT NULL,
  "subId" TEXT NULL,
  "openedByDomme" BOOLEAN NOT NULL DEFAULT TRUE,
  "lastMessageId" TEXT NULL,
  "lastMessageAt" TIMESTAMP(3) NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- 3) Ensure columns exist --------------------------------------
DO $$
BEGIN
  -- conversation.type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='type'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "type" "ConversationType" NOT NULL DEFAULT 'DM';
  END IF;

  -- conversation.title
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='title'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "title" TEXT NULL;
  END IF;

  -- conversation.createdById (+ FK later)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='createdById'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "createdById" TEXT NULL;
  END IF;

  -- updatedAt (für Indexe & Prisma @updatedAt)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='updatedAt'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  -- lastMessageAt
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='lastMessageAt'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "lastMessageAt" TIMESTAMP(3) NULL;
  END IF;

  -- lastMessageId
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='lastMessageId'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "lastMessageId" TEXT NULL;
  END IF;

  -- unread counters (werden beim Backfill benutzt)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='unreadForDomme'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "unreadForDomme" INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Conversation' AND column_name='unreadForSub'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD COLUMN "unreadForSub" INTEGER NOT NULL DEFAULT 0;
  END IF;

  -- dommeId/subId nullable (falls in Altbestand NOT NULL war)
  BEGIN
    ALTER TABLE "public"."Conversation" ALTER COLUMN "dommeId" DROP NOT NULL;
  EXCEPTION WHEN others THEN
    -- ignorieren, wenn schon NULL-able
    NULL;
  END;

  BEGIN
    ALTER TABLE "public"."Conversation" ALTER COLUMN "subId" DROP NOT NULL;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END$$;

-- 3.5) createdById FK (SET NULL) --------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_schema='public'
      AND tc.table_name='Conversation'
      AND tc.constraint_type='FOREIGN KEY'
      AND kcu.column_name='createdById'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD CONSTRAINT "Conversation_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL;
  END IF;
END$$;

-- 4) Defaults/Backfill for type --------------------------------
UPDATE "public"."Conversation" SET "type"='DM' WHERE "type" IS NULL;

-- 5) Indexe -----------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='Conversation_updated_desc_idx'
  ) THEN
    CREATE INDEX "Conversation_updated_desc_idx"
      ON "public"."Conversation" ("updatedAt" DESC);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND indexname='Conversation_lastMessageAt_desc_idx'
  ) THEN
    CREATE INDEX "Conversation_lastMessageAt_desc_idx"
      ON "public"."Conversation" ("lastMessageAt" DESC);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Conversation_dommeId_idx') THEN
    CREATE INDEX "Conversation_dommeId_idx" ON "public"."Conversation" ("dommeId");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='Conversation_subId_idx') THEN
    CREATE INDEX "Conversation_subId_idx" ON "public"."Conversation" ("subId");
  END IF;
END$$;

-- 6) Unique (type, dommeId, subId) ------------------------------------------
DO $$
DECLARE
  old_uc_name text;
BEGIN
  -- alte Unique nur auf (dommeId, subId) ggf. droppen
  SELECT conname INTO old_uc_name
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE c.contype = 'u'
    AND n.nspname = 'public'
    AND t.relname = 'Conversation'
    AND (
      SELECT array_agg(attname::text ORDER BY attnum)
      FROM pg_attribute
      WHERE attrelid = t.oid AND attnum = ANY (c.conkey)
    ) = ARRAY['dommeId','subId']::text[];
  IF old_uc_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE "public"."Conversation" DROP CONSTRAINT %I;', old_uc_name);
  END IF;

  -- neue Unique hinzufügen, falls fehlt
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.contype='u'
      AND c.conname='Conversation_type_domme_sub_unique'
      AND n.nspname='public'
      AND t.relname='Conversation'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD CONSTRAINT "Conversation_type_domme_sub_unique"
      UNIQUE ("type","dommeId","subId");
  END IF;
END$$;

-- 7) ConversationMember table + FKs -----------------------------------------
CREATE TABLE IF NOT EXISTS "public"."ConversationMember" (
  "conversationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "role"           "ConversationMemberRole" NOT NULL DEFAULT 'MEMBER',
  "unreadCount"    INTEGER NOT NULL DEFAULT 0,
  "lastReadAt"     TIMESTAMP(3) NULL,
  CONSTRAINT "ConversationMember_pkey" PRIMARY KEY ("conversationId","userId")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_schema='public'
      AND tc.table_name='ConversationMember'
      AND tc.constraint_type='FOREIGN KEY'
      AND kcu.column_name='conversationId'
  ) THEN
    ALTER TABLE "public"."ConversationMember"
      ADD CONSTRAINT "ConversationMember_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
    WHERE tc.table_schema='public'
      AND tc.table_name='ConversationMember'
      AND tc.constraint_type='FOREIGN KEY'
      AND kcu.column_name='userId'
  ) THEN
    ALTER TABLE "public"."ConversationMember"
      ADD CONSTRAINT "ConversationMember_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ConversationMember_userId_idx') THEN
    CREATE INDEX "ConversationMember_userId_idx" ON "public"."ConversationMember" ("userId");
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='ConversationMember_conversationId_idx') THEN
    CREATE INDEX "ConversationMember_conversationId_idx" ON "public"."ConversationMember" ("conversationId");
  END IF;
END$$;

-- 8) Backfill members for existing DMs --------------------------------------
-- Stelle sicher, dass alle Reihen DM sind (oben schon) und Domme/Sub-IDs vorhanden
-- Domme eintragen
INSERT INTO "public"."ConversationMember" ("conversationId","userId","role","unreadCount")
SELECT c."id", c."dommeId", 'MEMBER', COALESCE(c."unreadForDomme", 0)
FROM "public"."Conversation" c
LEFT JOIN "public"."ConversationMember" m
  ON m."conversationId" = c."id" AND m."userId" = c."dommeId"
WHERE c."type" = 'DM'
  AND c."dommeId" IS NOT NULL
  AND m."userId" IS NULL;

-- Sub eintragen
INSERT INTO "public"."ConversationMember" ("conversationId","userId","role","unreadCount")
SELECT c."id", c."subId", 'MEMBER', COALESCE(c."unreadForSub", 0)
FROM "public"."Conversation" c
LEFT JOIN "public"."ConversationMember" m
  ON m."conversationId" = c."id" AND m."userId" = c."subId"
WHERE c."type" = 'DM'
  AND c."subId" IS NOT NULL
  AND m."userId" IS NULL;

-- 9) (optional) Kommentare ---------------------------------------------------
COMMENT ON TYPE  "public"."ConversationType"       IS 'Conversation type: DM or GROUP';
COMMENT ON TYPE  "public"."ConversationMemberRole" IS 'Member role in group conversations';
COMMENT ON TABLE "public"."ConversationMember"     IS 'Join table for group memberships and per-user unread';
COMMENT ON COLUMN "public"."Conversation"."type"   IS 'DM or GROUP';
COMMENT ON COLUMN "public"."Conversation"."title"  IS 'Optional group title';
COMMENT ON COLUMN "public"."Conversation"."createdById" IS 'Creator (mostly for GROUP)';
