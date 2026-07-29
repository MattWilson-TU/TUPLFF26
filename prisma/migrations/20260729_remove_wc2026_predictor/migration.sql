-- Drop WC2026 predictor tables
DROP TABLE IF EXISTS "WcPrediction";
DROP TABLE IF EXISTS "WcFixture";
DROP TABLE IF EXISTS "WcDataSync";

-- Repurpose participation flag for 26-27 fantasy game
ALTER TABLE "Manager" RENAME COLUMN "wc2026Enabled" TO "game2627Enabled";
