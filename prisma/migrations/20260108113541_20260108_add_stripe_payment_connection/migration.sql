/*
  Warnings:

  - A unique constraint covering the columns `[pinnedPostId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Comment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('IP_GEO', 'CARD_BIN', 'BILLING', 'USER_DECLARED');

-- CreateEnum
CREATE TYPE "SmsChallengePurpose" AS ENUM ('SETUP', 'LOGIN');

-- CreateEnum
CREATE TYPE "TwoFactorType" AS ENUM ('TOTP', 'WEBAUTHN', 'SMS');

-- CreateEnum
CREATE TYPE "InviteType" AS ENUM ('LINK', 'DIRECT');

-- CreateEnum
CREATE TYPE "AutoDrainCadence" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "AutoDrainChargeStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- AlterEnum
ALTER TYPE "LedgerAccount" ADD VALUE 'VAT_RESERVE';

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_lastMessageId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationMember" DROP CONSTRAINT "ConversationMember_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationMember" DROP CONSTRAINT "ConversationMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationReport" DROP CONSTRAINT "ConversationReport_conversationId_fkey";

-- DropForeignKey
ALTER TABLE "ConversationReport" DROP CONSTRAINT "ConversationReport_reporterId_fkey";

-- DropIndex
DROP INDEX "Conversation_dommeId_subId_key";

-- DropIndex
DROP INDEX "Conversation_domme_updated_idx";

-- DropIndex
DROP INDEX "Conversation_sub_updated_idx";

-- DropIndex
DROP INDEX "MessageRead_readerUserId_idx";

-- DropIndex
DROP INDEX "User_kinks_gin_idx";

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "mediaAlt" TEXT,
ADD COLUMN     "mediaUrl" TEXT,
ADD COLUMN     "parentId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Conversation" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "hiddenForDomme" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "hiddenForSub" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConversationReport" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConversationTypingState" ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "LoginThrottle" ALTER COLUMN "lastAttempt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NotificationSeenCursor" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "seenUntil" SET DEFAULT '1970-01-01T00:00:00.000Z'::timestamptz,
ALTER COLUMN "seenUntil" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "buyerCountry" VARCHAR(2),
ADD COLUMN     "buyerIp" TEXT,
ADD COLUMN     "cardBin" VARCHAR(8),
ADD COLUMN     "metadataJson" JSONB,
ADD COLUMN     "paymentProvider" TEXT DEFAULT 'Segpay',
ADD COLUMN     "stripeChargeId" TEXT,
ADD COLUMN     "vatAmountCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "mediaType" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "ageVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "dob" TIMESTAMP(3),
ADD COLUMN     "pinnedPostId" TEXT,
ADD COLUMN     "stripeConnectAccountId" TEXT,
ADD COLUMN     "stripeCustomerId" TEXT,
ADD COLUMN     "stripeDefaultPmId" TEXT,
ADD COLUMN     "veriffId" TEXT,
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedByUserId" TEXT,
ADD COLUMN     "websiteUrl" VARCHAR(255),
ALTER COLUMN "premiumUntil" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SmsChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "SmsChallengePurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SmsCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebAuthnCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAuthnCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "token" VARCHAR(128) NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "AccountLink" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "linkedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedMedia" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommentLike" (
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("userId","commentId")
);

-- CreateTable
CREATE TABLE "CommunityInvite" (
    "id" TEXT NOT NULL,
    "communityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "targetUserId" TEXT,
    "type" "InviteType" NOT NULL,
    "token" TEXT NOT NULL,
    "note" TEXT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerEvidence" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT NOT NULL,
    "type" "EvidenceType" NOT NULL,
    "country" VARCHAR(2),
    "source" TEXT,
    "value" TEXT,

    CONSTRAINT "BuyerEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VatLedger" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "country" VARCHAR(2),
    "rate" INTEGER NOT NULL,
    "vatAmountCents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VatLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRevenue" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "grossFeeCents" INTEGER NOT NULL,
    "providerFeeCents" INTEGER NOT NULL,
    "netRevenueCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessorFeeLedger" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessorFeeLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoDrainSubscription" (
    "id" TEXT NOT NULL,
    "dommeId" TEXT NOT NULL,
    "subId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "cadence" "AutoDrainCadence" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextChargeAt" TIMESTAMP(3) NOT NULL,
    "lastChargeAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoDrainSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutoDrainCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountCents" INTEGER NOT NULL,
    "currency" VARCHAR(8) NOT NULL,
    "status" "AutoDrainChargeStatus" NOT NULL DEFAULT 'PENDING',
    "receiptId" TEXT,
    "error" TEXT,

    CONSTRAINT "AutoDrainCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsCode_userId_idx" ON "SmsCode"("userId");

-- CreateIndex
CREATE INDEX "SmsCode_expiresAt_idx" ON "SmsCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebAuthnCredential_credentialId_key" ON "WebAuthnCredential"("credentialId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "AccountLink_ownerId_idx" ON "AccountLink"("ownerId");

-- CreateIndex
CREATE INDEX "AccountLink_linkedUserId_idx" ON "AccountLink"("linkedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountLink_ownerId_linkedUserId_key" ON "AccountLink"("ownerId", "linkedUserId");

-- CreateIndex
CREATE INDEX "UploadedMedia_postId_idx" ON "UploadedMedia"("postId");

-- CreateIndex
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");

-- CreateIndex
CREATE INDEX "CommentLike_userId_idx" ON "CommentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_token_key" ON "CommunityInvite"("token");

-- CreateIndex
CREATE INDEX "CommunityInvite_communityId_idx" ON "CommunityInvite"("communityId");

-- CreateIndex
CREATE INDEX "CommunityInvite_targetUserId_idx" ON "CommunityInvite"("targetUserId");

-- CreateIndex
CREATE INDEX "BuyerEvidence_paymentId_idx" ON "BuyerEvidence"("paymentId");

-- CreateIndex
CREATE INDEX "VatLedger_paymentId_idx" ON "VatLedger"("paymentId");

-- CreateIndex
CREATE INDEX "VatLedger_status_idx" ON "VatLedger"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformRevenue_paymentId_key" ON "PlatformRevenue"("paymentId");

-- CreateIndex
CREATE INDEX "ProcessorFeeLedger_paymentId_idx" ON "ProcessorFeeLedger"("paymentId");

-- CreateIndex
CREATE INDEX "AutoDrainSubscription_subId_active_nextChargeAt_idx" ON "AutoDrainSubscription"("subId", "active", "nextChargeAt");

-- CreateIndex
CREATE INDEX "AutoDrainSubscription_dommeId_subId_active_idx" ON "AutoDrainSubscription"("dommeId", "subId", "active");

-- CreateIndex
CREATE INDEX "AutoDrainCharge_subscriptionId_at_idx" ON "AutoDrainCharge"("subscriptionId", "at");

-- CreateIndex
CREATE INDEX "Comment_parentId_createdAt_idx" ON "Comment"("parentId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_createdById_idx" ON "Conversation"("createdById");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_authorId_createdAt_idx" ON "Message"("authorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Message_conversationId_authorId_idx" ON "Message"("conversationId", "authorId");

-- CreateIndex
CREATE INDEX "MessageRead_readerUserId_messageId_idx" ON "MessageRead"("readerUserId", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "User_pinnedPostId_key" ON "User"("pinnedPostId");

-- CreateIndex
CREATE INDEX "User_verifiedByUserId_idx" ON "User"("verifiedByUserId");

-- CreateIndex
CREATE INDEX "User_stripeCustomerId_idx" ON "User"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "User_stripeConnectAccountId_idx" ON "User"("stripeConnectAccountId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pinnedPostId_fkey" FOREIGN KEY ("pinnedPostId") REFERENCES "Post"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsChallenge" ADD CONSTRAINT "SmsChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCode" ADD CONSTRAINT "SmsCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebAuthnCredential" ADD CONSTRAINT "WebAuthnCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLink" ADD CONSTRAINT "AccountLink_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountLink" ADD CONSTRAINT "AccountLink_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationMember" ADD CONSTRAINT "ConversationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedMedia" ADD CONSTRAINT "UploadedMedia_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityInvite" ADD CONSTRAINT "CommunityInvite_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerEvidence" ADD CONSTRAINT "BuyerEvidence_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VatLedger" ADD CONSTRAINT "VatLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRevenue" ADD CONSTRAINT "PlatformRevenue_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessorFeeLedger" ADD CONSTRAINT "ProcessorFeeLedger_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversationReport" ADD CONSTRAINT "ConversationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoDrainSubscription" ADD CONSTRAINT "AutoDrainSubscription_dommeId_fkey" FOREIGN KEY ("dommeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoDrainSubscription" ADD CONSTRAINT "AutoDrainSubscription_subId_fkey" FOREIGN KEY ("subId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutoDrainCharge" ADD CONSTRAINT "AutoDrainCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "AutoDrainSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Conversation_type_domme_sub_unique" RENAME TO "Conversation_type_dommeId_subId_key";

-- RenameIndex
ALTER INDEX "LoginThrottle_ip_identifier_unique" RENAME TO "LoginThrottle_ip_identifier_key";

-- RenameIndex
ALTER INDEX "NotificationSeenCursor_recipient_kind_seenUntil_idx" RENAME TO "NotificationSeenCursor_recipientId_kind_seenUntil_idx";

-- RenameIndex
ALTER INDEX "NotificationSeenCursor_unique" RENAME TO "NotificationSeenCursor_recipientId_actorId_kind_key";
