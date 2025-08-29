-- =========================
-- Enums (idempotent)
-- =========================
DO $$
BEGIN
  CREATE TYPE "public"."Role" AS ENUM ('DOMME', 'SUBMISSIVE');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'DOMME';
ALTER TYPE "public"."Role" ADD VALUE IF NOT EXISTS 'SUBMISSIVE';

DO $$
BEGIN
  CREATE TYPE "public"."TipStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'PENDING';
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'SUCCEEDED';
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "public"."TipStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

DO $$
BEGIN
  CREATE TYPE "public"."CommunityRole" AS ENUM ('ADMIN', 'MOD', 'MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."CommunityRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "public"."CommunityRole" ADD VALUE IF NOT EXISTS 'MOD';
ALTER TYPE "public"."CommunityRole" ADD VALUE IF NOT EXISTS 'MEMBER';

DO $$
BEGIN
  CREATE TYPE "public"."LedgerAccount" AS ENUM ('SUB_CASH', 'PROCESSOR', 'DOMME_WALLET', 'PLATFORM_WALLET', 'FEES');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."LedgerAccount" ADD VALUE IF NOT EXISTS 'SUB_CASH';
ALTER TYPE "public"."LedgerAccount" ADD VALUE IF NOT EXISTS 'PROCESSOR';
ALTER TYPE "public"."LedgerAccount" ADD VALUE IF NOT EXISTS 'DOMME_WALLET';
ALTER TYPE "public"."LedgerAccount" ADD VALUE IF NOT EXISTS 'PLATFORM_WALLET';
ALTER TYPE "public"."LedgerAccount" ADD VALUE IF NOT EXISTS 'FEES';

DO $$
BEGIN
  CREATE TYPE "public"."LedgerEntryType" AS ENUM ('DEBIT', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."LedgerEntryType" ADD VALUE IF NOT EXISTS 'DEBIT';
ALTER TYPE "public"."LedgerEntryType" ADD VALUE IF NOT EXISTS 'CREDIT';

DO $$
BEGIN
  CREATE TYPE "public"."PaymentStatus" AS ENUM ('CREATED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."PaymentStatus" ADD VALUE IF NOT EXISTS 'CREATED';
ALTER TYPE "public"."PaymentStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "public"."PaymentStatus" ADD VALUE IF NOT EXISTS 'SUCCEEDED';
ALTER TYPE "public"."PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';
ALTER TYPE "public"."PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELED';

DO $$
BEGIN
  CREATE TYPE "public"."PayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PAID', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;
ALTER TYPE "public"."PayoutStatus" ADD VALUE IF NOT EXISTS 'REQUESTED';
ALTER TYPE "public"."PayoutStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';
ALTER TYPE "public"."PayoutStatus" ADD VALUE IF NOT EXISTS 'PAID';
ALTER TYPE "public"."PayoutStatus" ADD VALUE IF NOT EXISTS 'FAILED';

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
    "passwordHash" TEXT,
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
    "seenAt" TIMESTAMP(3),
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

CREATE TABLE IF NOT EXISTS "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "public"."Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaAlt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "communityId" TEXT,
    "nsfw" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Comment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Community" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."CommunityMember" (
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."CommunityRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMember_pkey" PRIMARY KEY ("communityId","userId")
);

CREATE TABLE IF NOT EXISTS "public"."Ledger" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT,
    "entryType" "public"."LedgerEntryType" NOT NULL,
    "account" "public"."LedgerAccount" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Like" (
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Like_pkey" PRIMARY KEY ("userId","postId")
);

CREATE TABLE IF NOT EXISTS "public"."Payment" (
    "id" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "amountGrossCents" INTEGER NOT NULL,
    "amountNetToDommeCents" INTEGER NOT NULL,
    "platformFeeCents" INTEGER NOT NULL,
    "processorFeeCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "public"."PaymentStatus" NOT NULL,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Payout" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "public"."PayoutStatus" NOT NULL,
    "method" TEXT NOT NULL,
    "destinationRef" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Wallet" (
    "userId" TEXT NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("userId")
);

-- ===================================================
-- Column guards for existing DBs (idempotent, crucial)
-- ===================================================
ALTER TABLE "public"."Post" ADD COLUMN IF NOT EXISTS "communityId" TEXT;

-- =========================
-- Indizes (idempotent)
-- =========================
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "public"."User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_handle_key" ON "public"."User"("handle");

CREATE INDEX IF NOT EXISTS "Follow_followeeId_idx" ON "public"."Follow"("followeeId");
CREATE INDEX IF NOT EXISTS "Follow_followerId_idx" ON "public"."Follow"("followerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Follow_followerId_followeeId_key" ON "public"."Follow"("followerId","followeeId");

CREATE INDEX IF NOT EXISTS "Conversation_dommeId_idx" ON "public"."Conversation"("dommeId");
CREATE INDEX IF NOT EXISTS "Conversation_subId_idx" ON "public"."Conversation"("subId");
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_dommeId_subId_key" ON "public"."Conversation"("dommeId","subId");

CREATE INDEX IF NOT EXISTS "MessageRead_readerUserId_idx" ON "public"."MessageRead"("readerUserId");

CREATE INDEX IF NOT EXISTS "Tip_fromUserId_idx" ON "public"."Tip"("fromUserId");
CREATE INDEX IF NOT EXISTS "Tip_toUserId_idx" ON "public"."Tip"("toUserId");
CREATE INDEX IF NOT EXISTS "Tip_conversationId_idx" ON "public"."Tip"("conversationId");

CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "public"."Account"("provider","providerAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "public"."Session"("sessionToken");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "public"."VerificationToken"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier","token");

CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_postId_key" ON "public"."Bookmark"("userId","postId");

CREATE INDEX IF NOT EXISTS "Post_authorId_createdAt_idx" ON "public"."Post"("authorId","createdAt");
CREATE INDEX IF NOT EXISTS "Post_communityId_createdAt_idx" ON "public"."Post"("communityId","createdAt");

CREATE INDEX IF NOT EXISTS "Comment_postId_createdAt_idx" ON "public"."Comment"("postId","createdAt");
CREATE INDEX IF NOT EXISTS "Comment_userId_createdAt_idx" ON "public"."Comment"("userId","createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "Community_slug_key" ON "public"."Community"("slug");

CREATE INDEX IF NOT EXISTS "Like_postId_idx" ON "public"."Like"("postId");
CREATE INDEX IF NOT EXISTS "Like_userId_idx" ON "public"."Like"("userId");

-- =========================
-- Foreign Keys (idempotent)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followeeId_fkey') THEN
    ALTER TABLE "public"."Follow"
      ADD CONSTRAINT "Follow_followeeId_fkey" FOREIGN KEY ("followeeId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Follow_followerId_fkey') THEN
    ALTER TABLE "public"."Follow"
      ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_dommeId_fkey') THEN
    ALTER TABLE "public"."Conversation"
      ADD CONSTRAINT "Conversation_dommeId_fkey" FOREIGN KEY ("dommeId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Conversation_subId_fkey') THEN
    ALTER TABLE "public"."Conversation"
      ADD CONSTRAINT "Conversation_subId_fkey" FOREIGN KEY ("subId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_authorId_fkey') THEN
    ALTER TABLE "public"."Message"
      ADD CONSTRAINT "Message_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Message_conversationId_fkey') THEN
    ALTER TABLE "public"."Message"
      ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageRead_messageId_fkey') THEN
    ALTER TABLE "public"."MessageRead"
      ADD CONSTRAINT "MessageRead_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageRead_readerUserId_fkey') THEN
    ALTER TABLE "public"."MessageRead"
      ADD CONSTRAINT "MessageRead_readerUserId_fkey" FOREIGN KEY ("readerUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tip_conversationId_fkey') THEN
    ALTER TABLE "public"."Tip"
      ADD CONSTRAINT "Tip_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tip_fromUserId_fkey') THEN
    ALTER TABLE "public"."Tip"
      ADD CONSTRAINT "Tip_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tip_toUserId_fkey') THEN
    ALTER TABLE "public"."Tip"
      ADD CONSTRAINT "Tip_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Account_userId_fkey') THEN
    ALTER TABLE "public"."Account"
      ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Session_userId_fkey') THEN
    ALTER TABLE "public"."Session"
      ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_postId_fkey') THEN
    ALTER TABLE "public"."Bookmark"
      ADD CONSTRAINT "Bookmark_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_userId_fkey') THEN
    ALTER TABLE "public"."Bookmark"
      ADD CONSTRAINT "Bookmark_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_authorId_fkey') THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_communityId_fkey') THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_postId_fkey') THEN
    ALTER TABLE "public"."Comment"
      ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Comment_userId_fkey') THEN
    ALTER TABLE "public"."Comment"
      ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Community_createdById_fkey') THEN
    ALTER TABLE "public"."Community"
      ADD CONSTRAINT "Community_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityMember_communityId_fkey') THEN
    ALTER TABLE "public"."CommunityMember"
      ADD CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "public"."Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CommunityMember_userId_fkey') THEN
    ALTER TABLE "public"."CommunityMember"
      ADD CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Ledger_paymentId_fkey') THEN
    ALTER TABLE "public"."Ledger"
      ADD CONSTRAINT "Ledger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_postId_fkey') THEN
    ALTER TABLE "public"."Like"
      ADD CONSTRAINT "Like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "public"."Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Like_userId_fkey') THEN
    ALTER TABLE "public"."Like"
      ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_payeeId_fkey') THEN
    ALTER TABLE "public"."Payment"
      ADD CONSTRAINT "Payment_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_payerId_fkey') THEN
    ALTER TABLE "public"."Payment"
      ADD CONSTRAINT "Payment_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payout_userId_fkey') THEN
    ALTER TABLE "public"."Payout"
      ADD CONSTRAINT "Payout_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Wallet_userId_fkey') THEN
    ALTER TABLE "public"."Wallet"
      ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
