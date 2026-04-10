import { randomBytes } from "crypto";

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
