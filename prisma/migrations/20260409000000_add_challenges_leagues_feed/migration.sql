-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('OPEN', 'LOCKED', 'RESOLVED', 'VOIDED');

-- CreateEnum
CREATE TYPE "PayoutType" AS ENUM ('WINNER_TAKES_ALL', 'TOP_THREE_SPLIT');

-- CreateEnum
CREATE TYPE "LeagueJoinMode" AS ENUM ('INVITE', 'OPEN');

-- CreateEnum
CREATE TYPE "FeedEventType" AS ENUM ('BET_PLACED', 'CHALLENGE_WON', 'STREAK', 'CHALLENGE_CREATED');

-- CreateEnum
CREATE TYPE "ChallengeType" AS ENUM ('ADMIN', 'USER');

-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "challengeMarkets" TEXT,
ADD COLUMN     "challengePicks" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastBonusAt" TIMESTAMP(3),
ADD COLUMN     "username" TEXT;

-- CreateTable
CREATE TABLE "Challenge" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ChallengeType" NOT NULL DEFAULT 'USER',
    "creatorId" TEXT,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'OPEN',
    "entryFeeCents" INTEGER NOT NULL DEFAULT 0,
    "payoutType" "PayoutType" NOT NULL DEFAULT 'WINNER_TAKES_ALL',
    "betDate" DATE NOT NULL,
    "inviteSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeMarket" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,

    CONSTRAINT "ChallengeMarket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeEntry" (
    "id" TEXT NOT NULL,
    "challengeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengePick" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "side" "Side" NOT NULL,
    "correct" BOOLEAN,

    CONSTRAINT "ChallengePick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "joinMode" "LeagueJoinMode" NOT NULL DEFAULT 'INVITE',
    "inviteSlug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeagueMember" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeagueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" "FeedEventType" NOT NULL,
    "refId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Challenge_inviteSlug_key" ON "Challenge"("inviteSlug");

-- CreateIndex
CREATE INDEX "Challenge_status_betDate_idx" ON "Challenge"("status", "betDate");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeMarket_challengeId_marketId_key" ON "ChallengeMarket"("challengeId", "marketId");

-- CreateIndex
CREATE INDEX "ChallengeEntry_userId_idx" ON "ChallengeEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeEntry_challengeId_userId_key" ON "ChallengeEntry"("challengeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengePick_entryId_marketId_key" ON "ChallengePick"("entryId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteSlug_key" ON "League"("inviteSlug");

-- CreateIndex
CREATE INDEX "LeagueMember_userId_idx" ON "LeagueMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeagueMember_leagueId_userId_key" ON "LeagueMember"("leagueId", "userId");

-- CreateIndex
CREATE INDEX "FeedEvent_createdAt_idx" ON "FeedEvent"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeMarket" ADD CONSTRAINT "ChallengeMarket_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeMarket" ADD CONSTRAINT "ChallengeMarket_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeEntry" ADD CONSTRAINT "ChallengeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePick" ADD CONSTRAINT "ChallengePick_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ChallengeEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengePick" ADD CONSTRAINT "ChallengePick_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "League" ADD CONSTRAINT "League_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeagueMember" ADD CONSTRAINT "LeagueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedEvent" ADD CONSTRAINT "FeedEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
