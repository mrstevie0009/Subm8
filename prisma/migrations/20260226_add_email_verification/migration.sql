-- 1) User: emailVerifiedAt hinzufügen
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ;

-- 2) Tabelle EmailVerificationCode
CREATE TABLE IF NOT EXISTS "EmailVerificationCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "EmailVerificationCode_pkey" PRIMARY KEY ("id")
);

-- FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'EmailVerificationCode_userId_fkey'
  ) THEN
    ALTER TABLE "EmailVerificationCode"
    ADD CONSTRAINT "EmailVerificationCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

-- Indizes
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_userId_idx" ON "EmailVerificationCode"("userId");
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_email_idx" ON "EmailVerificationCode"("email");
CREATE INDEX IF NOT EXISTS "EmailVerificationCode_expiresAt_idx" ON "EmailVerificationCode"("expiresAt");