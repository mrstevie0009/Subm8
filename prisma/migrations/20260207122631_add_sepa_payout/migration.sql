-- CreateEnum
CREATE TYPE "SepaPayoutStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "NotificationSeenCursor" ALTER COLUMN "seenUntil" SET DEFAULT '1970-01-01T00:00:00.000Z'::timestamptz;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "payoutRequestId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "payoutAccountHolder" TEXT,
ADD COLUMN     "payoutBic" TEXT,
ADD COLUMN     "payoutIban" TEXT;

-- CreateTable
CREATE TABLE "SepaPayoutRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "iban" TEXT NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "bic" TEXT,
    "status" "SepaPayoutStatus" NOT NULL DEFAULT 'PENDING',
    "transferReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failedReason" TEXT,

    CONSTRAINT "SepaPayoutRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SepaPayoutRequest_userId_idx" ON "SepaPayoutRequest"("userId");

-- CreateIndex
CREATE INDEX "SepaPayoutRequest_status_idx" ON "SepaPayoutRequest"("status");

-- CreateIndex
CREATE INDEX "SepaPayoutRequest_createdAt_idx" ON "SepaPayoutRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Payment_payoutRequestId_idx" ON "Payment"("payoutRequestId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_payoutRequestId_fkey" FOREIGN KEY ("payoutRequestId") REFERENCES "SepaPayoutRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SepaPayoutRequest" ADD CONSTRAINT "SepaPayoutRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
