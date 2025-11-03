-- =====================================
-- Add verification / premium badge fields (idempotent)
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

-- Spalte isFirstAdopter hinzufügen, falls sie fehlt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'User'
      AND column_name  = 'isFirstAdopter'
  ) THEN
    ALTER TABLE "public"."User"
      ADD COLUMN "isFirstAdopter" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END$$;

-- Spalte premiumUntil hinzufügen, falls sie fehlt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'User'
      AND column_name  = 'premiumUntil'
  ) THEN
    ALTER TABLE "public"."User"
      ADD COLUMN "premiumUntil" TIMESTAMP NULL;
  END IF;
END$$;

-- Index auf premiumUntil hinzufügen, falls er fehlt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'User_premiumUntil_idx'
  ) THEN
    CREATE INDEX "User_premiumUntil_idx" ON "public"."User"("premiumUntil");
  END IF;
END$$;

-- Fertig
COMMENT ON COLUMN "public"."User"."isFirstAdopter" IS 'Flag for early adopter badge';
COMMENT ON COLUMN "public"."User"."premiumUntil"   IS 'Premium membership expiration date';
