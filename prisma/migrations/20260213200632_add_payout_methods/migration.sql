-- CreateEnum
CREATE TYPE "PayoutMethod" AS ENUM ('SEPA', 'STRIPE_CONNECT', 'PAXUM', 'COSMO');

-- AlterTable
ALTER TABLE "NotificationSeenCursor" ALTER COLUMN "seenUntil" SET DEFAULT '1970-01-01T00:00:00.000Z'::timestamptz;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "payoutCosmoWalletId" TEXT,
ADD COLUMN     "payoutMethod" "PayoutMethod" NOT NULL DEFAULT 'SEPA',
ADD COLUMN     "payoutPaxumEmail" TEXT;
