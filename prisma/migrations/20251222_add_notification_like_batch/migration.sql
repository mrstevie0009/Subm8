-- =====================================
-- Add NotificationSeenCursor + indices (idempotent)
-- =====================================

-- 0) Safety: ensure "User" table exists (minimal) - optional, but keeps it robust like your badge migration
CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handle" VARCHAR(20) NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- 1) Enum NotificationCursorKind (Prisma enum)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'NotificationCursorKind'
  ) THEN
    CREATE TYPE "public"."NotificationCursorKind" AS ENUM ('LIKE_POST');
  END IF;
END$$;

-- 2) Table NotificationSeenCursor
CREATE TABLE IF NOT EXISTS "public"."NotificationSeenCursor" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  "recipientId" TEXT NOT NULL,
  "actorId"     TEXT NOT NULL,
  "kind"        "public"."NotificationCursorKind" NOT NULL,

  -- everything <= seenUntil is considered "seen"
  "seenUntil"   TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',

  CONSTRAINT "NotificationSeenCursor_pkey" PRIMARY KEY ("id")
);

-- 3) Foreign keys (add only if missing)
DO $$
BEGIN
  -- FK recipientId -> User(id)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'NotificationSeenCursor'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'NotificationSeenCursor_recipientId_fkey'
  ) THEN
    ALTER TABLE "public"."NotificationSeenCursor"
      ADD CONSTRAINT "NotificationSeenCursor_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  -- FK actorId -> User(id)
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'NotificationSeenCursor'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND tc.constraint_name = 'NotificationSeenCursor_actorId_fkey'
  ) THEN
    ALTER TABLE "public"."NotificationSeenCursor"
      ADD CONSTRAINT "NotificationSeenCursor_actorId_fkey"
      FOREIGN KEY ("actorId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 4) Unique constraint (recipientId, actorId, kind)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE n.nspname = 'public'
      AND c.conname = 'NotificationSeenCursor_unique'
  ) THEN
    ALTER TABLE "public"."NotificationSeenCursor"
      ADD CONSTRAINT "NotificationSeenCursor_unique"
      UNIQUE ("recipientId", "actorId", "kind");
  END IF;
END$$;

-- 5) Indexes for NotificationSeenCursor
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'NotificationSeenCursor_recipient_kind_seenUntil_idx'
  ) THEN
    CREATE INDEX "NotificationSeenCursor_recipient_kind_seenUntil_idx"
      ON "public"."NotificationSeenCursor" ("recipientId", "kind", "seenUntil");
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'NotificationSeenCursor_actorId_idx'
  ) THEN
    CREATE INDEX "NotificationSeenCursor_actorId_idx"
      ON "public"."NotificationSeenCursor" ("actorId");
  END IF;
END$$;

-- 6) Like indexes to support batching queries (idempotent)
-- Note: table is named "Like" in Prisma schema, which becomes "Like" in Postgres (quoted).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema='public' AND table_name='Like'
  ) THEN

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='Like_userId_createdAt_idx'
    ) THEN
      CREATE INDEX "Like_userId_createdAt_idx"
        ON "public"."Like" ("userId", "createdAt");
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname='public' AND indexname='Like_createdAt_idx'
    ) THEN
      CREATE INDEX "Like_createdAt_idx"
        ON "public"."Like" ("createdAt");
    END IF;

  END IF;
END$$;

-- Optional: small comments
COMMENT ON TABLE "public"."NotificationSeenCursor" IS 'Per-recipient per-actor cursor for batching notifications (e.g. like batches)';
COMMENT ON COLUMN "public"."NotificationSeenCursor"."seenUntil" IS 'All events <= seenUntil are considered seen';
