/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { Side, PayoutType, ChallengeType, ScoringMode } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// Pure functions (no DB — fully unit-testable)
// ─────────────────────────────────────────────────────────────────────────────

export function scoreEntry(
  picks: { marketId: string; side: "YES" | "NO" }[],
  resolutions: Map<string, "YES" | "NO">
): number {
  return picks.filter((p) => resolutions.get(p.marketId) === p.side).length;
}

export function rankEntries<T extends { score: number; createdAt: Date }>(
  entries: T[]
): (T & { rank: number })[] {
  return [...entries]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.createdAt.getTime() - b.createdAt.getTime()
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

export function computePayouts(
  rankedCount: number,
  totalPotCents: number,
  payoutType: "WINNER_TAKES_ALL" | "TOP_THREE_SPLIT"
): number[] {
  const payouts = Array<number>(rankedCount).fill(0);
  if (totalPotCents === 0) return payouts;

  if (payoutType === "WINNER_TAKES_ALL") {
    payouts[0] = totalPotCents;
    return payouts;
  }

  // TOP_THREE_SPLIT: 60 / 30 / 10
  const splits = [0.6, 0.3, 0.1];
  for (let i = 0; i < Math.min(rankedCount, 3); i++) {
    payouts[i] = Math.floor(totalPotCents * splits[i]);
  }
  // give any rounding remainder to the winner
  const distributed = payouts.reduce((a, b) => a + b, 0);
  payouts[0] += totalPotCents - distributed;
  return payouts;
}

export function isEligibleForBonus(
  totalPicks: number,
  correctPicks: number,
  lastBonusAt: Date | null
): boolean {
  if (totalPicks < 5) return false;
  if (correctPicks / totalPicks < 0.65) return false;
  if (lastBonusAt === null) return true;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return lastBonusAt < sevenDaysAgo;
}

export function scorePnlEntries(
  entries: { id: string; userId: string; createdAt: Date }[],
  pnlByUser: Map<string, number>
): { id: string; userId: string; createdAt: Date; score: number }[] {
  return entries.map((e) => ({
    ...e,
    score: pnlByUser.get(e.userId) ?? 0,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (used by DB functions added in later tasks)
// ─────────────────────────────────────────────────────────────────────────────

export function generateSlug(): string {
  return randomBytes(6).toString("base64url").slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// DB operations
// ─────────────────────────────────────────────────────────────────────────────

export async function createChallenge({
  title,
  creatorId,
  type = ChallengeType.USER,
  entryFeeCents = 0,
  payoutType = PayoutType.WINNER_TAKES_ALL,
  marketIds,
  isPublic = false,
  scoringMode = ScoringMode.PICKS,
  startDate = null,
}: {
  title: string;
  creatorId?: string;
  type?: ChallengeType;
  entryFeeCents?: number;
  payoutType?: PayoutType;
  marketIds: string[];
  isPublic?: boolean;
  scoringMode?: ScoringMode;
  startDate?: Date | null;
}) {
  if (marketIds.length === 0) throw new Error("Challenge must include at least one market");

  if (type === ChallengeType.USER && !creatorId) throw new Error("USER challenges must have a creator");

  // Derive betDate from the first market
  const market = await db.market.findUnique({
    where: { id: marketIds[0] },
    select: { betDate: true },
  });
  if (!market?.betDate) throw new Error("Market has no betDate");

  const inviteSlug = generateSlug();
  return db.challenge.create({
    data: {
      title,
      creatorId: creatorId ?? null,
      type,
      entryFeeCents,
      payoutType,
      betDate: market.betDate,
      inviteSlug,
      isPublic: type === ChallengeType.ADMIN ? true : isPublic,
      scoringMode,
      startDate: startDate ?? null,
      markets: {
        create: marketIds.map((marketId) => ({ marketId })),
      },
    },
    include: { markets: true },
  });
}

export async function joinChallenge(slug: string, userId: string) {
  const challenge = await db.challenge.findUnique({
    where: { inviteSlug: slug },
    include: { entries: { where: { userId } } },
  });
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.status !== "OPEN") throw new Error("Challenge is not open");
  if (challenge.entries.length > 0) throw new Error("Already joined this challenge");

  if (challenge.entryFeeCents > 0) {
    return db.$transaction(async (tx) => {
      // Deduct entry fee — fails if insufficient balance
      await tx.user.update({
        where: {
          id: userId,
          cashBalanceCents: { gte: BigInt(challenge.entryFeeCents) },
        },
        data: { cashBalanceCents: { decrement: BigInt(challenge.entryFeeCents) } },
      });
      return tx.challengeEntry.create({
        data: { challengeId: challenge.id, userId },
      });
    });
  }

  return db.challengeEntry.create({
    data: { challengeId: challenge.id, userId },
  });
}

export async function submitPicks(
  slug: string,
  userId: string,
  picks: { marketId: string; side: "YES" | "NO" }[]
) {
  const challenge = await db.challenge.findUnique({
    where: { inviteSlug: slug },
    include: {
      entries: { where: { userId } },
      markets: { select: { marketId: true } },
    },
  });
  if (!challenge) throw new Error("Challenge not found");
  if (challenge.scoringMode === "TRADING_PNL") {
    throw new Error("Cannot submit picks for a P&L scored challenge");
  }
  if (challenge.status !== "OPEN") throw new Error("Challenge is closed for picks");

  const entry = challenge.entries[0];
  if (!entry) throw new Error("You have not joined this challenge");

  if (picks.length === 0) throw new Error("Must submit at least one pick");

  const validMarketIds = new Set(challenge.markets.map((m) => m.marketId));
  const invalidPick = picks.find((p) => !validMarketIds.has(p.marketId));
  if (invalidPick) throw new Error(`Market ${invalidPick.marketId} is not in this challenge`);

  await db.$transaction(
    picks.map(({ marketId, side }) =>
      db.challengePick.upsert({
        where: { entryId_marketId: { entryId: entry.id, marketId } },
        update: { side: side as Side },
        create: { entryId: entry.id, marketId, side: side as Side },
      })
    )
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Challenge resolution
// ─────────────────────────────────────────────────────────────────────────────

export async function resolveChallengesForDate(betDate: Date) {
  const challenges = await db.challenge.findMany({
    where: { betDate, status: "OPEN" },
    include: {
      entries: {
        include: { picks: true },
        orderBy: { createdAt: "asc" },
      },
      markets: {
        include: {
          market: { include: { resolution: true } },
        },
      },
    },
  });

  for (const challenge of challenges) {
    try {
      await _resolveOneChallenge(challenge);
    } catch (err) {
      console.error(`[challenges] Failed to resolve challenge ${challenge.id}:`, err);
    }
  }
}

async function _resolveOneChallenge(challenge: any) {
  if (!("scoringMode" in challenge)) {
    throw new Error(`[challenges] challenge ${challenge.id} missing scoringMode — query must include all scalar fields`);
  }
  // Void if 0 or 1 entrant — refund fees
  if (challenge.entries.length <= 1) {
    await db.$transaction([
      ...challenge.entries.map((e: any) =>
        db.user.update({
          where: { id: e.userId },
          data: { cashBalanceCents: { increment: BigInt(challenge.entryFeeCents) } },
        })
      ),
      db.challenge.update({
        where: { id: challenge.id },
        data: { status: "VOIDED" },
      }),
    ]);
    return;
  }

  let ranked: any[];
  // resolutionMap is declared here so it is in scope for the transaction's
  // pick-marking spread (which is itself guarded to PICKS mode only).
  const resolutionMap = new Map<string, "YES" | "NO">();

  if (challenge.scoringMode === "TRADING_PNL") {
    // Fetch realized P&L per participant on challenge markets
    const challengeMarketIds = challenge.markets.map((cm: any) => cm.marketId);
    const pnlByUser = new Map<string, number>();

    // Single query across all participants — a user may hold both YES and NO
    // positions on the same market; summing realizedPL across both gives net P&L.
    const positions = await db.position.findMany({
      where: {
        userId: { in: challenge.entries.map((e: any) => e.userId) },
        marketId: { in: challengeMarketIds },
        realizedPL: { not: null },
        ...(challenge.startDate ? { updatedAt: { gte: challenge.startDate } } : {}),
      },
      select: { userId: true, realizedPL: true },
    });
    for (const p of positions) {
      pnlByUser.set(p.userId, (pnlByUser.get(p.userId) ?? 0) + (p.realizedPL ?? 0));
    }

    const scoredEntries = scorePnlEntries(challenge.entries, pnlByUser);
    ranked = rankEntries(scoredEntries) as any[];
  } else {
    // Build resolution map only for PICKS mode
    for (const cm of challenge.markets) {
      if (cm.market.resolution) {
        resolutionMap.set(cm.marketId, cm.market.resolution.winningSide as "YES" | "NO");
      }
    }
    const scoredEntries = challenge.entries.map((entry: any) => ({
      ...entry,
      score: scoreEntry(
        entry.picks.map((p: any) => ({ marketId: p.marketId, side: p.side as "YES" | "NO" })),
        resolutionMap
      ),
    }));
    ranked = rankEntries(scoredEntries) as any[];
  }

  const totalPotCents = challenge.entryFeeCents * challenge.entries.length;
  const payouts = computePayouts(
    ranked.length,
    totalPotCents,
    challenge.payoutType as "WINNER_TAKES_ALL" | "TOP_THREE_SPLIT"
  );

  await db.$transaction([
    // Update each entry with score, rank, payout
    ...ranked.map((entry, i) =>
      db.challengeEntry.update({
        where: { id: entry.id },
        data: { score: entry.score, rank: entry.rank, payout: payouts[i] },
      })
    ),
    // Mark each pick as correct/incorrect (PICKS mode only)
    ...(challenge.scoringMode !== "TRADING_PNL"
      ? challenge.entries.flatMap((entry: any) =>
          entry.picks.map((pick: any) =>
            db.challengePick.update({
              where: { id: pick.id },
              data: { correct: resolutionMap.get(pick.marketId) === pick.side },
            })
          )
        )
      : []),
    // Pay out winners
    ...ranked.flatMap((entry, i) =>
      payouts[i] > 0
        ? [db.user.update({
            where: { id: entry.userId },
            data: { cashBalanceCents: { increment: BigInt(payouts[i]) } },
          })]
        : []
    ),
    // Mark challenge resolved
    db.challenge.update({
      where: { id: challenge.id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    }),
  ]);

  // Write FeedEvent for winner (fire-and-forget — non-critical)
  const winner = ranked[0];
  if (winner) {
    db.feedEvent.create({
      data: {
        userId: winner.userId,
        eventType: "CHALLENGE_WON",
        refId: challenge.id,
        metadata: {
          score: winner.score,
          total: challenge.markets.length,
          payout: payouts[0],
        },
      },
    }).catch((err) => console.error("[challenges] FeedEvent write failed:", err));
  }
}

const BONUS_AMOUNT_CENTS = 500;

export async function awardPerformanceBonuses() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const users = await db.user.findMany({
    where: {
      OR: [{ lastBonusAt: null }, { lastBonusAt: { lt: sevenDaysAgo } }],
    },
    select: { id: true, lastBonusAt: true },
  });

  for (const user of users) {
    const picks = await db.challengePick.findMany({
      where: {
        entry: {
          userId: user.id,
          challenge: { resolvedAt: { gte: sevenDaysAgo }, scoringMode: "PICKS" },
        },
        correct: { not: null },
      },
      select: { correct: true },
    });

    if (
      isEligibleForBonus(
        picks.length,
        picks.filter((p) => p.correct === true).length,
        user.lastBonusAt
      )
    ) {
      await db.user.updateMany({
        where: {
          id: user.id,
          OR: [
            { lastBonusAt: null },
            { lastBonusAt: { lt: sevenDaysAgo } },
          ],
        },
        data: {
          cashBalanceCents: { increment: BigInt(BONUS_AMOUNT_CENTS) },
          lastBonusAt: new Date(),
        },
      });
      console.log(`[bonus] Awarded ${BONUS_AMOUNT_CENTS}¢ to user ${user.id}`);
    }
  }
}
