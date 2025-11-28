-- CreateTable
CREATE TABLE "public"."Team" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" INTEGER,
    "shortName" TEXT,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
