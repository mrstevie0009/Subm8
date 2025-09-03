-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "offerBgDim" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "offerBgUrl" TEXT,
ADD COLUMN     "offerText" TEXT,
ADD COLUMN     "offerTitle" TEXT;

-- CreateTable
CREATE TABLE "public"."Block" (
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("blockerId","blockedId")
);

-- CreateIndex
CREATE INDEX "Block_blocked_idx" ON "public"."Block"("blockedId", "blockerId");

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Block" ADD CONSTRAINT "Block_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
