/*
  Warnings:

  - A unique constraint covering the columns `[stripeTransferId]` on the table `PayoutRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripePayoutId]` on the table `PayoutRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "NotificationSeenCursor" ALTER COLUMN "seenUntil" SET DEFAULT '1970-01-01T00:00:00.000Z'::timestamptz;

-- AlterTable
ALTER TABLE "PayoutRequest" ADD COLUMN     "stripePayoutId" TEXT,
ADD COLUMN     "stripePayoutStatus" TEXT,
ADD COLUMN     "stripeTransferId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_stripeTransferId_key" ON "PayoutRequest"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRequest_stripePayoutId_key" ON "PayoutRequest"("stripePayoutId");
