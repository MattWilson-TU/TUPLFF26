-- AlterTable
ALTER TABLE "public"."Auction" ADD COLUMN     "currentLotId" TEXT;

-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "webName" TEXT;

-- AlterTable
ALTER TABLE "public"."SquadPlayer" ADD COLUMN     "feeHalfM" INTEGER NOT NULL DEFAULT 0;

