-- Mark all existing markets as RESOLVED before enum change
UPDATE "Market" SET "status" = 'RESOLVED' WHERE "status" = 'OPEN' OR "status" = 'CLOSED';

-- Make earningsEventId optional
ALTER TABLE "Market" ALTER COLUMN "earningsEventId" DROP NOT NULL;

-- Add betDate column
ALTER TABLE "Market" ADD COLUMN "betDate" DATE;

-- Add index for daily queries
CREATE INDEX "Market_betDate_status_idx" ON "Market"("betDate", "status");

-- Swap MetricType enum values
-- Set a temporary default so we can change enum
ALTER TABLE "Market" ALTER COLUMN "metricType" TYPE TEXT;
UPDATE "Market" SET "metricType" = 'PRICE_DIRECTION';
DROP TYPE "MetricType";
CREATE TYPE "MetricType" AS ENUM ('PRICE_DIRECTION', 'PRICE_TARGET', 'PERCENTAGE_MOVE');
ALTER TABLE "Market" ALTER COLUMN "metricType" TYPE "MetricType" USING "metricType"::"MetricType";
