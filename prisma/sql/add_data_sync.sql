CREATE TABLE IF NOT EXISTS "public"."DataSync" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DataSync_pkey" PRIMARY KEY ("id")
);
