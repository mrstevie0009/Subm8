/*
  SEPA removal - DB is empty, so no data migration required.
*/

-- 1) Normalize any remaining SEPA values just in case (safe even if none)
UPDATE "User"
SET "payoutMethod" = 'STRIPE_CONNECT'
WHERE "payoutMethod" = 'SEPA';

-- 2) Drop FK from Payment to PayoutRequest only if it exists (optional safety)
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_payoutRequestId_fkey";

-- 3) Drop SEPA table (and its FK) if it exists
ALTER TABLE "SepaPayoutRequest" DROP CONSTRAINT IF EXISTS "SepaPayoutRequest_userId_fkey";
DROP TABLE IF EXISTS "SepaPayoutRequest";

-- 4) Drop old user SEPA columns if they exist
ALTER TABLE "User"
  DROP COLUMN IF EXISTS "payoutAccountHolder",
  DROP COLUMN IF EXISTS "payoutBic",
  DROP COLUMN IF EXISTS "payoutIban";

-- 5) Remove SEPA from PayoutMethod enum
--    (Prisma-style enum change via rename pattern)
BEGIN;
  CREATE TYPE "PayoutMethod_new" AS ENUM ('STRIPE_CONNECT', 'PAXUM', 'COSMO');

  ALTER TABLE "User" ALTER COLUMN "payoutMethod" DROP DEFAULT;
  ALTER TABLE "User" ALTER COLUMN "payoutMethod"
    TYPE "PayoutMethod_new"
    USING ("payoutMethod"::text::"PayoutMethod_new");

  -- If PayoutRequest already exists and has method column, migrate its type too
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'PayoutRequest' AND column_name = 'method'
    ) THEN
      ALTER TABLE "PayoutRequest" ALTER COLUMN "method"
        TYPE "PayoutMethod_new"
        USING ("method"::text::"PayoutMethod_new");
    END IF;
  END$$;

  ALTER TYPE "PayoutMethod" RENAME TO "PayoutMethod_old";
  ALTER TYPE "PayoutMethod_new" RENAME TO "PayoutMethod";
  DROP TYPE "PayoutMethod_old";

  ALTER TABLE "User" ALTER COLUMN "payoutMethod" SET DEFAULT 'STRIPE_CONNECT';
COMMIT;

-- 6) Ensure FeePayer enum exists (needed by your schema)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeePayer') THEN
    CREATE TYPE "FeePayer" AS ENUM ('USER', 'PLATFORM');
  END IF;
END$$;

-- 7) Ensure PayoutRequest table exists with new columns (create if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='PayoutRequest'
  ) THEN
    CREATE TABLE "PayoutRequest" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "amountCents" INTEGER NOT NULL,
      "currency" TEXT NOT NULL DEFAULT 'EUR',
      "method" "PayoutMethod" NOT NULL,
      "destination" TEXT NOT NULL,

      "requestedCents" INTEGER NOT NULL,
      "feeCents" INTEGER NOT NULL DEFAULT 0,
      "payoutCents" INTEGER NOT NULL,
      "feePayer" "FeePayer" NOT NULL DEFAULT 'USER',

      "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "processedAt" TIMESTAMP(3),
      "failedReason" TEXT,

      CONSTRAINT "PayoutRequest_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX "PayoutRequest_userId_idx" ON "PayoutRequest"("userId");
    CREATE INDEX "PayoutRequest_status_idx" ON "PayoutRequest"("status");
    CREATE INDEX "PayoutRequest_createdAt_idx" ON "PayoutRequest"("createdAt");

    ALTER TABLE "PayoutRequest"
      ADD CONSTRAINT "PayoutRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- 8) Re-add Payment -> PayoutRequest FK (if payoutRequestId exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='Payment' AND column_name='payoutRequestId'
  ) THEN
    ALTER TABLE "Payment"
      ADD CONSTRAINT "Payment_payoutRequestId_fkey"
      FOREIGN KEY ("payoutRequestId") REFERENCES "PayoutRequest"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

-- 9) Drop SepaPayoutStatus enum if it exists and nothing uses it
DROP TYPE IF EXISTS "SepaPayoutStatus";
