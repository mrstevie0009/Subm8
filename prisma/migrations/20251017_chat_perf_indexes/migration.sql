-- 1) Conversation: fehlende Spalten idempotent hinzufügen
ALTER TABLE "public"."Conversation"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "lastMessageAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "unreadForDomme" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "unreadForSub"   INTEGER NOT NULL DEFAULT 0;

-- Optional: UNIQUE auf lastMessageId (entspricht deinem Prisma @unique)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Conversation_lastMessageId_key'
  ) THEN
    CREATE UNIQUE INDEX "Conversation_lastMessageId_key"
      ON "public"."Conversation" ("lastMessageId");
  END IF;
END $$;

-- Optional: FK für lastMessageId -> Message(id) (saubere Referenz, SetNull bei Delete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Conversation_lastMessageId_fkey'
  ) THEN
    ALTER TABLE "public"."Conversation"
      ADD CONSTRAINT "Conversation_lastMessageId_fkey"
      FOREIGN KEY ("lastMessageId") REFERENCES "public"."Message"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2) Conversation: zusammengesetzte Indexe für schnelle Chatliste
CREATE INDEX IF NOT EXISTS "Conversation_domme_updated_idx"
  ON "public"."Conversation" ("dommeId", "updatedAt" DESC);
CREATE INDEX IF NOT EXISTS "Conversation_sub_updated_idx"
  ON "public"."Conversation" ("subId", "updatedAt" DESC);

-- 3) Conversation: Sort-Index auf lastMessageAt
CREATE INDEX IF NOT EXISTS "Conversation_lastMessageAt_desc_idx"
  ON "public"."Conversation" ("lastMessageAt" DESC);

-- 4) Message: Keyset-Index mit Tie-Breaker id
CREATE INDEX IF NOT EXISTS "Message_conv_created_id_desc_idx"
  ON "public"."Message" ("conversationId", "createdAt" DESC, "id" DESC);

-- 5) Typing-State Tabelle statt DDL im Request
CREATE TABLE IF NOT EXISTS "public"."ConversationTypingState" (
  "conversationId" TEXT NOT NULL,
  "userId"         TEXT NOT NULL,
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("conversationId","userId")
);
CREATE INDEX IF NOT EXISTS "ConversationTypingState_updated_idx"
  ON "public"."ConversationTypingState" ("updatedAt");
