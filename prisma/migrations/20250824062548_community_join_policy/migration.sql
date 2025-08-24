DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'CommunityJoinPolicy' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE "CommunityJoinPolicy" AS ENUM ('OPEN','INVITE_ONLY','DOMME_ONLY','SUB_ONLY');
  END IF;
END$$;

ALTER TABLE "Community"
  ADD COLUMN IF NOT EXISTS "joinPolicy" "CommunityJoinPolicy" NOT NULL DEFAULT 'OPEN';
