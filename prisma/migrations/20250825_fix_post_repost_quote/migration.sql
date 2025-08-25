-- Spalten hinzufügen (idempotent)
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "repostOfId" TEXT;
ALTER TABLE "Post" ADD COLUMN IF NOT EXISTS "quoteOfId"  TEXT;

-- Indizes (optional, aber sinnvoll)
CREATE INDEX IF NOT EXISTS "Post_repostOfId_idx" ON "Post"("repostOfId");
CREATE INDEX IF NOT EXISTS "Post_quoteOfId_idx"  ON "Post"("quoteOfId");

-- FK-Constraints (idempotent via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_repostOfId_fkey'
  ) THEN
    ALTER TABLE "Post"
      ADD CONSTRAINT "Post_repostOfId_fkey"
      FOREIGN KEY ("repostOfId") REFERENCES "Post"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Post_quoteOfId_fkey'
  ) THEN
    ALTER TABLE "Post"
      ADD CONSTRAINT "Post_quoteOfId_fkey"
      FOREIGN KEY ("quoteOfId") REFERENCES "Post"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
