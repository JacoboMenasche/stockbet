import { db } from "@/lib/db";
import { MetricType, MarketStatus } from "@prisma/client";
import { seedMarket } from "@/lib/matching-engine";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns true if the current time is after 4:00 PM ET (market close).
 */
export function isAfterMarketClose(): boolean {
  const now = new Date();
  // Convert to US/Eastern time
  const etStr = now.toLocaleString("en-US", { timeZone: "America/New_York" });
  const et = new Date(etStr);
  return et.getHours() >= 16;
}

function todayDate(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function roundTo(n: number, decimals: number): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

function buildMarketQuestion(
  companyName: string,
  metric: MetricType,
  thresholdLabel: string
): string {
  switch (metric) {
    case MetricType.PRICE_DIRECTION:
      return `Will ${companyName} close higher than it opened today?`;
    case MetricType.PRICE_TARGET:
      return `Will ${companyName} close at or above ${thresholdLabel} today?`;
    case MetricType.PERCENTAGE_MOVE: {
      const pct = thresholdLabel.replace(/^>/, "").trim();
      return `Will ${companyName} move more than ${pct} today?`;
    }
    default:
      return `Will ${companyName} meet the ${thresholdLabel} target today?`;
  }
}

// ─── Phase 1: PRICE_DIRECTION market ─────────────────────────────────────────

export async function createPhase1Markets(): Promise<void> {
  const today = todayDate();
  const companies = await db.company.findMany();

  for (const company of companies) {
    const existing = await db.market.findFirst({
      where: {
        companyId: company.id,
        betDate: today,
        metricType: MetricType.PRICE_DIRECTION,
      },
    });
    if (existing) {
      console.log(
        `[create-daily-markets] ${company.ticker}: PRICE_DIRECTION already exists — skipping`
      );
      continue;
    }

    const question = buildMarketQuestion(company.name, MetricType.PRICE_DIRECTION, "Up/Down");

    const market = await db.market.create({
      data: {
        companyId: company.id,
        earningsEventId: null,
        question,
        metricType: MetricType.PRICE_DIRECTION,
        threshold: 0,
        thresholdLabel: "Up/Down",
        status: MarketStatus.OPEN,
        betDate: today,
        yesPriceLatest: 50,
        noPriceLatest: 50,
      },
    });
    await seedMarket(market.id);
    console.log(
      `[create-daily-markets] ${company.ticker}: created PRICE_DIRECTION (id=${market.id})`
    );
  }
}

// ─── Phase 2: PRICE_TARGET and PERCENTAGE_MOVE markets ───────────────────────

export async function createPhase2Markets(): Promise<void> {
  const today = todayDate();
  const companies = await db.company.findMany();

  for (const company of companies) {
    const latestPrice = await db.stockPriceCache.findFirst({
      where: { companyId: company.id },
      orderBy: { date: "desc" },
    });

    if (!latestPrice) {
      console.warn(
        `[create-daily-markets] ${company.ticker}: no price data — skipping phase 2 markets`
      );
      continue;
    }

    const prevClose = Number(latestPrice.close);
    const targetPrice = roundTo(prevClose * 1.03, 2);
    const targetLabel = `$${targetPrice.toFixed(2)}`;

    // PRICE_TARGET
    const existingTarget = await db.market.findFirst({
      where: {
        companyId: company.id,
        betDate: today,
        metricType: MetricType.PRICE_TARGET,
      },
    });
    if (existingTarget) {
      console.log(
        `[create-daily-markets] ${company.ticker}: PRICE_TARGET already exists — skipping`
      );
    } else {
      const question = buildMarketQuestion(company.name, MetricType.PRICE_TARGET, targetLabel);
      const market = await db.market.create({
        data: {
          companyId: company.id,
          earningsEventId: null,
          question,
          metricType: MetricType.PRICE_TARGET,
          threshold: targetPrice,
          thresholdLabel: targetLabel,
          status: MarketStatus.OPEN,
          betDate: today,
          yesPriceLatest: 50,
          noPriceLatest: 50,
        },
      });
      await seedMarket(market.id);
      console.log(
        `[create-daily-markets] ${company.ticker}: created PRICE_TARGET (id=${market.id})`
      );
    }

    // PERCENTAGE_MOVE
    const existingPct = await db.market.findFirst({
      where: {
        companyId: company.id,
        betDate: today,
        metricType: MetricType.PERCENTAGE_MOVE,
      },
    });
    if (existingPct) {
      console.log(
        `[create-daily-markets] ${company.ticker}: PERCENTAGE_MOVE already exists — skipping`
      );
    } else {
      const question = buildMarketQuestion(company.name, MetricType.PERCENTAGE_MOVE, ">2%");
      const market = await db.market.create({
        data: {
          companyId: company.id,
          earningsEventId: null,
          question,
          metricType: MetricType.PERCENTAGE_MOVE,
          threshold: 2,
          thresholdLabel: ">2%",
          status: MarketStatus.OPEN,
          betDate: today,
          yesPriceLatest: 50,
          noPriceLatest: 50,
        },
      });
      await seedMarket(market.id);
      console.log(
        `[create-daily-markets] ${company.ticker}: created PERCENTAGE_MOVE (id=${market.id})`
      );
    }
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function createDailyMarkets(): Promise<void> {
  console.log("[create-daily-markets] Starting daily market creation...");
  await createPhase1Markets();
  await createPhase2Markets();
  console.log("[create-daily-markets] Done.");
}
