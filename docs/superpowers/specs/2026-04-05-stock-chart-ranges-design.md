# Stock Chart Time Ranges Design

**Date:** 2026-04-05

## Goal

Add time range selection (1W, 1M, 3M, YTD, 1Y) to the company page stock chart with on-demand FMP data fetching and client-side caching to minimize API calls.

---

## What Changes

### Added
- `src/lib/fmp.ts` — FMP API client for the Next.js app (server-side only)
- `src/app/api/stock-prices/[ticker]/route.ts` — GET endpoint serving cached stock prices, refreshes from FMP if stale
- `src/components/company/StockChartWithRanges.tsx` — client component wrapping StockChart with range toggle buttons and client-side data caching

### Modified
- `src/app/company/[ticker]/page.tsx` — swap `StockChart` for `StockChartWithRanges`

### Unchanged
- `src/components/company/StockChart.tsx` — remains a dumb render component
- `prisma/schema.prisma` — `StockPriceCache` model unchanged
- `scripts/fmp.ts` — CLI scripts version untouched

---

## FMP Client: `src/lib/fmp.ts`

Slim server-side wrapper around the FMP historical price API. Reads `FMP_API_KEY` from `process.env` (available in Next.js server context).

```typescript
export interface HistoricalPrice {
  date: string;   // "2026-01-15"
  close: number;
}

export async function fetchHistoricalPrices(
  ticker: string,
  days: number
): Promise<HistoricalPrice[]>
```

Uses the same FMP endpoint as `scripts/fmp.ts`: `GET /stable/historical-price-eod/full?symbol={ticker}&limit={days}`. Returns `{ date, close }[]` sorted ascending by date.

---

## API Route: `GET /api/stock-prices/[ticker]`

**Query params:** `?range=1W|1M|3M|YTD|1Y` (default: `1M`)

**No auth required** — stock prices are public data.

**Range to days mapping:**

| Range | Days |
|-------|------|
| 1W | 7 |
| 1M | 30 |
| 3M | 90 |
| YTD | Days since Jan 1 of current year |
| 1Y | 365 |

**Logic:**
1. Look up company by ticker (404 if not found)
2. Compute `days` from range param
3. Check `StockPriceCache` — find the latest cached date for this company
4. If the latest cached date is before the most recent trading day: fetch `fetchHistoricalPrices(ticker, days)` from FMP, upsert all rows into `StockPriceCache`
5. Query `StockPriceCache` for this company, filtered to the last `days` days, ordered ascending by date
6. Return `{ prices: { date: string; close: number }[] }`

**Staleness check:** Compare the latest cached date against today (or yesterday if today is a weekend/before market open). A simple heuristic: if `latestCachedDate < today - 1 day`, consider stale and refresh.

**Response shape:**
```json
{
  "prices": [
    { "date": "2026-03-06", "close": 142.50 },
    { "date": "2026-03-07", "close": 143.20 }
  ]
}
```

---

## Component: `StockChartWithRanges`

`"use client"` component at `src/components/company/StockChartWithRanges.tsx`.

**Props:**
```typescript
interface StockChartWithRangesProps {
  ticker: string;
  initialData: { date: string; close: number }[];
}
```

**State:**
- `activeRange`: current selected range (`"1W" | "1M" | "3M" | "YTD" | "1Y"`, default `"1M"`)
- `cache`: `Map<string, { date: string; close: number }[]>` — keyed by range, stores fetched data
- `data`: the currently displayed data points
- `loading`: boolean

**Range toggle buttons:** Row of 5 buttons (1W, 1M, 3M, YTD, 1Y) styled consistently with the existing dark UI. Active button has a highlighted background.

**Client-side caching logic on range switch:**
1. If `cache` has data for the requested range → use it directly
2. If `cache` has data for a *larger* range (e.g., have 1Y, want 1M) → filter client-side by date, no fetch
3. Otherwise → fetch from `/api/stock-prices/${ticker}?range=${range}`, store in cache

**Range containment order:** 1Y > YTD > 3M > 1M > 1W. If you have 1Y data, you can derive any smaller range by filtering to the last N days.

**Initial state:** `initialData` (from server) is pre-populated as the `"1M"` cache entry.

---

## Company Page Change

In `src/app/company/[ticker]/page.tsx`, replace:

```tsx
<StockChart data={chartData} ticker={company.ticker} />
```

with:

```tsx
<StockChartWithRanges ticker={company.ticker} initialData={chartData} />
```

The server still fetches the default 90-day cache on page load (existing behavior). The new component handles range switching client-side.

---

## API Call Budget

Typical user session on a company page:
- Page load: 0 extra FMP calls (served from existing cache if fresh, or 1 call if stale)
- Range switches: at most 1-2 FMP calls total (fetching a larger range covers all smaller ones)
- Same range revisited: 0 calls (client cache hit)
