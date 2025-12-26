-- =====================================
-- Add User.kinks (idempotent)
-- =====================================

-- Falls der "User"-Table nicht existiert → anlegen mit minimalem Schema
CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "handle" VARCHAR(20) NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Spalte kinks hinzufügen, falls sie fehlt (TEXT[] mit Default leeres Array)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'User'
      AND column_name  = 'kinks'
  ) THEN
    ALTER TABLE "public"."User"
      ADD COLUMN "kinks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
  END IF;
END$$;

-- Optional: GIN Index für Array-Suche (z.B. @> / &&), nur wenn du später filterst
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'User_kinks_gin_idx'
  ) THEN
    CREATE INDEX "User_kinks_gin_idx"
      ON "public"."User" USING GIN ("kinks");
  END IF;
END$$;

COMMENT ON COLUMN "public"."User"."kinks" IS 'Array of up to 10 selected kink labels';
