import { db } from "@/lib/db";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string | null;
  roiPct: number;
  totalRealizedPL: number; // cents
  positionCount: number;
}

interface RawRow {
  userId: string;
  displayName: string | null;
  totalRealizedPL: number;
  // proxy: sum(avgCostCents) across positions — NOT sum(avgCostCents * shares).
  // Preserves relative ordering for leaderboard purposes; not mathematically exact ROI.
  totalCostBasis: number;
  positionCount: number;
}

/** Pure function — exported for testing. */
export function computeLeaderboard(rows: RawRow[]): LeaderboardRow[] {
  return rows
    .filter((r) => r.positionCount >= 5)
    .map((r) => ({
      ...r,
      roiPct: r.totalCostBasis === 0 ? 0 : (r.totalRealizedPL / r.totalCostBasis) * 100,
    }))
    .sort((a, b) => b.roiPct - a.roiPct)
    .slice(0, 50)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getLeaderboard(timeWindow: "all" | "30d"): Promise<LeaderboardRow[]> {
  const cutoff =
    timeWindow === "30d"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : undefined;

  const groups = await db.position.groupBy({
    by: ["userId"],
    where: {
      realizedPL: { not: null },
      // Note: updatedAt is used as a proxy for resolution date. Position has no resolvedAt field.
      // Positions whose price was refreshed after resolution may also appear in the 30d window.
      ...(cutoff ? { updatedAt: { gte: cutoff } } : {}),
    },
    _sum: { realizedPL: true, avgCostCents: true },
    _count: { id: true },
  });

  if (groups.length === 0) return [];

  // Fetch display names for all users in one query
  const userIds = groups.map((g) => g.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.displayName]));

  const raw: RawRow[] = groups.map((g) => ({
    userId: g.userId,
    displayName: nameMap.get(g.userId) ?? null,
    totalRealizedPL: g._sum.realizedPL ?? 0,
    totalCostBasis: g._sum.avgCostCents ?? 0,
    positionCount: g._count.id,
  }));

  return computeLeaderboard(raw);
}
