// src/lib/create-earnings-markets.ts
import { db } from "@/lib/db";
import { MetricType, MarketStatus, ReleaseTime } from "@prisma/client";
import { fetchAnalystEstimates, getQuarterlyEstimate, formatLargeNumber } from "@/lib/fmp";
import { seedMarket } from "@/lib/matching-engine";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Computes the UTC timestamp at which a fundamental market should close,
 * based on the earnings release time (PRE_MARKET = 9:25 AM ET, POST_MARKET = 3:55 PM ET).
 * Handles DST correctly by probing the actual ET offset on the target date.
 */
export function computeEarningsCloseAt(reportDate: Date, releaseTime: ReleaseTime): Date {
  const closeHour = releaseTime === ReleaseTime.PRE_MARKET ? 9 : 15;
  const closeMinute = releaseTime === ReleaseTime.PRE_MARKET ? 25 : 55;

  // Get "YYYY-MM-DD" in ET (en-CA locale uses ISO date format)
  const etDateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(reportDate); // e.g. "2026-04-16"

  // Probe the ET offset on this date by comparing a naive UTC candidate against ET
  const naiveUTC = new Date(`${etDateStr}T${String(closeHour).padStart(2, "0")}:${String(closeMinute).padStart(2, "0")}:00Z`);
  const etAtNaive = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(naiveUTC);

  const etHour = Number(etAtNaive.find((p) => p.type === "hour")!.value);
  const etMinute = Number(etAtNaive.find((p) => p.type === "minute")!.value);
  const diffMs = ((closeHour - etHour) * 60 + (closeMinute - etMinute)) * 60_000;

  return new Date(naiveUTC.getTime() + diffMs);
}

// ─── Market creation ─────────────────────────────────────────────────────────

export const FUNDAMENTAL_METRICS: MetricType[] = [
  MetricType.EPS_BEAT,
  MetricType.REVENUE_BEAT,
  MetricType.NET_INCOME_BEAT,
  MetricType.EBITDA_BEAT,
];

function buildFundamentalQuestion(
  companyName: string,
  metric: MetricType,
  thresholdLabel: string
): string {
  switch (metric) {
    case MetricType.EPS_BEAT:
      return `Will ${companyName} beat EPS consensus of ${thresholdLabel} this quarter?`;
    case MetricType.REVENUE_BEAT:
      return `Will ${companyName} beat revenue consensus of ${thresholdLabel} this quarter?`;
    case MetricType.NET_INCOME_BEAT:
      return `Will ${companyName} beat net income consensus of ${thresholdLabel} this quarter?`;
    case MetricType.EBITDA_BEAT:
      return `Will ${companyName} beat EBITDA consensus of ${thresholdLabel} this quarter?`;
    default:
      throw new Error(`buildFundamentalQuestion: unexpected metric ${metric}`);
  }
}

function getThresholdForMetric(
  metric: MetricType,
  estimates: { epsAvg: number; revenueAvg: number; netIncomeAvg: number; ebitdaAvg: number },
  calendarEstimates: { epsEstimate: number | null; revenueEstimate: number | null }
): number {
  switch (metric) {
    case MetricType.EPS_BEAT:
      return calendarEstimates.epsEstimate ?? getQuarterlyEstimate(estimates.epsAvg);
    case MetricType.REVENUE_BEAT:
      return calendarEstimates.revenueEstimate ?? getQuarterlyEstimate(estimates.revenueAvg);
    case MetricType.NET_INCOME_BEAT: return getQuarterlyEstimate(estimates.netIncomeAvg);
    case MetricType.EBITDA_BEAT:     return getQuarterlyEstimate(estimates.ebitdaAvg);
    default:
      throw new Error(`getThresholdForMetric: unexpected metric ${metric}`);
  }
}

function formatThresholdLabel(metric: MetricType, threshold: number): string {
  if (metric === MetricType.EPS_BEAT) return `$${threshold.toFixed(2)}`;
  return formatLargeNumber(threshold);
}

/**
 * Creates the four fundamental beat/miss markets for an earnings event.
 * Skips silently if any market type already exists for this event.
 */
export async function createEarningsMarketsForEvent(earningsEventId: string): Promise<void> {
  const event = await db.earningsEvent.findUnique({
    where: { id: earningsEventId },
    include: { company: true },
  });
  if (!event) throw new Error(`EarningsEvent ${earningsEventId} not found`);

  const { company, reportDate, releaseTime } = event;
  const earningsCloseAt = computeEarningsCloseAt(reportDate, releaseTime);
  const betDate = new Date(reportDate);
  betDate.setUTCHours(0, 0, 0, 0);

  // Fetch annual estimates from FMP (net income + EBITDA fallback; annualAvg / 4)
  const estimates = await fetchAnalystEstimates(company.ticker);
  if (!estimates) {
    console.warn(`[create-earnings-markets] No estimates for ${company.ticker} — skipping`);
    return;
  }

  // Real near-term estimates from earnings calendar (stored during sync)
  const calendarEstimates = {
    epsEstimate: event.epsEstimate ? Number(event.epsEstimate) : null,
    revenueEstimate: event.revenueEstimate ? Number(event.revenueEstimate) : null,
  };

  for (const metric of FUNDAMENTAL_METRICS) {
    const existing = await db.market.findFirst({
      where: { earningsEventId, metricType: metric },
    });
    if (existing) {
      console.log(`[create-earnings-markets] ${company.ticker} ${metric} already exists — skipping`);
      continue;
    }

    const threshold = getThresholdForMetric(metric, estimates, calendarEstimates);
    const thresholdLabel = formatThresholdLabel(metric, threshold);
    const question = buildFundamentalQuestion(company.name, metric, thresholdLabel);

    const market = await db.market.create({
      data: {
        companyId: company.id,
        earningsEventId,
        question,
        metricType: metric,
        threshold,
        thresholdLabel,
        consensusEstimate: thresholdLabel,
        status: MarketStatus.OPEN,
        betDate,
        earningsCloseAt,
        yesPriceLatest: 50,
        noPriceLatest: 50,
      },
    });

    await seedMarket(market.id);
    console.log(
      `[create-earnings-markets] ${company.ticker}: created ${metric} threshold=${thresholdLabel} closeAt=${earningsCloseAt.toISOString()}`
    );
  }
}
