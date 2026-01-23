-- AlterTable
ALTER TABLE "public"."Auction" ADD COLUMN     "currentLotId" TEXT;

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "webName" TEXT;

-- AlterTable
ALTER TABLE "public"."SquadPlayer" ADD COLUMN     "feeHalfM" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."DataSync" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSync_pkey" PRIMARY KEY ("id")
);
