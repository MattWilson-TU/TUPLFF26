-- CreateTable
CREATE TABLE "WcFixture" (
    "id" TEXT NOT NULL,
    "homeTeam" TEXT NOT NULL,
    "awayTeam" TEXT NOT NULL,
    "homeCrest" TEXT,
    "awayCrest" TEXT,
    "kickoffUtc" TIMESTAMP(3) NOT NULL,
    "stage" TEXT,
    "groupName" TEXT,
    "matchday" INTEGER,
    "status" TEXT NOT NULL,
    "homeScore90" INTEGER,
    "awayScore90" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WcFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WcPrediction" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "homeScore" INTEGER NOT NULL,
    "awayScore" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WcPrediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WcDataSync" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WcDataSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WcPrediction_managerId_fixtureId_key" ON "WcPrediction"("managerId", "fixtureId");

-- AddForeignKey
ALTER TABLE "WcPrediction" ADD CONSTRAINT "WcPrediction_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Manager"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WcPrediction" ADD CONSTRAINT "WcPrediction_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "WcFixture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
