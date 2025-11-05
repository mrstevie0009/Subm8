-- Add group avatar column (safe & idempotent)
BEGIN;

-- Fügt das Feld hinzu, falls es noch nicht existiert.
ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "avatarUrl" TEXT NULL;

-- (Optional) Kurzer Kommentar, rein dokumentarisch.
COMMENT ON COLUMN "Conversation"."avatarUrl" IS 'Optional group avatar URL';

COMMIT;