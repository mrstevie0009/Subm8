-- =========================
-- Tabellen (idempotent)
-- =========================
CREATE TABLE IF NOT EXISTS "public"."Post" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "mediaUrl" TEXT,
    "mediaAlt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."Bookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bookmark_pkey" PRIMARY KEY ("id")
);

-- =========================
-- Index (idempotent)
-- =========================
CREATE UNIQUE INDEX IF NOT EXISTS "Bookmark_userId_postId_key"
  ON "public"."Bookmark"("userId", "postId");

-- =========================
-- Foreign Keys (idempotent)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_userId_fkey') THEN
    ALTER TABLE "public"."Bookmark"
      ADD CONSTRAINT "Bookmark_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Bookmark_postId_fkey') THEN
    ALTER TABLE "public"."Bookmark"
      ADD CONSTRAINT "Bookmark_postId_fkey"
      FOREIGN KEY ("postId") REFERENCES "public"."Post"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Post_authorId_fkey') THEN
    ALTER TABLE "public"."Post"
      ADD CONSTRAINT "Post_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "public"."User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END$$;
