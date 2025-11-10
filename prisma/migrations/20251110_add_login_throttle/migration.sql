-- =====================================================================
-- 20251110_add_login_throttle
-- Login Throttle / Brute Force Schutz (robust + idempotent)
--  - Tabelle LoginThrottle (falls nicht vorhanden)
--  - Spalten-Guards (ADD COLUMN IF NOT EXISTS)
--  - Constraints/Indexe idempotent
-- =====================================================================

-- 0) Safety: public schema assumed
-- (Keine Abhängigkeit zu anderen Tabellen notwendig)

-- 1) Basistabelle anlegen (minimal), falls noch nicht vorhanden
CREATE TABLE IF NOT EXISTS "public"."LoginThrottle" (
  "id"           TEXT       NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastAttempt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ip"           TEXT       NOT NULL,
  "identifier"   TEXT       NOT NULL,
  "fails"        INTEGER    NOT NULL DEFAULT 0,
  "blockedUntil" TIMESTAMP(3) NULL,
  "permanent"    BOOLEAN    NOT NULL DEFAULT FALSE,
  "note"         TEXT       NULL,
  CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("id")
);

-- 2) Spalten-Guards (falls wir updaten müssen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='createdAt'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='lastAttempt'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "lastAttempt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='ip'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "ip" TEXT NOT NULL DEFAULT '0.0.0.0';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='identifier'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "identifier" TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='fails'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "fails" INTEGER NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='blockedUntil'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "blockedUntil" TIMESTAMP(3) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='permanent'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "permanent" BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='LoginThrottle' AND column_name='note'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD COLUMN "note" TEXT NULL;
  END IF;
END$$;

-- 3) Composite-Unique (ip, identifier) nur hinzufügen, wenn sie fehlt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class t ON t.oid = c.conrelid
    JOIN   pg_namespace n ON n.oid = t.relnamespace
    WHERE  c.contype = 'u'
      AND  c.conname = 'LoginThrottle_ip_identifier_unique'
      AND  n.nspname = 'public'
      AND  t.relname = 'LoginThrottle'
  ) THEN
    ALTER TABLE "public"."LoginThrottle"
      ADD CONSTRAINT "LoginThrottle_ip_identifier_unique"
      UNIQUE ("ip","identifier");
  END IF;
END$$;

-- 4) Indexe idempotent
CREATE INDEX IF NOT EXISTS "LoginThrottle_blockedUntil_idx"
  ON "public"."LoginThrottle" ("blockedUntil");

CREATE INDEX IF NOT EXISTS "LoginThrottle_permanent_idx"
  ON "public"."LoginThrottle" ("permanent");

CREATE INDEX IF NOT EXISTS "LoginThrottle_ip_identifier_idx"
  ON "public"."LoginThrottle" ("ip","identifier");

-- 5) Kommentare (optional)
COMMENT ON TABLE  "public"."LoginThrottle" IS 'Brute-force Throttle: Zählt Fehlversuche pro (ip,identifier) und erlaubt Temp/Perm-Blocks.';
COMMENT ON COLUMN "public"."LoginThrottle"."identifier" IS 'Normalisierte E-Mail oder Handle, lowercase.';
COMMENT ON COLUMN "public"."LoginThrottle"."lastAttempt" IS 'Zuletzt aktualisiert; Prisma @updatedAt spiegelt sich hier wider.';
