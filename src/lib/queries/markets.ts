import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";
import { isAfterMarketClose } from "@/lib/create-daily-markets";

export type MarketFeedCompany = Awaited<ReturnType<typeof getMarketFeed>>[number];

function nextTradingDay(from: Date): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  const day = d.getDay();
  if (day === 6) d.setDate(d.getDate() + 2); // Saturday → Monday
  if (day === 0) d.setDate(d.getDate() + 1); // Sunday → Monday
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getMarketFeed(opts?: {
  q?: string;
  sort?: "time" | "volume" | "totalVolume";
}) {
  const { q = "", sort = "time" } = opts ?? {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = nextTradingDay(today);
  // After market close (4 PM ET), show tomorrow's markets as a preview.
  // Before close, always show today's markets (even if empty).
  const displayDate = isAfterMarketClose() ? tomorrow : today;

  const markets = await db.market.findMany({
    where: {
      status: MarketStatus.OPEN,
      betDate: displayDate,
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

  const result = Array.from(grouped.values()).map((g) => ({
    id: g.company.id,
    company: g.company,
    betDate: displayDate,
    totalVolume: g.totalVolume,
    markets: g.markets,
  }));

  if (sort === "totalVolume") {
    result.sort((a, b) =>
      a.totalVolume > b.totalVolume ? -1 : a.totalVolume < b.totalVolume ? 1 : 0
    );
  }

  return result;
}
