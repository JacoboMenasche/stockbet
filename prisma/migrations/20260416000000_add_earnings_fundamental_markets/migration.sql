-- AlterEnum
ALTER TYPE "MetricType" ADD VALUE 'EPS_BEAT';
ALTER TYPE "MetricType" ADD VALUE 'REVENUE_BEAT';
ALTER TYPE "MetricType" ADD VALUE 'NET_INCOME_BEAT';
ALTER TYPE "MetricType" ADD VALUE 'EBITDA_BEAT';

-- AlterTable
ALTER TABLE "Market" ADD COLUMN "earningsCloseAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Market_earningsCloseAt_status_idx" ON "Market"("earningsCloseAt", "status");
