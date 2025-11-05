-- Add muted column on ConversationMember (default false, no data loss)
ALTER TABLE "ConversationMember"
ADD COLUMN IF NOT EXISTS "muted" BOOLEAN NOT NULL DEFAULT false;

-- Create ConversationReport table
CREATE TABLE IF NOT EXISTS "ConversationReport" (
  "id"             TEXT      PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversationId" TEXT      NOT NULL,
  "reporterId"     TEXT      NOT NULL,
  "reason"         TEXT      NOT NULL,
  "createdAt"      TIMESTAMP NOT NULL DEFAULT NOW(),

  CONSTRAINT "ConversationReport_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE,
  CONSTRAINT "ConversationReport_reporterId_fkey"
    FOREIGN KEY ("reporterId")     REFERENCES "User"         ("id") ON DELETE CASCADE
);

-- Index for quick lookups by conversation & time
CREATE INDEX IF NOT EXISTS "ConversationReport_conversationId_createdAt_idx"
ON "ConversationReport" ("conversationId", "createdAt");
