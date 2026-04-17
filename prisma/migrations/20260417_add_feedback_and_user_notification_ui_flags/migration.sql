-- =====================================
-- Add feedback table + backfill missing
-- migration-history changes for
-- UserNotificationSettings.uiPopup/uiSound
-- Idempotent / safe for existing DB
-- =====================================

-- -------------------------------------------------
-- 1) Ensure UserNotificationSettings table exists
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."UserNotificationSettings" (
  "userId" TEXT NOT NULL,
  "pushEnabled" BOOLEAN NOT NULL DEFAULT true,
  "dmMessages" BOOLEAN NOT NULL DEFAULT true,
  "dmReactions" BOOLEAN NOT NULL DEFAULT true,
  "mentions" BOOLEAN NOT NULL DEFAULT true,
  "comments" BOOLEAN NOT NULL DEFAULT true,
  "likes" BOOLEAN NOT NULL DEFAULT true,
  "newFollowers" BOOLEAN NOT NULL DEFAULT true,
  "photoTags" BOOLEAN NOT NULL DEFAULT true,
  "emailMessages" BOOLEAN NOT NULL DEFAULT false,
  "emailDigest" BOOLEAN NOT NULL DEFAULT false,
  "muteNotFollowing" BOOLEAN NOT NULL DEFAULT false,
  "muteNotFollowers" BOOLEAN NOT NULL DEFAULT false,
  "muteNewAccounts" BOOLEAN NOT NULL DEFAULT false,
  "muteNoAvatar" BOOLEAN NOT NULL DEFAULT false,
  "requireEmailVerified" BOOLEAN NOT NULL DEFAULT false,
  "requirePhoneVerified" BOOLEAN NOT NULL DEFAULT false,
  "uiPopup" BOOLEAN NOT NULL DEFAULT true,
  "uiSound" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserNotificationSettings_pkey" PRIMARY KEY ("userId")
);

-- Foreign key nur anlegen, wenn sie noch nicht existiert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'UserNotificationSettings_userId_fkey'
  ) THEN
    ALTER TABLE "public"."UserNotificationSettings"
      ADD CONSTRAINT "UserNotificationSettings_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "public"."User"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END$$;

-- -------------------------------------------------
-- 2) Backfill missing columns in migration history
-- -------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'UserNotificationSettings'
      AND column_name  = 'uiPopup'
  ) THEN
    ALTER TABLE "public"."UserNotificationSettings"
      ADD COLUMN "uiPopup" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'UserNotificationSettings'
      AND column_name  = 'uiSound'
  ) THEN
    ALTER TABLE "public"."UserNotificationSettings"
      ADD COLUMN "uiSound" BOOLEAN NOT NULL DEFAULT true;
  END IF;
END$$;

-- -------------------------------------------------
-- 3) Create Feedback table
-- -------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."Feedback" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" TEXT,
  "text" TEXT,
  "imageUrl" TEXT,
  "userAgent" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- Foreign key für Feedback.userId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Feedback_userId_fkey'
  ) THEN
    ALTER TABLE "public"."Feedback"
      ADD CONSTRAINT "Feedback_userId_fkey"
      FOREIGN KEY ("userId")
      REFERENCES "public"."User"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END$$;

-- -------------------------------------------------
-- 4) Indexes for Feedback
-- -------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Feedback_createdAt_idx'
  ) THEN
    CREATE INDEX "Feedback_createdAt_idx"
      ON "public"."Feedback"("createdAt" DESC);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Feedback_status_createdAt_idx'
  ) THEN
    CREATE INDEX "Feedback_status_createdAt_idx"
      ON "public"."Feedback"("status", "createdAt" DESC);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Feedback_userId_idx'
  ) THEN
    CREATE INDEX "Feedback_userId_idx"
      ON "public"."Feedback"("userId");
  END IF;
END$$;

-- -------------------------------------------------
-- 5) Helpful comments
-- -------------------------------------------------
COMMENT ON TABLE "public"."Feedback" IS 'User submitted feedback from in-app feedback modal';
COMMENT ON COLUMN "public"."Feedback"."status" IS 'OPEN or REVIEWED';
COMMENT ON COLUMN "public"."UserNotificationSettings"."uiPopup" IS 'Client popup notifications enabled';
COMMENT ON COLUMN "public"."UserNotificationSettings"."uiSound" IS 'Client notification sounds enabled';