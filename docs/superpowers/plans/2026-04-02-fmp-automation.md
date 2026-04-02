# FMP Automation & Company Detail Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automate market creation, closing, and resolution using the FMP API, and build a company detail page with a 90-day stock chart and bets grid.

**Architecture:** Two standalone scripts (`sync.ts`, `resolve.ts`) run via Windows Task Scheduler to pull data from FMP and update PostgreSQL via Prisma. The Next.js app reads only from the DB — no live FMP calls in the UI. Company detail page at `/company/[ticker]` shows a full-width stock chart followed by a 2-column bets grid.

**Tech Stack:** TypeScript, Prisma 5, PostgreSQL, FMP REST API (`v3`), Next.js 15, Recharts 2, Vitest, `tsx`

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `ReleaseTime` enum, `releaseTime` on `EarningsEvent`, `StockPriceCache` model |
| `.env` / `.env.example` | Modify | Add `FMP_API_KEY` |
| `scripts/fmp.ts` | Create | Typed FMP API client (shared by both scripts) |
| `scripts/lib/market-helpers.ts` | Create | Pure functions: `mapReleaseTime`, `determineWinningSide`, `buildMarketQuestion` — testable in isolation |
| `scripts/sync.ts` | Create | Daily sync: earnings calendar + estimates + stock prices → DB |
| `scripts/resolve.ts` | Create | Earnings day: close bets at cutoff, resolve after actuals land |
| `scripts/__tests__/market-helpers.test.ts` | Create | Vitest unit tests for pure logic |
| `vitest.config.ts` | Create | Vitest configuration |
| `src/lib/queries/company.ts` | Create | DB query: company + stock prices + open markets |
| `src/components/company/StockChart.tsx` | Create | Recharts AreaChart, client component |
| `src/app/company/[ticker]/page.tsx` | Create | Server component: chart + 2-col bets grid |
| `src/components/markets/MarketRow.tsx` | Modify | Make ticker badge a link to `/company/[ticker]` |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `ReleaseTime` enum and update `EarningsEvent`**

In `prisma/schema.prisma`, add the enum after the existing enums block and add the field to `EarningsEvent`:

```prisma
enum ReleaseTime {
  PRE_MARKET   // bmo — bets close at 9:00 AM on reportDate
  POST_MARKET  // amc — bets close at 4:30 PM on reportDate
}
```

In the `EarningsEvent` model, add after `isConfirmed`:
```prisma
  releaseTime ReleaseTime @default(POST_MARKET)
```

- [ ] **Step 2: Add `StockPriceCache` model**

Add this model to `prisma/schema.prisma` after the `EarningsEvent` model:

```prisma
model StockPriceCache {
  id        String   @id @default(cuid())
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  date      DateTime @db.Date
  open      Decimal  @db.Decimal(12, 4)
  high      Decimal  @db.Decimal(12, 4)
  low       Decimal  @db.Decimal(12, 4)
  close     Decimal  @db.Decimal(12, 4)
  volume    BigInt

  @@unique([companyId, date])
  @@index([companyId, date])
}
```

- [ ] **Step 3: Add relation to `Company`**

In the `Company` model, add after `markets Market[]`:
```prisma
  stockPrices StockPriceCache[]
```

- [ ] **Step 4: Push schema to DB**

```bash
cd Desktop/stockbet
npm run db:push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add ReleaseTime enum and StockPriceCache to schema"
```

---

## Task 2: Add FMP API Key

**Files:**
- Modify: `.env`, `.env.example`

- [ ] **Step 1: Add key to `.env`**

Add this line to `.env`:
```
FMP_API_KEY="your_fmp_api_key_here"
```

Get your free API key at https://financialmodelingprep.com/developer/docs

- [ ] **Step 2: Add placeholder to `.env.example`**

Add to `.env.example`:
```
FMP_API_KEY=""
```

- [ ] **Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: add FMP_API_KEY to env example"
```

(Do not commit `.env` — it contains your real key.)

---

## Task 3: Set Up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["scripts/**/*.test.ts"],
  },
});
```

- [ ] **Step 3: Add test script to `package.json`**

In `package.json`, add to the `"scripts"` block:
```json
"test": "vitest run"
```

- [ ] **Step 4: Verify Vitest works**

```bash
npm test
```

Expected output: `No test files found` (or similar — no failures).

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "chore: add vitest"
```

---

## Task 4: FMP API Client + Pure Helpers

**Files:**
- Create: `scripts/fmp.ts`
- Create: `scripts/lib/market-helpers.ts`
- Create: `scripts/__tests__/market-helpers.test.ts`

- [ ] **Step 1: Write failing tests for pure helpers**

Create `scripts/__tests__/market-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mapReleaseTime, determineWinningSide, buildMarketQuestion } from "../lib/market-helpers";
import { ReleaseTime, MetricType, Side } from "@prisma/client";

describe("mapReleaseTime", () => {
  it("maps bmo to PRE_MARKET", () => {
    expect(mapReleaseTime("bmo")).toBe(ReleaseTime.PRE_MARKET);
  });
  it("maps amc to POST_MARKET", () => {
    expect(mapReleaseTime("amc")).toBe(ReleaseTime.POST_MARKET);
  });
  it("maps unknown time to POST_MARKET", () => {
    expect(mapReleaseTime("dmh")).toBe(ReleaseTime.POST_MARKET);
  });
});

describe("determineWinningSide", () => {
  it("returns YES when actual exceeds threshold", () => {
    expect(determineWinningSide(1.60, 1.55)).toBe(Side.YES);
  });
  it("returns NO when actual is below threshold", () => {
    expect(determineWinningSide(1.50, 1.55)).toBe(Side.NO);
  });
  it("returns NO when actual equals threshold (not strictly greater)", () => {
    expect(determineWinningSide(1.55, 1.55)).toBe(Side.NO);
  });
});

describe("buildMarketQuestion", () => {
  it("builds EPS question", () => {
    expect(buildMarketQuestion("Apple", MetricType.EPS, "> $1.55")).toBe(
      "Will Apple EPS beat $1.55?"
    );
  });
  it("builds GROSS_MARGIN question", () => {
    expect(buildMarketQuestion("Apple", MetricType.GROSS_MARGIN, "> 47%")).toBe(
      "Will Apple gross margin exceed 47%?"
    );
  });
  it("builds REVENUE_GROWTH question", () => {
    expect(buildMarketQuestion("Apple", MetricType.REVENUE_GROWTH, "> 12%")).toBe(
      "Will Apple revenue growth exceed 12%?"
    );
  });
  it("builds OPERATING_MARGIN question", () => {
    expect(buildMarketQuestion("Apple", MetricType.OPERATING_MARGIN, "> 30%")).toBe(
      "Will Apple operating margin exceed 30%?"
    );
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../lib/market-helpers'`

- [ ] **Step 3: Create `scripts/lib/market-helpers.ts`**

```typescript
import { ReleaseTime, MetricType, Side } from "@prisma/client";

export function mapReleaseTime(fmpTime: string): ReleaseTime {
  return fmpTime === "bmo" ? ReleaseTime.PRE_MARKET : ReleaseTime.POST_MARKET;
}

export function determineWinningSide(actual: number, threshold: number): Side {
  return actual > threshold ? Side.YES : Side.NO;
}

const METRIC_LABELS: Record<MetricType, string> = {
  EPS: "EPS",
  GROSS_MARGIN: "gross margin",
  REVENUE_GROWTH: "revenue growth",
  OPERATING_MARGIN: "operating margin",
  FREE_CASH_FLOW: "free cash flow",
  ARPU: "ARPU",
  SUBSCRIBERS: "subscribers",
};

const METRIC_VERBS: Record<MetricType, string> = {
  EPS: "beat",
  GROSS_MARGIN: "exceed",
  REVENUE_GROWTH: "exceed",
  OPERATING_MARGIN: "exceed",
  FREE_CASH_FLOW: "exceed",
  ARPU: "exceed",
  SUBSCRIBERS: "exceed",
};

export function buildMarketQuestion(
  companyName: string,
  metric: MetricType,
  thresholdLabel: string
): string {
  const label = METRIC_LABELS[metric];
  const verb = METRIC_VERBS[metric];
  const value = thresholdLabel.replace(/^[>< ]+/, "").trim();
  return `Will ${companyName} ${label} ${verb} ${value}?`;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: PASS — 8 tests passing.

- [ ] **Step 5: Create `scripts/fmp.ts`**

```typescript
const BASE = "https://financialmodelingprep.com/api/v3";

function key(): string {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set in environment");
  return k;
}

async function fmpGet<T>(path: string): Promise<T> {
  const sep = path.includes("?") ? "&" : "?";
  const url = `${BASE}${path}${sep}apikey=${key()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP request failed: ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export interface FmpEarningsCalendarItem {
  symbol: string;
  date: string;        // "2026-04-30"
  time: string;        // "amc" | "bmo" | "dmh"
  epsEstimated: number | null;
  revenueEstimated: number | null;
}

export interface FmpAnalystEstimate {
  symbol: string;
  date: string;
  estimatedEpsAvg: number;
  estimatedEpsHigh: number;
  estimatedEpsLow: number;
  estimatedRevenueAvg: number;
  estimatedRevenueLow: number;
  estimatedRevenueHigh: number;
}

export interface FmpIncomeStatement {
  symbol: string;
  date: string;
  revenue: number;
  grossProfit: number;
  grossProfitRatio: number;   // e.g. 0.468 = 46.8%
  operatingIncome: number;
  operatingIncomeRatio: number;
  eps: number;
}

export interface FmpHistoricalPrice {
  date: string;  // "2026-01-15"
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchEarningsCalendar(
  from: string,
  to: string
): Promise<FmpEarningsCalendarItem[]> {
  return fmpGet<FmpEarningsCalendarItem[]>(`/earning_calendar?from=${from}&to=${to}`);
}

export async function fetchAnalystEstimates(
  ticker: string
): Promise<FmpAnalystEstimate[]> {
  return fmpGet<FmpAnalystEstimate[]>(`/analyst-estimates/${ticker}`);
}

export async function fetchIncomeStatements(
  ticker: string,
  limit = 4
): Promise<FmpIncomeStatement[]> {
  return fmpGet<FmpIncomeStatement[]>(`/income-statement/${ticker}?limit=${limit}`);
}

export async function fetchHistoricalPrices(
  ticker: string,
  timeseries = 90
): Promise<FmpHistoricalPrice[]> {
  const data = await fmpGet<{ historical: FmpHistoricalPrice[] }>(
    `/historical-price-full/${ticker}?timeseries=${timeseries}`
  );
  return data.historical ?? [];
}
```

- [ ] **Step 6: Commit**

```bash
git add scripts/ vitest.config.ts package.json package-lock.json
git commit -m "feat: add FMP client and pure market helpers with tests"
```

---

## Task 5: `scripts/sync.ts`

**Files:**
- Create: `scripts/sync.ts`

- [ ] **Step 1: Create `scripts/sync.ts`**

```typescript
import "dotenv/config";
import { PrismaClient, MarketStatus, MetricType } from "@prisma/client";
import {
  fetchEarningsCalendar,
  fetchAnalystEstimates,
  fetchIncomeStatements,
  fetchHistoricalPrices,
} from "./fmp";
import { mapReleaseTime, buildMarketQuestion } from "./lib/market-helpers";

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

  if (!entry) {
    console.log(`[sync] No upcoming earnings for ${ticker}`);
    return;
  }

  const reportDate = new Date(entry.date + "T20:00:00Z"); // default 4pm ET as UTC
  const releaseTime = mapReleaseTime(entry.time);
  const quarter = `Q${Math.ceil((reportDate.getMonth() + 1) / 3)}-${reportDate.getFullYear()}`;

  const event = await db.earningsEvent.upsert({
    where: { companyId_quarter: { companyId: company.id, quarter } },
    update: { reportDate, releaseTime, isConfirmed: true },
    create: { companyId: company.id, quarter, reportDate, releaseTime, isConfirmed: true },
  });

  // 2. Analyst estimates → EPS and revenue-based markets
  const estimates = await fetchAnalystEstimates(ticker);
  const latest = estimates[0];

  // 3. Income statements → margin-based markets
  const statements = await fetchIncomeStatements(ticker, 4);
  const avgGrossMargin =
    statements.reduce((s, r) => s + r.grossProfitRatio * 100, 0) / statements.length;
  const avgOpMargin =
    statements.reduce((s, r) => s + r.operatingIncomeRatio * 100, 0) / statements.length;

  // Revenue growth: estimate vs prior year actual
  const priorYearRevenue = statements[0]?.revenue ?? 0;
  const estimatedRevenue = latest?.estimatedRevenueAvg ?? 0;
  const revenueGrowthThreshold =
    priorYearRevenue > 0
      ? roundTo(((estimatedRevenue - priorYearRevenue) / priorYearRevenue) * 100, 1)
      : null;

  type MarketDef = {
    metricType: MetricType;
    threshold: number;
    thresholdLabel: string;
  };

  const marketDefs: MarketDef[] = [];

  if (latest?.estimatedEpsAvg) {
    const t = roundTo(latest.estimatedEpsAvg, 2);
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

  // 4. Stock price cache (90 days)
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
```

- [ ] **Step 2: Add `dotenv` dependency**

```bash
npm install dotenv
```

- [ ] **Step 3: Test run (dry run with your FMP key)**

```bash
npx tsx scripts/sync.ts
```

Expected output:
```
[sync] Syncing 6 companies...
[sync] Created market: AAPL EPS > $1.54
[sync] Cached 90 price points for AAPL
...
[sync] Done.
```

If you see `FMP_API_KEY is not set`, make sure `.env` has your key and `dotenv/config` is loading it.

- [ ] **Step 4: Commit**

```bash
git add scripts/sync.ts package.json package-lock.json
git commit -m "feat: add sync script for FMP earnings + prices"
```

---

## Task 6: `scripts/resolve.ts`

**Files:**
- Create: `scripts/resolve.ts`

- [ ] **Step 1: Create `scripts/resolve.ts`**

```typescript
import "dotenv/config";
import { PrismaClient, MarketStatus, MetricType, ReleaseTime } from "@prisma/client";
import { fetchIncomeStatements } from "./fmp";
import { determineWinningSide } from "./lib/market-helpers";

const db = new PrismaClient();

function isPreMarketRun(): boolean {
  const hour = new Date().getHours(); // local time
  return hour < 10; // before 10 AM = pre-market run
}

function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function todayEnd(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

async function resolveCompany(ticker: string, companyId: string, eventId: string) {
  // Close all open markets for this event
  await db.market.updateMany({
    where: { earningsEventId: eventId, status: MarketStatus.OPEN },
    data: { status: MarketStatus.CLOSED },
  });
  console.log(`[resolve] Closed markets for ${ticker}`);

  // Fetch actual results
  const statements = await fetchIncomeStatements(ticker, 1);
  const actual = statements[0];
  if (!actual) {
    console.warn(`[resolve] No income statement available yet for ${ticker} — will retry next run`);
    return;
  }

  // Resolve each market
  const markets = await db.market.findMany({
    where: { earningsEventId: eventId, status: MarketStatus.CLOSED },
  });

  for (const market of markets) {
    let actualValue: number | null = null;
    let actualLabel = "";

    if (market.metricType === MetricType.EPS) {
      actualValue = actual.eps;
      actualLabel = `$${actual.eps.toFixed(2)}`;
    } else if (market.metricType === MetricType.GROSS_MARGIN) {
      actualValue = actual.grossProfitRatio * 100;
      actualLabel = `${actualValue.toFixed(1)}%`;
    } else if (market.metricType === MetricType.OPERATING_MARGIN) {
      actualValue = actual.operatingIncomeRatio * 100;
      actualLabel = `${actualValue.toFixed(1)}%`;
    } else if (market.metricType === MetricType.REVENUE_GROWTH) {
      // Revenue growth requires prior year — skip if not calculable here
      // The sync script already set the threshold; we need prior year revenue
      // For now, mark as VOIDED if we can't resolve
      await db.market.update({ where: { id: market.id }, data: { status: "VOIDED" } });
      console.warn(`[resolve] ${ticker} REVENUE_GROWTH market voided — prior year data needed`);
      continue;
    }

    if (actualValue === null) continue;

    const threshold = Number(market.threshold);
    const winningSide = determineWinningSide(actualValue, threshold);

    await db.resolution.create({
      data: {
        marketId: market.id,
        actualValue,
        actualLabel,
        winningSide,
        sourceFiling: `https://financialmodelingprep.com/financial-statements/${ticker}`,
      },
    });

    await db.market.update({
      where: { id: market.id },
      data: { status: MarketStatus.RESOLVED },
    });

    console.log(`[resolve] ${ticker} ${market.metricType}: actual=${actualLabel}, threshold=${market.thresholdLabel}, winner=${winningSide}`);
  }
}

async function main() {
  const runType = isPreMarketRun() ? ReleaseTime.PRE_MARKET : ReleaseTime.POST_MARKET;
  console.log(`[resolve] Running as ${runType} (${new Date().toLocaleTimeString()})`);

  const events = await db.earningsEvent.findMany({
    where: {
      reportDate: { gte: todayStart(), lte: todayEnd() },
      releaseTime: runType,
    },
    include: { company: true },
  });

  if (events.length === 0) {
    console.log("[resolve] No companies reporting today for this window.");
    return;
  }

  for (const event of events) {
    try {
      await resolveCompany(event.company.ticker, event.companyId, event.id);
    } catch (err) {
      console.error(`[resolve] Error for ${event.company.ticker}:`, err);
    }
  }

  console.log("[resolve] Done.");
}

main().finally(() => db.$disconnect());
```

- [ ] **Step 2: Test run manually (safe — only affects companies reporting today)**

```bash
npx tsx scripts/resolve.ts
```

Expected when no earnings today:
```
[resolve] Running as POST_MARKET (4:32:00 PM)
[resolve] No companies reporting today for this window.
[resolve] Done.
```

- [ ] **Step 3: Commit**

```bash
git add scripts/resolve.ts
git commit -m "feat: add resolve script for market closing and resolution"
```

---

## Task 7: Company Detail Query

**Files:**
- Create: `src/lib/queries/company.ts`

- [ ] **Step 1: Create `src/lib/queries/company.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/queries/company.ts
git commit -m "feat: add company detail DB query"
```

---

## Task 8: StockChart Component

**Files:**
- Create: `src/components/company/StockChart.tsx`

- [ ] **Step 1: Create `src/components/company/StockChart.tsx`**

```typescript
"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  date: string;   // formatted "Jan 15"
  close: number;
}

interface StockChartProps {
  data: DataPoint[];
  ticker: string;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function StockChart({ data, ticker }: StockChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-48 rounded-xl border text-sm"
        style={{ borderColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }}
      >
        No price data available
      </div>
    );
  }

  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${ticker}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.25} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => `$${v}`}
            domain={["auto", "auto"]}
          />
          <Tooltip
            contentStyle={{
              background: "#1a1a2e",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              color: "#fff",
              fontSize: 12,
            }}
            formatter={(v: number) => [`$${v.toFixed(2)}`, "Close"]}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke="#a78bfa"
            strokeWidth={2}
            fill={`url(#grad-${ticker})`}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/company/StockChart.tsx
git commit -m "feat: add StockChart component using Recharts"
```

---

## Task 9: Company Detail Page

**Files:**
- Create: `src/app/company/[ticker]/page.tsx`

- [ ] **Step 1: Create `src/app/company/[ticker]/page.tsx`**

```typescript
import { notFound } from "next/navigation";
import { getCompanyDetail } from "@/lib/queries/company";
import { StockChart } from "@/components/company/StockChart";
import { metricLabel } from "@/lib/metricLabel";
import { formatVolume, daysUntil, formatDate } from "@/lib/format";
import { CountdownChip } from "@/components/markets/CountdownChip";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default async function CompanyPage({ params }: PageProps) {
  const { ticker } = await params;

  let company;
  try {
    company = await getCompanyDetail(ticker);
  } catch {
    notFound();
  }

  const event = company.earningsEvents[0] ?? null;
  const markets = event?.markets ?? [];

  const chartData = company.stockPrices.map((p) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    close: Number(p.close),
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <span
          className="inline-flex items-center justify-center h-10 w-16 rounded-md text-sm font-semibold tracking-wider"
          style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
        >
          {company.ticker}
        </span>
        <div>
          <h1 className="text-xl font-medium text-white">{company.name}</h1>
          {company.sector && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {company.sector}
            </p>
          )}
        </div>
        {event && (
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Reports {formatDate(event.reportDate)}
            </span>
            <CountdownChip days={daysUntil(event.reportDate)} />
          </div>
        )}
      </div>

      {/* Stock chart */}
      <div
        className="rounded-xl border p-4 mb-6"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          Price — last 90 days
        </p>
        <StockChart data={chartData} ticker={company.ticker} />
      </div>

      {/* Bets grid */}
      {markets.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No open markets for this company.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            Open contracts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {markets.map((m) => (
              <div
                key={m.id}
                className="rounded-xl border p-4"
                style={{
                  borderColor: "rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {metricLabel(m.metricType)}
                </p>
                <p className="text-sm font-medium text-white mb-3">{m.question}</p>
                <div className="flex gap-2 mb-3">
                  <span
                    className="flex-1 text-center py-1.5 rounded-lg text-sm font-semibold"
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
                  >
                    YES {m.yesPriceLatest}¢
                  </span>
                  <span
                    className="flex-1 text-center py-1.5 rounded-lg text-sm font-semibold"
                    style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}
                  >
                    NO {m.noPriceLatest}¢
                  </span>
                </div>
                {m.consensusEstimate && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Consensus {m.consensusEstimate}
                    {m.analystRangeLow && m.analystRangeHigh
                      ? ` · Range ${m.analystRangeLow}–${m.analystRangeHigh}`
                      : ""}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Vol {formatVolume(m.volume24h)} (24h)
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Start dev server and visit the page**

```bash
npm run dev
```

Open: `http://localhost:3000/company/AAPL`

Expected: company header, stock chart area (empty if sync hasn't run yet), bets grid.

- [ ] **Step 3: Commit**

```bash
git add src/app/company/ src/lib/queries/company.ts
git commit -m "feat: add company detail page with stock chart and bets grid"
```

---

## Task 10: Link Ticker from Markets Feed

**Files:**
- Modify: `src/components/markets/MarketRow.tsx`

- [ ] **Step 1: Import `Link` and wrap the ticker badge**

In `src/components/markets/MarketRow.tsx`, add the import at the top:
```typescript
import Link from "next/link";
```

Replace the ticker badge span (lines 49–53):
```typescript
{/* Before */}
<span
  className="inline-flex items-center justify-center h-8 w-14 rounded-md text-xs font-semibold tracking-wider shrink-0"
  style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
>
  {ticker}
</span>
```

With:
```typescript
{/* After */}
<Link
  href={`/company/${ticker}`}
  onClick={(e) => e.stopPropagation()}
  className="inline-flex items-center justify-center h-8 w-14 rounded-md text-xs font-semibold tracking-wider shrink-0 hover:opacity-80 transition-opacity"
  style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
>
  {ticker}
</Link>
```

Note: `e.stopPropagation()` prevents the click from also toggling the row expansion.

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3000/markets` and click a ticker badge — should navigate to `/company/AAPL` etc. Clicking elsewhere on the row should still expand/collapse contracts.

- [ ] **Step 3: Commit**

```bash
git add src/components/markets/MarketRow.tsx
git commit -m "feat: link ticker badge to company detail page"
```

---

## Task 11: Windows Task Scheduler Setup

**Files:**
- Create: `scripts/run-sync.bat`
- Create: `scripts/run-resolve.bat`

- [ ] **Step 1: Create `scripts/run-sync.bat`**

```bat
@echo off
cd /d C:\Users\jmena\Desktop\stockbet
npx tsx scripts\sync.ts >> logs\sync.log 2>&1
```

- [ ] **Step 2: Create `scripts/run-resolve.bat`**

```bat
@echo off
cd /d C:\Users\jmena\Desktop\stockbet
npx tsx scripts\resolve.ts >> logs\resolve.log 2>&1
```

- [ ] **Step 3: Create logs directory**

```bash
mkdir -p /c/Users/jmena/Desktop/stockbet/logs
echo "" > /c/Users/jmena/Desktop/stockbet/logs/.gitkeep
```

Add to `.gitignore`:
```
logs/*.log
```

- [ ] **Step 4: Register sync task in Windows Task Scheduler**

Open Task Scheduler (`Win + S` → "Task Scheduler") and create a new task:

- **Name:** `StockBet Sync`
- **Trigger:** Daily at 7:00 AM
- **Action:** Start a program
  - Program: `C:\Users\jmena\Desktop\stockbet\scripts\run-sync.bat`
- **Settings:** Check "Run whether user is logged on or not"

- [ ] **Step 5: Register resolve task (runs twice daily)**

Create another task:

- **Name:** `StockBet Resolve`
- **Trigger 1:** Daily at 9:00 AM
- **Trigger 2:** Daily at 4:30 PM
- **Action:** Start a program
  - Program: `C:\Users\jmena\Desktop\stockbet\scripts\run-resolve.bat`
- **Settings:** Check "Run whether user is logged on or not"

- [ ] **Step 6: Test both scripts manually before relying on scheduler**

```bash
npx tsx scripts/sync.ts
npx tsx scripts/resolve.ts
```

- [ ] **Step 7: Commit**

```bash
git add scripts/run-sync.bat scripts/run-resolve.bat logs/.gitkeep .gitignore
git commit -m "chore: add Task Scheduler bat files and logs setup"
```

---

## Self-Review

**Spec coverage:**
- ✅ FMP API client (Task 4)
- ✅ `releaseTime` per company PRE/POST (Task 1 + Task 6)
- ✅ Markets close only on earnings day at correct cutoff (Task 6 `isPreMarketRun`)
- ✅ `sync.ts` daily (Task 5)
- ✅ `resolve.ts` at 9 AM + 4:30 PM (Task 11)
- ✅ `StockPriceCache` schema + population (Task 1 + Task 5)
- ✅ Company detail page layout A: chart top, bets grid below (Task 9)
- ✅ Windows Task Scheduler setup (Task 11)

**Gap noted:** `REVENUE_GROWTH` resolution is voided in `resolve.ts` because YoY comparison requires storing prior-year revenue. This is acceptable for now — the market gets voided rather than incorrectly resolved.

**Type consistency check:** `determineWinningSide(actual, threshold)` defined in Task 4, used in Task 6 ✓. `buildMarketQuestion(name, metricType, thresholdLabel)` defined in Task 4, used in Task 5 ✓. `CompanyDetail` type from Task 7 used implicitly in Task 9 via inline destructuring ✓.
