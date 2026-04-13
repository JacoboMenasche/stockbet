import { db } from "@/lib/db";

export type OpenPosition = Awaited<ReturnType<typeof getOpenPositions>>[number];
export type PositionHistoryItem = Awaited<ReturnType<typeof getPositionHistory>>[number];
export type PortfolioSummaryData = Awaited<ReturnType<typeof getPortfolioSummary>>;

export type WatchlistGroup = {
  companyId: string;
  company: { id: string; ticker: string; name: string };
  bookmarkType: "company" | "markets";
  markets: {
    id: string;
    question: string;
    yesPriceLatest: number;
    noPriceLatest: number;
    earningsEvent: { reportDate: Date } | null;
  }[];
};

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

export async function getWatchlistData(userId: string): Promise<WatchlistGroup[]> {
  const [companyBookmarks, marketBookmarks] = await Promise.all([
    db.companyWatchlist.findMany({
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
    }),
    db.watchlist.findMany({
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
    }),
  ]);

  const map = new Map<string, WatchlistGroup>();

  // Company bookmarks take priority — add first
  for (const cb of companyBookmarks) {
    map.set(cb.companyId, {
      companyId: cb.companyId,
      company: {
        id: cb.company.id,
        ticker: cb.company.ticker,
        name: cb.company.name,
      },
      bookmarkType: "company",
      markets: cb.company.markets.map((m) => ({
        id: m.id,
        question: m.question,
        yesPriceLatest: m.yesPriceLatest,
        noPriceLatest: m.noPriceLatest,
        earningsEvent: m.earningsEvent ? { reportDate: m.earningsEvent.reportDate } : null,
      })),
    });
  }

  // Market bookmarks — skip if company already bookmarked (company wins)
  for (const mb of marketBookmarks) {
    const cid = mb.market.companyId;
    const existing = map.get(cid);

    if (existing?.bookmarkType === "company") continue;

    const market = {
      id: mb.market.id,
      question: mb.market.question,
      yesPriceLatest: mb.market.yesPriceLatest,
      noPriceLatest: mb.market.noPriceLatest,
      earningsEvent: mb.market.earningsEvent ? { reportDate: mb.market.earningsEvent.reportDate } : null,
    };

    if (existing) {
      existing.markets.push(market);
    } else {
      map.set(cid, {
        companyId: cid,
        company: {
          id: mb.market.company.id,
          ticker: mb.market.company.ticker,
          name: mb.market.company.name,
        },
        bookmarkType: "markets",
        markets: [market],
      });
    }
  }

  return Array.from(map.values());
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

export type OpenOrder = Awaited<ReturnType<typeof getOpenOrders>>[number];

export async function getOpenOrders(userId: string) {
  return db.order.findMany({
    where: {
      userId,
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    },
    include: {
      market: {
        select: {
          id: true,
          question: true,
          company: { select: { ticker: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
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
