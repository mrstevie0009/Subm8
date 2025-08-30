-- CreateEnum
CREATE TYPE "public"."ReportTargetType" AS ENUM ('POST', 'USER');

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."ContentReport" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "targetType" "public"."ReportTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "reporterUserId" TEXT NOT NULL,
    "reason" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ContentReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserNotificationSettings" (
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
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserNotificationSettings_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "ContentReport_targetType_targetId_idx" ON "public"."ContentReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ContentReport_resolvedAt_idx" ON "public"."ContentReport"("resolvedAt");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "public"."Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_payerId_idx" ON "public"."Payment"("payerId");

-- CreateIndex
CREATE INDEX "Payment_payeeId_idx" ON "public"."Payment"("payeeId");

-- AddForeignKey
ALTER TABLE "public"."ContentReport" ADD CONSTRAINT "ContentReport_reporterUserId_fkey" FOREIGN KEY ("reporterUserId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserNotificationSettings" ADD CONSTRAINT "UserNotificationSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
