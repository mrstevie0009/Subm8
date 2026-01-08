/*
  Warnings:

  - A unique constraint covering the columns `[methodRef]` on the table `Tip` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "NotificationSeenCursor" ALTER COLUMN "seenUntil" SET DEFAULT '1970-01-01T00:00:00.000Z'::timestamptz;

-- CreateIndex
CREATE UNIQUE INDEX "Tip_methodRef_key" ON "Tip"("methodRef");
