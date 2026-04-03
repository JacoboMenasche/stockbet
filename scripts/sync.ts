import "dotenv/config";
import { PrismaClient, MarketStatus, MetricType, ReleaseTime } from "@prisma/client";
import {
  fetchEarningsCalendar,
  fetchIncomeStatements,
  fetchHistoricalPrices,
} from "./fmp";
import { buildMarketQuestion } from "./lib/market-helpers";

const db = new PrismaClient();

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function roundTo(n: number, decimals: number): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}

async function syncCompany(ticker: string) {
  const company = await db.company.findUnique({ where: { ticker } });
  if (!company) {
    console.warn(`[sync] Company ${ticker} not in DB — skipping`);
    return;
  }

  // 1. Earnings calendar (next 90 days)
  const today = new Date();
  const ninetyDaysOut = new Date(today);
  ninetyDaysOut.setDate(today.getDate() + 90);
  const calendar = await fetchEarningsCalendar(formatDate(today), formatDate(ninetyDaysOut));
  const entry = calendar.find((e) => e.symbol === ticker);

  // 3. Stock price cache (90 days) — always run regardless of earnings
  const prices = await fetchHistoricalPrices(ticker, 90);
  for (const p of prices) {
    await db.stockPriceCache.upsert({
      where: { companyId_date: { companyId: company.id, date: new Date(p.date) } },
      update: { open: p.open, high: p.high, low: p.low, close: p.close, volume: p.volume },
      create: {
        companyId: company.id,
        date: new Date(p.date),
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        volume: p.volume,
      },
    });
  }
  console.log(`[sync] Cached ${prices.length} price points for ${ticker}`);

  if (!entry) {
    console.log(`[sync] No upcoming earnings for ${ticker}`);
    return;
  }

  const reportDate = new Date(entry.date + "T20:00:00Z"); // 4pm ET as UTC
  // FMP stable API does not expose pre/post market time — default to POST_MARKET
  // Update manually in DB if a company reports pre-market
  const releaseTime = ReleaseTime.POST_MARKET;
  const quarter = `Q${Math.ceil((reportDate.getMonth() + 1) / 3)}-${reportDate.getFullYear()}`;

  const event = await db.earningsEvent.upsert({
    where: { companyId_quarter: { companyId: company.id, quarter } },
    update: { reportDate, releaseTime, isConfirmed: true },
    create: { companyId: company.id, quarter, reportDate, releaseTime, isConfirmed: true },
  });

  // 2. Income statements → margin and EPS thresholds (last 4 annual reports)
  const statements = await fetchIncomeStatements(ticker, 4);
  if (statements.length === 0) {
    console.warn(`[sync] No income statements for ${ticker}`);
    return;
  }

  // Calculate ratios (stable API doesn't return pre-computed ratios)
  const avgGrossMargin =
    statements.reduce((s, r) => s + (r.grossProfit / r.revenue) * 100, 0) / statements.length;
  const avgOpMargin =
    statements.reduce((s, r) => s + (r.operatingIncome / r.revenue) * 100, 0) / statements.length;

  // EPS: use most recent annual as threshold baseline
  const latestEps = statements[0]?.eps ?? null;

  // Revenue growth: YoY from last two annual reports
  const revenueGrowthThreshold =
    statements.length >= 2 && statements[1].revenue > 0
      ? roundTo(((statements[0].revenue - statements[1].revenue) / statements[1].revenue) * 100, 1)
      : null;

  type MarketDef = {
    metricType: MetricType;
    threshold: number;
    thresholdLabel: string;
  };

  const marketDefs: MarketDef[] = [];

  if (latestEps) {
    const t = roundTo(latestEps, 2);
    marketDefs.push({ metricType: MetricType.EPS, threshold: t, thresholdLabel: `> $${t}` });
  }
  if (avgGrossMargin) {
    const t = roundTo(avgGrossMargin, 1);
    marketDefs.push({ metricType: MetricType.GROSS_MARGIN, threshold: t, thresholdLabel: `> ${t}%` });
  }
  if (avgOpMargin) {
    const t = roundTo(avgOpMargin, 1);
    marketDefs.push({ metricType: MetricType.OPERATING_MARGIN, threshold: t, thresholdLabel: `> ${t}%` });
  }
  if (revenueGrowthThreshold !== null) {
    marketDefs.push({
      metricType: MetricType.REVENUE_GROWTH,
      threshold: revenueGrowthThreshold,
      thresholdLabel: `> ${revenueGrowthThreshold}%`,
    });
  }

  for (const def of marketDefs) {
    const existing = await db.market.findFirst({
      where: { earningsEventId: event.id, metricType: def.metricType },
    });
    if (!existing) {
      await db.market.create({
        data: {
          companyId: company.id,
          earningsEventId: event.id,
          question: buildMarketQuestion(company.name, def.metricType, def.thresholdLabel),
          metricType: def.metricType,
          threshold: def.threshold,
          thresholdLabel: def.thresholdLabel,
          status: MarketStatus.OPEN,
          consensusEstimate: def.thresholdLabel.replace(/^> /, ""),
        },
      });
      console.log(`[sync] Created market: ${ticker} ${def.metricType} ${def.thresholdLabel}`);
    }
  }

}

async function main() {
  const companies = await db.company.findMany({ select: { ticker: true } });
  console.log(`[sync] Syncing ${companies.length} companies...`);
  for (const c of companies) {
    try {
      await syncCompany(c.ticker);
    } catch (err) {
      console.error(`[sync] Error syncing ${c.ticker}:`, err);
    }
  }
  console.log("[sync] Done.");
}

main().finally(() => db.$disconnect());
