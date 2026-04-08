import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";

export type MarketFeedCompany = Awaited<ReturnType<typeof getMarketFeed>>[number];

export async function getMarketFeed(opts?: {
  q?: string;
  sort?: "time" | "volume";
}) {
  const { q = "", sort = "time" } = opts ?? {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const markets = await db.market.findMany({
    where: {
      status: MarketStatus.OPEN,
      betDate: today,
      ...(q
        ? {
            OR: [
              { company: { ticker: { contains: q, mode: "insensitive" } } },
              { company: { name: { contains: q, mode: "insensitive" } } },
              { question: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      company: true,
      probabilitySnaps: {
        orderBy: { recordedAt: "asc" },
        select: { probability: true },
      },
    },
    orderBy: sort === "volume" ? { volume24h: "desc" } : { createdAt: "asc" },
  });

  // Group by company
  const grouped = new Map<
    string,
    {
      company: (typeof markets)[0]["company"];
      markets: typeof markets;
      totalVolume: bigint;
    }
  >();

  for (const m of markets) {
    const entry = grouped.get(m.companyId) ?? {
      company: m.company,
      markets: [],
      totalVolume: BigInt(0),
    };
    entry.markets.push(m);
    entry.totalVolume += BigInt(m.totalVolume);
    grouped.set(m.companyId, entry);
  }

  return Array.from(grouped.values()).map((g) => ({
    id: g.company.id,
    company: g.company,
    betDate: today,
    totalVolume: g.totalVolume,
    markets: g.markets,
  }));
}
