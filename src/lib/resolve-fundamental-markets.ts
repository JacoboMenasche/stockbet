// src/lib/resolve-fundamental-markets.ts
import { db } from "@/lib/db";
import { MetricType, MarketStatus, Side } from "@prisma/client";
import { fetchIncomeStatement } from "@/lib/fmp";
import { resolveMarket } from "@/lib/resolve-markets";
import { FUNDAMENTAL_METRICS } from "@/lib/create-earnings-markets";

const MANUAL_REVIEW_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Maps a MetricType to the actual value from the income statement row. */
function getActualValue(
  metric: MetricType,
  row: { revenue: number; netIncome: number; ebitda: number; epsDiluted: number }
): number {
  switch (metric) {
    case MetricType.EPS_BEAT:        return row.epsDiluted;
    case MetricType.REVENUE_BEAT:    return row.revenue;
    case MetricType.NET_INCOME_BEAT: return row.netIncome;
    case MetricType.EBITDA_BEAT:     return row.ebitda;
    default:
      throw new Error(`getActualValue: unexpected metric ${metric}`);
  }
}

/** Formats the actual value for display in the resolution label. */
function formatActualLabel(metric: MetricType, actual: number): string {
  if (metric === MetricType.EPS_BEAT) return `$${actual.toFixed(2)}`;
  if (Math.abs(actual) >= 1_000_000_000) return `$${(actual / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(actual) >= 1_000_000) return `$${(actual / 1_000_000).toFixed(1)}M`;
  return `$${actual.toFixed(2)}`;
}

/**
 * Checks whether the income statement row is fresh enough to resolve against.
 * The period-end date must be within 120 days before the expected report date.
 */
function isRowFresh(rowDate: string, reportDate: Date): boolean {
  const periodEnd = new Date(rowDate);
  const diffMs = reportDate.getTime() - periodEnd.getTime();
  return diffMs >= 0 && diffMs <= 120 * 24 * 60 * 60 * 1000;
}

/**
 * Resolves all CLOSED fundamental markets whose actuals are available in FMP.
 * Markets that have been CLOSED for more than 24h without actuals are flagged
 * for manual review via a warning log.
 */
export async function resolveFundamentalMarkets(): Promise<{ resolved: number; skipped: number; pending: number; manualReview: number }> {
  const closedMarkets = await db.market.findMany({
    where: {
      status: MarketStatus.CLOSED,
      metricType: { in: FUNDAMENTAL_METRICS },
    },
    include: {
      company: { select: { ticker: true } },
      earningsEvent: { select: { reportDate: true } },
    },
  });

  if (closedMarkets.length === 0) return { resolved: 0, skipped: 0, pending: 0, manualReview: 0 };

  console.log(`[resolve-fundamental] Found ${closedMarkets.length} CLOSED fundamental markets`);

  // Group by ticker to minimize FMP calls
  const byTicker = new Map<string, typeof closedMarkets>();
  for (const m of closedMarkets) {
    const list = byTicker.get(m.company.ticker) ?? [];
    list.push(m);
    byTicker.set(m.company.ticker, list);
  }

  let resolved = 0;
  let skipped = 0;
  let pending = 0;
  let manualReview = 0;

  for (const [ticker, markets] of byTicker) {
    let row;
    try {
      row = await fetchIncomeStatement(ticker);
    } catch (err) {
      console.error(`[resolve-fundamental] Failed to fetch income statement for ${ticker}:`, err);
      skipped += markets.length;
      continue;
    }

    for (const market of markets) {
      if (!market.earningsEvent) {
        console.warn(
          `[resolve-fundamental] market=${market.id} has no earningsEvent — skipping`
        );
        skipped++;
        continue;
      }

      const reportDate = market.earningsEvent.reportDate;
      const dataAvailable = !!row && isRowFresh(row.date, reportDate);

      if (!dataAvailable) {
        // Data not available yet — check if we've been waiting too long
        if (
          market.earningsCloseAt &&
          Date.now() - market.earningsCloseAt.getTime() > MANUAL_REVIEW_AFTER_MS
        ) {
          console.warn(
            `[resolve-fundamental] MANUAL_REVIEW_REQUIRED market=${market.id} ticker=${ticker} metric=${market.metricType}`
          );
          manualReview++;
        } else {
          console.log(`[resolve-fundamental] No fresh income statement yet for ${ticker} — will retry`);
          pending++;
        }
        continue;
      }

      // Data is fresh — resolve regardless of elapsed time
      try {
        const actual = getActualValue(market.metricType, row!);
        const threshold = Number(market.threshold);
        const winningSide: Side = actual > threshold ? Side.YES : Side.NO;
        const actualLabel = formatActualLabel(market.metricType, actual);

        await resolveMarket(market.id, winningSide, actual, actualLabel);
        resolved++;
        console.log(
          `[resolve-fundamental] ${ticker} ${market.metricType} actual=${actualLabel} threshold=${market.thresholdLabel} → ${winningSide}`
        );
      } catch (err) {
        console.error(`[resolve-fundamental] Failed to resolve market ${market.id}:`, err);
        skipped++;
      }
    }
  }

  return { resolved, skipped, pending, manualReview };
}
