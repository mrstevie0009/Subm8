-- =========================
-- Enums (idempotent)
-- =========================
DO $$
BEGIN
  CREATE TYPE "public"."Role" AS ENUM ('DOMME', 'SUBMISSIVE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'DOMME';
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'SUBMISSIVE';

DO $$
BEGIN
  CREATE TYPE "public"."TipStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'SUCCEEDED';
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

-- =========================
-- Tabellen (idempotent)
-- =========================
CREATE TABLE IF NOT EXISTS "public"."User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT,
    "handle" VARCHAR(20) NOT NULL,
    "displayName" VARCHAR(40) NOT NULL,
    "role" "public"."Role" NOT NULL,
    "avatarUrl" TEXT,
    "bannerUrl" TEXT,
    "bio" VARCHAR(300),
    "location" TEXT,
    "nsfwDefault" BOOLEAN NOT NULL DEFAULT false,
    "ageVerifiedAt" TIMESTAMP(3),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Follow" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followerId" TEXT NOT NULL,
    "followeeId" TEXT NOT NULL,
    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Conversation" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dommeId" TEXT NOT NULL,
    "subId" TEXT NOT NULL,
    "openedByDomme" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Message" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" VARCHAR(4000),
    "mediaUrl" TEXT,
    "mediaType" TEXT,
    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."MessageRead" (
    "messageId" TEXT NOT NULL,
    "readerUserId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageRead_pkey" PRIMARY KEY ("messageId","readerUserId")
);

CREATE TABLE IF NOT EXISTS "public"."Tip" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "methodRef" TEXT,
    "status" "public"."TipStatus" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(200),
    "conversationId" TEXT,
    CONSTRAINT "Tip_pkey" PRIMARY KEY ("id")
);

-- =========================
-- Indizes (idempotent)
-- =========================
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "public"."User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_handle_key" ON "public"."User"("handle");

CREATE INDEX IF NOT EXISTS "Follow_followeeId_idx" ON "public"."Follow"("followeeId");
CREATE INDEX IF NOT EXISTS "Follow_followerId_idx" ON "public"."Follow"("followerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followeeId_key" ON "public"."Follow"("followerId", "followeeId");

CREATE INDEX IF NOT EXISTS "Conversation_dommeId_idx" ON "public"."Conversation"("dommeId");
CREATE INDEX IF NOT EXISTS "Conversation_subId_idx" ON "public"."Conversation"("subId");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_dommeId_subId_key" ON "public"."Conversation"("dommeId", "subId");

CREATE INDEX IF NOT EXISTS "MessageRead_readerUserId_idx" ON "public"."MessageRead"("readerUserId");

CREATE INDEX IF NOT EXISTS "Tip_fromUserId_idx" ON "public"."Tip"("fromUserId");
CREATE INDEX IF NOT EXISTS "Tip_toUserId_idx" ON "public"."Tip"("toUserId");
CREATE INDEX IF NOT EXISTS "Tip_conversationId_idx" ON "public"."Tip"("conversationId");

-- =========================
-- Foreign Keys (idempotent)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followerId_fkey') THEN
    ALTER TABLE "public"."Follow"
      ADD CONSTRAINT "Follow_followerId_fkey"
      FOREIGN KEY ("followerId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followeeId_fkey') THEN
    ALTER TABLE "public"."Follow"
      ADD CONSTRAINT "Follow_followeeId_fkey"
      FOREIGN KEY ("followeeId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_dommeId_fkey') THEN
    ALTER TABLE "public"."Conversation"
      ADD CONSTRAINT "Conversation_dommeId_fkey"
      FOREIGN KEY ("dommeId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_subId_fkey') THEN
    ALTER TABLE "public"."Conversation"
      ADD CONSTRAINT "Conversation_subId_fkey"
      FOREIGN KEY ("subId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_conversationId_fkey') THEN
    ALTER TABLE "public"."Message"
      ADD CONSTRAINT "Message_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_authorId_fkey') THEN
    ALTER TABLE "public"."Message"
      ADD CONSTRAINT "Message_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageRead_messageId_fkey') THEN
    ALTER TABLE "public"."MessageRead"
      ADD CONSTRAINT "MessageRead_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageRead_readerUserId_fkey') THEN
    ALTER TABLE "public"."MessageRead"
      ADD CONSTRAINT "MessageRead_readerUserId_fkey"
      FOREIGN KEY ("readerUserId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tip_fromUserId_fkey') THEN
    ALTER TABLE "public"."Tip"
      ADD CONSTRAINT "Tip_fromUserId_fkey"
      FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tip_toUserId_fkey') THEN
    ALTER TABLE "public"."Tip"
      ADD CONSTRAINT "Tip_toUserId_fkey"
      FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tip_conversationId_fkey') THEN
    ALTER TABLE "public"."Tip"
      ADD CONSTRAINT "Tip_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
