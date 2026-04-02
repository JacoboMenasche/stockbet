import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";

export type CompanyDetail = Awaited<ReturnType<typeof getCompanyDetail>>;

export async function getCompanyDetail(ticker: string) {
  return db.company.findUniqueOrThrow({
    where: { ticker: ticker.toUpperCase() },
    include: {
      stockPrices: {
        orderBy: { date: "asc" },
        select: { date: true, close: true },
        take: 90,
      },
      earningsEvents: {
        where: { reportDate: { gte: new Date() } },
        orderBy: { reportDate: "asc" },
        take: 1,
        include: {
          markets: {
            where: { status: MarketStatus.OPEN },
            orderBy: { volume24h: "desc" },
            select: {
              id: true,
              question: true,
              metricType: true,
              thresholdLabel: true,
              yesPriceLatest: true,
              noPriceLatest: true,
              volume24h: true,
              consensusEstimate: true,
              analystRangeLow: true,
              analystRangeHigh: true,
            },
          },
        },
      },
    },
  });
}
