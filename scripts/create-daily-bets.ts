import "dotenv/config";
import { PrismaClient, MetricType, MarketStatus } from "@prisma/client";
import { buildMarketQuestion } from "./lib/market-helpers";

const db = new PrismaClient();

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function roundTo(n: number, decimals: number): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

async function createDailyBets() {
  const today = todayDate();
  console.log(`[create-daily-bets] Creating bets for ${today.toISOString().split("T")[0]}`);

  const companies = await db.company.findMany();

  for (const company of companies) {
    // Check if bets already exist for today (idempotent)
    const existing = await db.market.findFirst({
      where: { companyId: company.id, betDate: today },
    });
    if (existing) {
      console.log(`[create-daily-bets] ${company.ticker}: already has bets for today — skipping`);
      continue;
    }

    // Get most recent closing price
    const latestPrice = await db.stockPriceCache.findFirst({
      where: { companyId: company.id },
      orderBy: { date: "desc" },
    });

    if (!latestPrice) {
      console.warn(`[create-daily-bets] ${company.ticker}: no price data — skipping`);
      continue;
    }

    const prevClose = Number(latestPrice.close);
    const targetPrice = roundTo(prevClose * 1.03, 2);

    const bets: {
      metricType: MetricType;
      threshold: number;
      thresholdLabel: string;
    }[] = [
      {
        metricType: MetricType.PRICE_DIRECTION,
        threshold: 0,
        thresholdLabel: "Up/Down",
      },
      {
        metricType: MetricType.PRICE_TARGET,
        threshold: targetPrice,
        thresholdLabel: `$${targetPrice.toFixed(2)}`,
      },
      {
        metricType: MetricType.PERCENTAGE_MOVE,
        threshold: 2,
        thresholdLabel: ">2%",
      },
    ];

    for (const bet of bets) {
      const question = buildMarketQuestion(company.name, bet.metricType, bet.thresholdLabel);
      await db.market.create({
        data: {
          companyId: company.id,
          earningsEventId: null,
          question,
          metricType: bet.metricType,
          threshold: bet.threshold,
          thresholdLabel: bet.thresholdLabel,
          status: MarketStatus.OPEN,
          betDate: today,
        },
      });
      console.log(`[create-daily-bets] ${company.ticker}: created ${bet.metricType}`);
    }
  }

  console.log("[create-daily-bets] Done.");
}

createDailyBets().finally(() => db.$disconnect());
