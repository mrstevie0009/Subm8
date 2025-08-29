-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "passwordResetProtection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" TEXT,
ADD COLUMN     "twoFactorTempSecret" TEXT,
ADD COLUMN     "twoFactorType" TEXT;
