import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { Side, PayoutType, ChallengeType } from "@prisma/client";

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
}: {
  title: string;
  creatorId?: string;
  type?: ChallengeType;
  entryFeeCents?: number;
  payoutType?: PayoutType;
  marketIds: string[];
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
