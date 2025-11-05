-- Adds soft-hide columns for DM lists; safe & idempotent.      prisma/migration/20251105_add_hidden_columns/migration.sql 

ALTER TABLE "Conversation"
  ADD COLUMN IF NOT EXISTS "hiddenForDomme" TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS "hiddenForSub"   TIMESTAMPTZ NULL;

-- Helpful indexes used by your queries:
CREATE INDEX IF NOT EXISTS "Conversation_dm_domme_hidden_idx"
  ON "Conversation" ("type", "dommeId", "hiddenForDomme");

CREATE INDEX IF NOT EXISTS "Conversation_dm_sub_hidden_idx"
  ON "Conversation" ("type", "subId", "hiddenForSub");
