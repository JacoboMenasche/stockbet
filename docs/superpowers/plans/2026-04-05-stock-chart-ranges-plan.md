# Stock Chart Time Ranges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add time range selection (1W, 1M, 3M, YTD, 1Y) to the company page stock chart with on-demand FMP data fetching and client-side caching.

**Architecture:** A new API route serves stock prices for a given ticker and range, refreshing from FMP when the cache is stale. A new `StockChartWithRanges` client component wraps the existing `StockChart` with range toggle buttons and caches fetched data client-side so larger ranges cover smaller ones without extra API calls.

**Tech Stack:** Next.js 15 App Router, Prisma 5, Recharts, FMP API

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/lib/fmp.ts` | Create | FMP API client for the Next.js app (server-side) |
| `src/app/api/stock-prices/[ticker]/route.ts` | Create | GET endpoint: cached stock prices with on-demand FMP refresh |
| `src/components/company/StockChartWithRanges.tsx` | Create | Client component: range toggles + client-side caching + StockChart |
| `src/app/company/[ticker]/page.tsx` | Modify | Swap StockChart for StockChartWithRanges |

---

### Task 1: FMP client for the app

**Files:**
- Create: `src/lib/fmp.ts`

- [ ] **Step 1: Create the file**

```typescript
const FMP_BASE = "https://financialmodelingprep.com/stable";

function apiKey(): string {
  const k = process.env.FMP_API_KEY;
  if (!k) throw new Error("FMP_API_KEY is not set");
  return k;
}

export interface HistoricalPrice {
  date: string;
  close: number;
}

interface FmpPriceRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchHistoricalPrices(
  ticker: string,
  days: number
): Promise<HistoricalPrice[]> {
  const url = `${FMP_BASE}/historical-price-eod/full?symbol=${ticker}&limit=${days}&apikey=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FMP error: ${res.status}`);
  const rows: FmpPriceRow[] = await res.json();
  return rows
    .map((r) => ({ date: r.date, close: r.close }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "lib/fmp" || echo "No errors"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/lib/fmp.ts && git commit -m "feat: FMP client for Next.js app"
```

---

### Task 2: Stock prices API route

**Files:**
- Create: `src/app/api/stock-prices/[ticker]/route.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p src/app/api/stock-prices/\[ticker\]
```

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fetchHistoricalPrices } from "@/lib/fmp";

const RANGE_DAYS: Record<string, number | "YTD"> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "YTD": "YTD",
  "1Y": 365,
};

function rangeToDays(range: string): number {
  const val = RANGE_DAYS[range];
  if (val === "YTD") {
    const now = new Date();
    const jan1 = new Date(now.getFullYear(), 0, 1);
    return Math.ceil((now.getTime() - jan1.getTime()) / (1000 * 60 * 60 * 24));
  }
  return val as number;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await context.params;
  const range = req.nextUrl.searchParams.get("range") ?? "1M";

  if (!RANGE_DAYS[range]) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const company = await db.company.findUnique({
    where: { ticker: ticker.toUpperCase() },
    select: { id: true },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const days = rangeToDays(range);

  // Check cache freshness: latest cached date for this company
  const latest = await db.stockPriceCache.findFirst({
    where: { companyId: company.id },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const isStale = !latest || latest.date < yesterday;

  if (isStale) {
    try {
      const fresh = await fetchHistoricalPrices(ticker.toUpperCase(), days);
      for (const p of fresh) {
        await db.stockPriceCache.upsert({
          where: {
            companyId_date: { companyId: company.id, date: new Date(p.date) },
          },
          update: { close: p.close },
          create: {
            companyId: company.id,
            date: new Date(p.date),
            open: 0,
            high: 0,
            low: 0,
            close: p.close,
            volume: 0,
          },
        });
      }
    } catch (err) {
      console.error(`[stock-prices] FMP fetch failed for ${ticker}:`, err);
      // Fall through to serve whatever cache we have
    }
  }

  // Serve from cache
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const prices = await db.stockPriceCache.findMany({
    where: {
      companyId: company.id,
      date: { gte: cutoff },
    },
    orderBy: { date: "asc" },
    select: { date: true, close: true },
  });

  return NextResponse.json({
    prices: prices.map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      close: Number(p.close),
    })),
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "stock-prices" || echo "No errors"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add "src/app/api/stock-prices/" && git commit -m "feat: GET /api/stock-prices/[ticker] with FMP cache refresh"
```

---

### Task 3: StockChartWithRanges component

**Files:**
- Create: `src/components/company/StockChartWithRanges.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState, useCallback } from "react";
import { StockChart } from "./StockChart";

type Range = "1W" | "1M" | "3M" | "YTD" | "1Y";

const RANGES: Range[] = ["1W", "1M", "3M", "YTD", "1Y"];

// Larger ranges contain smaller ones (by days covered)
const RANGE_DAYS: Record<Range, number> = {
  "1W": 7,
  "1M": 30,
  "3M": 90,
  "YTD": 366, // max possible
  "1Y": 365,
};

function filterToRange(
  data: { date: string; close: number }[],
  range: Range
): { date: string; close: number }[] {
  if (range === "YTD") {
    const yearStart = `${new Date().getFullYear()}-01-01`;
    return data.filter((d) => d.date >= yearStart);
  }
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[range]);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

function canDerive(cached: Range, requested: Range): boolean {
  if (cached === requested) return true;
  // 1Y covers everything except possibly YTD in a leap year (366 > 365), but close enough
  if (cached === "1Y") return true;
  if (cached === "YTD" && RANGE_DAYS[requested] <= RANGE_DAYS["YTD"]) return true;
  if (cached === "3M" && (requested === "1M" || requested === "1W")) return true;
  if (cached === "1M" && requested === "1W") return true;
  return false;
}

interface StockChartWithRangesProps {
  ticker: string;
  initialData: { date: string; close: number }[];
}

export function StockChartWithRanges({
  ticker,
  initialData,
}: StockChartWithRangesProps) {
  const [activeRange, setActiveRange] = useState<Range>("1M");
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [cache] = useState(
    () => new Map<Range, { date: string; close: number }[]>([["1M", initialData]])
  );

  const switchRange = useCallback(
    async (range: Range) => {
      setActiveRange(range);

      // Check if we have exact cache hit
      if (cache.has(range)) {
        setData(cache.get(range)!);
        return;
      }

      // Check if a larger cached range can derive the requested range
      for (const [cachedRange, cachedData] of cache.entries()) {
        if (canDerive(cachedRange, range)) {
          const filtered = filterToRange(cachedData, range);
          cache.set(range, filtered);
          setData(filtered);
          return;
        }
      }

      // Fetch from API
      setLoading(true);
      try {
        const res = await fetch(`/api/stock-prices/${ticker}?range=${range}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        const prices = json.prices as { date: string; close: number }[];
        cache.set(range, prices);
        setData(prices);
      } catch {
        // Keep current data on error
      }
      setLoading(false);
    },
    [ticker, cache]
  );

  return (
    <div>
      {/* Range toggles */}
      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => switchRange(r)}
            disabled={loading}
            className="px-3 py-1 rounded-md text-xs font-medium transition-all disabled:opacity-40"
            style={{
              backgroundColor:
                activeRange === r
                  ? "rgba(167,139,250,0.2)"
                  : "rgba(255,255,255,0.04)",
              color:
                activeRange === r
                  ? "#a78bfa"
                  : "rgba(255,255,255,0.4)",
              border:
                activeRange === r
                  ? "1px solid rgba(167,139,250,0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Chart */}
      <StockChart data={data} ticker={ticker} />
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "StockChartWithRanges" || echo "No errors"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/components/company/StockChartWithRanges.tsx && git commit -m "feat: StockChartWithRanges with range toggles and client-side caching"
```

---

### Task 4: Update company page

**Files:**
- Modify: `src/app/company/[ticker]/page.tsx`

- [ ] **Step 1: Replace StockChart import with StockChartWithRanges**

In the imports at the top of the file, replace:

```tsx
import { StockChart } from "@/components/company/StockChart";
```

with:

```tsx
import { StockChartWithRanges } from "@/components/company/StockChartWithRanges";
```

- [ ] **Step 2: Replace the chart section**

Replace this block:

```tsx
        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          Price — last 90 days
        </p>
        <StockChart data={chartData} ticker={company.ticker} />
```

with:

```tsx
        <StockChartWithRanges ticker={company.ticker} initialData={chartData} />
```

- [ ] **Step 3: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep -v "node_modules" | grep -E "error TS" | head -10
```

Expected: only the two pre-existing errors in `TopNav.tsx` and `FeedControls.tsx`.

- [ ] **Step 4: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add "src/app/company/[ticker]/page.tsx" && git commit -m "feat: company page uses StockChartWithRanges"
```
