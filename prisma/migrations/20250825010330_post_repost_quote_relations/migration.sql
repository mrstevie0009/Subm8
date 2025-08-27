-- Spalten hinzufügen (idempotent)
ALTER TABLE "public"."Post"
  ADD COLUMN IF NOT EXISTS "repostOfId" TEXT,
  ADD COLUMN IF NOT EXISTS "quoteOfId"  TEXT;

-- Indizes (idempotent)
CREATE INDEX IF NOT EXISTS "Post_repostOfId_idx" ON "public"."Post"("repostOfId");
CREATE INDEX IF NOT EXISTS "Post_quoteOfId_idx"  ON "public"."Post"("quoteOfId");

-- Foreign Keys (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_repostOfId_fkey') THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_repostOfId_fkey"
      FOREIGN KEY ("repostOfId") REFERENCES "public"."Post"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_quoteOfId_fkey') THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_quoteOfId_fkey"
      FOREIGN KEY ("quoteOfId") REFERENCES "public"."Post"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END$$;
