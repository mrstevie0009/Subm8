-- AlterTable
ALTER TABLE "public"."Message" ADD COLUMN     "seenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."Post" ADD COLUMN     "nsfw" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "country" VARCHAR(2),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "phone" TEXT;
