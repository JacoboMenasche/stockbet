-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- CreateEnum
CREATE TYPE "ScoringMode" AS ENUM ('PICKS', 'TRADING_PNL');

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "scoringMode" "ScoringMode" NOT NULL DEFAULT 'PICKS';
ALTER TABLE "Challenge" ADD COLUMN "startDate" DATE;
