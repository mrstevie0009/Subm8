-- einmalig in deiner DB ausführen, falls noch nicht vorhanden
ALTER TABLE "public"."User"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT,
  ADD COLUMN IF NOT EXISTS "isDeactivated" BOOLEAN NOT NULL DEFAULT false;
