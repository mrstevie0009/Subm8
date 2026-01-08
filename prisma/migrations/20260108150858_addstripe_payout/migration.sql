/*
  Warnings:

  - A unique constraint covering the columns `[stripeTransferId]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "NotificationSeenCursor" ALTER COLUMN "seenUntil" SET DEFAULT '1970-01-01T00:00:00.000Z'::timestamptz;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "stripeTransferId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "stripeAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_stripeTransferId_key" ON "Payment"("stripeTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "User_stripeAccountId_key" ON "User"("stripeAccountId");
