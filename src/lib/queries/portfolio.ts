import { db } from "@/lib/db";

export type OpenPosition = Awaited<ReturnType<typeof getOpenPositions>>[number];
export type CompanyWatchlistItem = Awaited<ReturnType<typeof getCompanyWatchlist>>[number];
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

export async function getCompanyWatchlist(userId: string) {
  return db.companyWatchlist.findMany({
    where: { userId },
    include: {
      company: {
        include: {
          markets: {
            where: { status: "OPEN" },
            include: { earningsEvent: true },
            orderBy: { createdAt: "asc" },
          },
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
