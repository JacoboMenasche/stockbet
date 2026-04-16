# Earnings Fundamental Markets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four earnings beat/miss market types (`EPS_BEAT`, `REVENUE_BEAT`, `NET_INCOME_BEAT`, `EBITDA_BEAT`) that auto-resolve same-day by comparing FMP quarterly actuals against consensus estimates.

**Architecture:** Fundamental markets are created per `EarningsEvent`, stay OPEN until `earningsCloseAt`, flip to CLOSED via a new `close-markets` cron, then resolve via a new `resolve-fundamental-markets` cron that polls FMP income statement actuals. The existing price-market pipeline is untouched. Payouts reuse the exported `resolveMarket` function from `resolve-markets.ts`.

**Tech Stack:** Prisma (PostgreSQL), Next.js API routes, FMP `/stable/income-statement` + `/stable/analyst-estimates`, Vitest

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `prisma/schema.prisma` | Add 4 MetricType values + `earningsCloseAt` on Market |
| New migration | `prisma/migrations/20260416000000_add_earnings_fundamental_markets/` | Schema diff |
| Modify | `src/lib/fmp.ts` | Add `fetchIncomeStatement`, `getQuarterlyEstimate`, `formatLargeNumber` |
| Modify | `src/lib/resolve-markets.ts` | Export `resolveMarket`; add default to exhaustive switch |
| Modify | `src/lib/metricLabel.ts` | Add 4 new labels |
| New | `src/lib/create-earnings-markets.ts` | `createEarningsMarketsForEvent`, `computeEarningsCloseAt` |
| New | `src/lib/resolve-fundamental-markets.ts` | `resolveFundamentalMarkets` |
| New | `src/app/api/cron/close-markets/route.ts` | POST cron: flip OPEN→CLOSED, cancel orders |
| New | `src/app/api/cron/resolve-fundamental-markets/route.ts` | POST cron: resolve CLOSED fundamental markets |
| New | `src/lib/__tests__/earnings-markets.test.ts` | Unit tests for all pure functions |

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new MetricType values and earningsCloseAt field**

In `prisma/schema.prisma`, replace:
```prisma
enum MetricType {
  PRICE_DIRECTION
  PRICE_TARGET
  PERCENTAGE_MOVE
}
```
with:
```prisma
enum MetricType {
  PRICE_DIRECTION
  PRICE_TARGET
  PERCENTAGE_MOVE
  EPS_BEAT
  REVENUE_BEAT
  NET_INCOME_BEAT
  EBITDA_BEAT
}
```

And in the `Market` model, add after `betDate`:
```prisma
earningsCloseAt  DateTime?   // null for price markets; close cutoff for fundamental markets
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_earnings_fundamental_markets
```

Expected: new migration folder created, `prisma generate` runs automatically.

- [ ] **Step 3: Confirm schema compiles**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors). TypeScript will flag the exhaustive switch in `resolve-markets.ts` — that's expected and fixed in Task 4.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add earnings fundamental MetricTypes and earningsCloseAt to Market"
```

---

## Task 2: Write failing tests for pure functions

**Files:**
- Create: `src/lib/__tests__/earnings-markets.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/lib/__tests__/earnings-markets.test.ts
import { describe, it, expect } from "vitest";
import { getQuarterlyEstimate, formatLargeNumber } from "@/lib/fmp";
import { computeEarningsCloseAt } from "@/lib/create-earnings-markets";
import { ReleaseTime } from "@prisma/client";

describe("getQuarterlyEstimate", () => {
  it("divides annual avg by 4", () => {
    expect(getQuarterlyEstimate(400_000_000_000)).toBeCloseTo(100_000_000_000);
  });

  it("handles EPS-scale numbers", () => {
    expect(getQuarterlyEstimate(7.38)).toBeCloseTo(1.845);
  });
});

describe("formatLargeNumber", () => {
  it("formats billions with B suffix", () => {
    expect(formatLargeNumber(94_300_000_000)).toBe("$94.3B");
  });

  it("formats millions with M suffix", () => {
    expect(formatLargeNumber(450_000_000)).toBe("$450.0M");
  });

  it("formats small numbers as dollars", () => {
    expect(formatLargeNumber(1.845)).toBe("$1.85");
  });
});

describe("computeEarningsCloseAt", () => {
  it("PRE_MARKET: returns 9:25 AM ET on reportDate day", () => {
    // April 16 2026 — EDT (UTC-4)
    const reportDate = new Date("2026-04-16T20:00:00Z"); // 4 PM ET
    const result = computeEarningsCloseAt(reportDate, ReleaseTime.PRE_MARKET);
    // 9:25 AM EDT = 13:25 UTC
    expect(result.toISOString()).toBe("2026-04-16T13:25:00.000Z");
  });

  it("POST_MARKET: returns 3:55 PM ET on reportDate day", () => {
    // April 16 2026 — EDT (UTC-4)
    const reportDate = new Date("2026-04-16T20:00:00Z");
    const result = computeEarningsCloseAt(reportDate, ReleaseTime.POST_MARKET);
    // 3:55 PM EDT = 19:55 UTC
    expect(result.toISOString()).toBe("2026-04-16T19:55:00.000Z");
  });

  it("handles EST (winter — UTC-5)", () => {
    // Jan 16 2026 — EST
    const reportDate = new Date("2026-01-16T20:00:00Z");
    const result = computeEarningsCloseAt(reportDate, ReleaseTime.PRE_MARKET);
    // 9:25 AM EST = 14:25 UTC
    expect(result.toISOString()).toBe("2026-01-16T14:25:00.000Z");
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/__tests__/earnings-markets.test.ts
```

Expected: FAIL — `getQuarterlyEstimate`, `formatLargeNumber`, `computeEarningsCloseAt` not yet defined.

---

## Task 3: FMP helpers

**Files:**
- Modify: `src/lib/fmp.ts`

- [ ] **Step 1: Add types and helpers to fmp.ts**

Append to `src/lib/fmp.ts`:

```typescript
// ─── Quarterly estimate proxy ─────────────────────────────────────────────────

/**
 * Derives a quarterly consensus estimate from an annual average.
 * Replace the body when FMP quarterly estimates become available on the plan.
 */
export function getQuarterlyEstimate(annualAvg: number): number {
  return annualAvg / 4;
}

/**
 * Formats a large dollar number for display.
 * >= 1B → "$94.3B", >= 1M → "$450.0M", else → "$1.85"
 */
export function formatLargeNumber(value: number): string {
  if (Math.abs(value) >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  return `$${value.toFixed(2)}`;
}

// ─── Income statement ─────────────────────────────────────────────────────────

export interface IncomeStatementRow {
  date: string;         // period end date e.g. "2025-12-28"
  symbol: string;
  revenue: number;
  netIncome: number;
  ebitda: number;
  eps: number;
  epsDiluted: number;
}

/**
 * Fetches the most recent quarterly income statement row for a ticker.
 * Returns null if FMP has no data or the response is not an array.
 */
export async function fetchIncomeStatement(ticker: string): Promise<IncomeStatementRow | null> {
  const url = `${FMP_BASE}/income-statement?symbol=${ticker}&period=quarterly&limit=1&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    const msg = (body as Record<string, unknown>)?.["Error Message"] ?? JSON.stringify(body);
    throw new Error(`FMP unexpected response: ${msg}`);
  }
  if (body.length === 0) return null;
  return body[0] as IncomeStatementRow;
}
```

- [ ] **Step 2: Run the tests — getQuarterlyEstimate and formatLargeNumber should pass**

```bash
npx vitest run src/lib/__tests__/earnings-markets.test.ts
```

Expected: `getQuarterlyEstimate` and `formatLargeNumber` tests PASS; `computeEarningsCloseAt` tests still FAIL.

- [ ] **Step 3: Commit**

```bash
git add src/lib/fmp.ts src/lib/__tests__/earnings-markets.test.ts
git commit -m "feat: add getQuarterlyEstimate, formatLargeNumber, fetchIncomeStatement to fmp"
```

---

## Task 4: Fix exhaustive switch + export resolveMarket + update metricLabel

**Files:**
- Modify: `src/lib/resolve-markets.ts`
- Modify: `src/lib/metricLabel.ts`

- [ ] **Step 1: Export resolveMarket and add default to determineWinner switch**

In `src/lib/resolve-markets.ts`:

Change `async function resolveMarket(` to `export async function resolveMarket(`.

In `determineWinner`, add a default case after the `PRICE_TARGET` case:

```typescript
    case MetricType.PRICE_TARGET: {
      const won = quote.price >= threshold;
      return {
        winningSide: won ? Side.YES : Side.NO,
        actualValue: quote.price,
        actualLabel: `$${quote.price.toFixed(2)}`,
      };
    }
    default:
      throw new Error(`determineWinner: MetricType ${metricType} is not a price metric`);
```

- [ ] **Step 2: Update metricLabel.ts**

Replace the entire file:

```typescript
import { MetricType } from "@prisma/client";

export function metricLabel(type: MetricType): string {
  switch (type) {
    case MetricType.PRICE_DIRECTION:  return "Price direction";
    case MetricType.PRICE_TARGET:     return "Price target";
    case MetricType.PERCENTAGE_MOVE:  return "Percentage move";
    case MetricType.EPS_BEAT:         return "EPS beat";
    case MetricType.REVENUE_BEAT:     return "Revenue beat";
    case MetricType.NET_INCOME_BEAT:  return "Net income beat";
    case MetricType.EBITDA_BEAT:      return "EBITDA beat";
  }
}
```

- [ ] **Step 3: Confirm TypeScript is clean**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/lib/resolve-markets.ts src/lib/metricLabel.ts
git commit -m "feat: export resolveMarket, fix exhaustive MetricType switch, add fundamental metric labels"
```

---

## Task 5: create-earnings-markets.ts

**Files:**
- Create: `src/lib/create-earnings-markets.ts`

- [ ] **Step 1: Create the file**

```typescript
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

const FUNDAMENTAL_METRICS: MetricType[] = [
  MetricType.EPS_BEAT,
  MetricType.REVENUE_BEAT,
  MetricType.NET_INCOME_BEAT,
  MetricType.EBITDA_BEAT,
];

function isFundamentalMetric(type: MetricType): boolean {
  return FUNDAMENTAL_METRICS.includes(type);
}

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
  estimates: { epsAvg: number; revenueAvg: number; netIncomeAvg: number; ebitdaAvg: number }
): number {
  switch (metric) {
    case MetricType.EPS_BEAT:        return getQuarterlyEstimate(estimates.epsAvg);
    case MetricType.REVENUE_BEAT:    return getQuarterlyEstimate(estimates.revenueAvg);
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

  // Fetch annual estimates from FMP (quarterly locked behind premium; use annualAvg / 4)
  const estimates = await fetchAnalystEstimates(company.ticker);
  if (!estimates) {
    console.warn(`[create-earnings-markets] No estimates for ${company.ticker} — skipping`);
    return;
  }

  for (const metric of FUNDAMENTAL_METRICS) {
    const existing = await db.market.findFirst({
      where: { earningsEventId, metricType: metric },
    });
    if (existing) {
      console.log(`[create-earnings-markets] ${company.ticker} ${metric} already exists — skipping`);
      continue;
    }

    const threshold = getThresholdForMetric(metric, estimates);
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

export { isFundamentalMetric, FUNDAMENTAL_METRICS };
```

- [ ] **Step 2: Add fetchAnalystEstimates to fmp.ts**

Append to `src/lib/fmp.ts`:

```typescript
export interface AnalystEstimatesRow {
  symbol: string;
  date: string;
  epsAvg: number;
  revenueAvg: number;
  netIncomeAvg: number;
  ebitdaAvg: number;
}

/**
 * Fetches the most recent annual analyst estimates row for a ticker.
 * Returns null if no data is available.
 */
export async function fetchAnalystEstimates(ticker: string): Promise<AnalystEstimatesRow | null> {
  const url = `${FMP_BASE}/analyst-estimates?symbol=${ticker}&period=annual&limit=1&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const body: unknown = await res.json();
  if (!Array.isArray(body)) {
    const msg = (body as Record<string, unknown>)?.["Error Message"] ?? JSON.stringify(body);
    throw new Error(`FMP unexpected response: ${msg}`);
  }
  if (body.length === 0) return null;
  return body[0] as AnalystEstimatesRow;
}
```

- [ ] **Step 3: Run tests — computeEarningsCloseAt should now pass**

```bash
npx vitest run src/lib/__tests__/earnings-markets.test.ts
```

Expected: all tests PASS.

- [ ] **Step 4: Confirm TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/lib/create-earnings-markets.ts src/lib/fmp.ts
git commit -m "feat: add createEarningsMarketsForEvent and FMP analyst-estimates helper"
```

---

## Task 6: resolve-fundamental-markets.ts

**Files:**
- Create: `src/lib/resolve-fundamental-markets.ts`

- [ ] **Step 1: Create the file**

```typescript
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
export async function resolveFundamentalMarkets(): Promise<{ resolved: number; skipped: number; pending: number }> {
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

  if (closedMarkets.length === 0) return { resolved: 0, skipped: 0, pending: 0 };

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
      // 24-hour manual review flag
      if (
        market.earningsCloseAt &&
        Date.now() - market.earningsCloseAt.getTime() > MANUAL_REVIEW_AFTER_MS
      ) {
        console.warn(
          `[resolve-fundamental] MANUAL_REVIEW_REQUIRED market=${market.id} ticker=${ticker} metric=${market.metricType}`
        );
        pending++;
        continue;
      }

      if (!row) {
        console.log(`[resolve-fundamental] No income statement yet for ${ticker} — will retry`);
        pending++;
        continue;
      }

      const reportDate = market.earningsEvent?.reportDate;
      if (!reportDate || !isRowFresh(row.date, reportDate)) {
        console.log(
          `[resolve-fundamental] Stale income statement for ${ticker} (row.date=${row.date}) — will retry`
        );
        pending++;
        continue;
      }

      try {
        const actual = getActualValue(market.metricType, row);
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

  return { resolved, skipped, pending };
}
```

- [ ] **Step 2: Confirm TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/resolve-fundamental-markets.ts
git commit -m "feat: add resolveFundamentalMarkets with FMP income statement actuals"
```

---

## Task 7: close-markets cron route

**Files:**
- Create: `src/app/api/cron/close-markets/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/cron/close-markets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { MarketStatus } from "@prisma/client";
import { cancelMarketOrders } from "@/lib/matching-engine";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron] Starting close-markets...");

    const now = new Date();

    const marketsToClose = await db.market.findMany({
      where: {
        status: MarketStatus.OPEN,
        earningsCloseAt: { lte: now },
      },
      select: { id: true },
    });

    console.log(`[cron] Found ${marketsToClose.length} markets to close`);

    let closed = 0;
    for (const { id } of marketsToClose) {
      try {
        // Cancel open orders first, then flip status
        await cancelMarketOrders(id);
        await db.market.update({
          where: { id },
          data: { status: MarketStatus.CLOSED },
        });
        closed++;
      } catch (err) {
        console.error(`[cron] Failed to close market ${id}:`, err);
      }
    }

    console.log(`[cron] close-markets complete. closed=${closed}`);
    return NextResponse.json({
      ok: true,
      job: "close-markets",
      ts: new Date().toISOString(),
      closed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] close-markets failed:", message, stack);
    return NextResponse.json({ error: "close-markets failed", detail: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Confirm TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/close-markets/route.ts
git commit -m "feat: add close-markets cron route"
```

---

## Task 8: resolve-fundamental-markets cron route

**Files:**
- Create: `src/app/api/cron/resolve-fundamental-markets/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// src/app/api/cron/resolve-fundamental-markets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { resolveFundamentalMarkets } from "@/lib/resolve-fundamental-markets";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron] Starting resolve-fundamental-markets...");
    const stats = await resolveFundamentalMarkets();
    console.log("[cron] resolve-fundamental-markets complete.", stats);
    return NextResponse.json({
      ok: true,
      job: "resolve-fundamental-markets",
      ts: new Date().toISOString(),
      ...stats,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[cron] resolve-fundamental-markets failed:", message, stack);
    return NextResponse.json({ error: "resolve-fundamental-markets failed", detail: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Confirm TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/resolve-fundamental-markets/route.ts
git commit -m "feat: add resolve-fundamental-markets cron route"
```

---

## Task 9: Wire create-earnings-markets into the create-markets cron

**Files:**
- Modify: `src/lib/create-daily-markets.ts`
- Modify: `src/app/api/cron/create-markets/route.ts`

The `createDailyMarkets` entry point should also trigger fundamental market creation for any `EarningsEvent` whose `reportDate` falls today.

- [ ] **Step 1: Add createFundamentalMarketsForToday to create-daily-markets.ts**

Add this import at the top of `src/lib/create-daily-markets.ts` alongside existing imports:

```typescript
import { createEarningsMarketsForEvent } from "@/lib/create-earnings-markets";
```

Then append this function at the bottom of the file:

```typescript
// ─── Phase 3: Fundamental markets for today's earnings events ────────────────

export async function createPhase3Markets(targetDate?: Date): Promise<void> {
  const today = targetDate ?? todayDate();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const events = await db.earningsEvent.findMany({
    where: {
      reportDate: { gte: today, lt: tomorrow },
      isConfirmed: true,
    },
    select: { id: true, company: { select: { ticker: true } } },
  });

  console.log(`[create-daily-markets] Found ${events.length} earnings events for today`);

  for (const event of events) {
    try {
      await createEarningsMarketsForEvent(event.id);
    } catch (err) {
      console.error(`[create-daily-markets] Failed to create fundamental markets for event ${event.id}:`, err);
    }
  }
}
```

- [ ] **Step 2: Call createPhase3Markets from createDailyMarkets**

In `createDailyMarkets`, update to:

```typescript
export async function createDailyMarkets(): Promise<void> {
  console.log("[create-daily-markets] Starting daily market creation...");
  await createPhase1Markets();
  await createPhase2Markets();
  await createPhase3Markets();
  console.log("[create-daily-markets] Done.");
}
```

- [ ] **Step 3: Confirm TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/create-daily-markets.ts
git commit -m "feat: wire createPhase3Markets into daily market creation for earnings events"
```

---

## Task 10: End-to-end smoke test

- [ ] **Step 1: Deploy to Vercel**

```bash
git push
```

Wait for deployment to complete (check `npx vercel ls`).

- [ ] **Step 2: Trigger create-markets and confirm output**

```bash
CRON_SECRET=$(grep CRON_SECRET .env | cut -d= -f2) && \
curl -s -X POST https://stockbets.vercel.app/api/cron/create-markets \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" -w "\nHTTP: %{http_code}\n"
```

Expected: `{"ok":true,"job":"create-markets",...}` with HTTP 200.

- [ ] **Step 3: Trigger close-markets and confirm output**

```bash
CRON_SECRET=$(grep CRON_SECRET .env | cut -d= -f2) && \
curl -s -X POST https://stockbets.vercel.app/api/cron/close-markets \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" -w "\nHTTP: %{http_code}\n"
```

Expected: `{"ok":true,"job":"close-markets","closed":0,...}` (0 if no markets past cutoff yet).

- [ ] **Step 4: Trigger resolve-fundamental-markets and confirm output**

```bash
CRON_SECRET=$(grep CRON_SECRET .env | cut -d= -f2) && \
curl -s -X POST https://stockbets.vercel.app/api/cron/resolve-fundamental-markets \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" -w "\nHTTP: %{http_code}\n"
```

Expected: `{"ok":true,"job":"resolve-fundamental-markets","resolved":0,"skipped":0,"pending":0,...}` with HTTP 200.

- [ ] **Step 5: Add cron-job.org schedules**

In cron-job.org, add two new cron jobs:
- `POST https://stockbets.vercel.app/api/cron/close-markets` — schedule: `25 9,13,15,19 * * 1-5` (9:25 AM, 1 PM, 3:55 PM, 7 PM UTC — covers both ET windows with a safety run)
- `POST https://stockbets.vercel.app/api/cron/resolve-fundamental-markets` — schedule: `*/30 11-4 * * 1-5` (every 30 min from 7 AM–midnight ET)

Both must include `Authorization: Bearer <CRON_SECRET>` header.
