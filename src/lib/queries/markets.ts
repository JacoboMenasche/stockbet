import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";

export type MarketFeedItem = Awaited<ReturnType<typeof getMarketFeed>>[number];

export async function getMarketFeed(opts?: {
  q?: string;
  sort?: "time" | "volume";
}) {
  const { q = "", sort = "time" } = opts ?? {};

  const events = await db.earningsEvent.findMany({
    where: {
      reportDate: { gte: new Date() },
      markets: {
        some: {
          status: MarketStatus.OPEN,
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
      },
    },
    include: {
      company: true,
      markets: {
        where: {
          status: MarketStatus.OPEN,
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
          probabilitySnaps: {
            orderBy: { recordedAt: "asc" },
            select: { probability: true },
          },
        },
        orderBy: { volume24h: "desc" },
      },
    },
    orderBy:
      sort === "volume"
        ? { markets: { _count: "desc" } }
        : { reportDate: "asc" },
  });

  // Compute per-event totals and attach days-until
  return events.map((event) => {
    const totalVolume = event.markets.reduce(
      (sum, m) => sum + BigInt(m.totalVolume),
      BigInt(0)
    );
    return { ...event, totalVolume };
  });
}
