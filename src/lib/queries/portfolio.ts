import { db } from "@/lib/db";

export type OpenPosition = Awaited<ReturnType<typeof getOpenPositions>>[number];
export type WatchlistItem = Awaited<ReturnType<typeof getWatchlist>>[number];
export type PositionHistoryItem = Awaited<ReturnType<typeof getPositionHistory>>[number];
export type PortfolioSummaryData = Awaited<ReturnType<typeof getPortfolioSummary>>;

export async function getOpenPositions(userId: string) {
  return db.position.findMany({
    where: {
      userId,
      market: { status: "OPEN" },
    },
    include: {
      market: {
        include: { company: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWatchlist(userId: string) {
  return db.watchlist.findMany({
    where: { userId },
    include: {
      market: {
        include: {
          company: true,
          earningsEvent: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPositionHistory(userId: string) {
  return db.position.findMany({
    where: {
      userId,
      market: { status: "RESOLVED" },
    },
    include: {
      market: {
        include: {
          company: true,
          resolution: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPortfolioSummary(userId: string) {
  const positions = await db.position.findMany({
    where: {
      userId,
      market: { status: "OPEN" },
    },
    select: {
      shares: true,
      currentPrice: true,
      unrealizedPL: true,
    },
  });

  const openPositionValue = positions.reduce(
    (sum, p) => sum + p.shares * p.currentPrice,
    0
  );
  const unrealizedPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);

  return { openPositionValue, unrealizedPL };
}
