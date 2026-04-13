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
  sort?: "time" | "volume";
}) {
  const { q = "", sort = "time" } = opts ?? {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = nextTradingDay(today);

  // After market close, show tomorrow's markets. If today has no open markets
  // (all resolved or none created), also fall back to tomorrow.
  const todayOpenCount = isAfterMarketClose()
    ? 0
    : await db.market.count({ where: { status: MarketStatus.OPEN, betDate: today } });
  const displayDate = todayOpenCount > 0 ? today : tomorrow;

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

  return Array.from(grouped.values()).map((g) => ({
    id: g.company.id,
    company: g.company,
    betDate: displayDate,
    totalVolume: g.totalVolume,
    markets: g.markets,
  }));
}
