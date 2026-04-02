# FMP Automation & Company Detail Page Design

**Date:** 2026-04-02
**Project:** Ratio Markets (stockbet)

## Overview

Automate the process of creating prediction markets for earnings outcomes using the Financial Modeling Prep (FMP) API, automatically closing bets at the correct pre/post-market cutoff on earnings day, resolving markets once actual results are available, and displaying a company detail page with a stock chart and bets grid.

---

## 1. Schema Changes

### `EarningsEvent` — add `releaseTime`

```prisma
enum ReleaseTime {
  PRE_MARKET   // reports before 9:30 AM — bets close at 9:00 AM
  POST_MARKET  // reports after close — bets close at 4:30 PM
}

model EarningsEvent {
  // ... existing fields ...
  releaseTime ReleaseTime @default(POST_MARKET)
}
```

FMP maps: `"bmo"` (before market open) → `PRE_MARKET`, `"amc"` (after market close) → `POST_MARKET`.

### `StockPriceCache` — new table

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

---

## 2. FMP API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /v3/earning_calendar?from=&to=` | Upcoming earnings dates + `time` (bmo/amc) |
| `GET /v3/analyst-estimates/{ticker}` | EPS, revenue, margin consensus estimates |
| `GET /v3/historical-price-full/{ticker}?timeseries=90` | 90-day stock price history |
| `GET /v3/income-statement/{ticker}?limit=1` | Actual reported results for resolution |

All requests use `?apikey=FMP_API_KEY` from `.env`.

---

## 3. `scripts/sync.ts` — Daily Sync

**Scheduled:** Windows Task Scheduler, daily at 7:00 AM.

**Steps:**
1. Load all tracked `Company` tickers from DB.
2. Call FMP `/earning_calendar` for the next 90 days.
3. For each matching company, upsert `EarningsEvent` with `reportDate` and `releaseTime`.
4. Call FMP `/analyst-estimates/{ticker}` to get consensus estimates for EPS, gross margin, operating margin, revenue growth.
5. For each metric with a consensus value, create a `Market` row if one doesn't exist:
   - `threshold` = consensus estimate value
   - `thresholdLabel` = e.g. `"> $1.55"`
   - `question` = e.g. `"Will Apple EPS beat $1.55?"`
   - `status` = `OPEN`
6. Call FMP `/historical-price-full/{ticker}?timeseries=90` and upsert rows into `StockPriceCache`.

**Run manually:** `npx tsx scripts/sync.ts`

---

## 4. `scripts/resolve.ts` — Earnings Day Resolution

**Scheduled:** Windows Task Scheduler, daily at 9:00 AM and 4:30 PM.

**Steps:**
1. Determine current run type based on system time:
   - Before 10 AM → `PRE_MARKET` run
   - After 3 PM → `POST_MARKET` run
2. Query DB for `EarningsEvent` where `reportDate` = today AND `releaseTime` matches run type.
3. Set all `Market` rows for those events → `status: CLOSED`.
4. Call FMP `/income-statement/{ticker}?limit=1` for each company.
5. For each `Market`, compare `actualValue` vs `threshold`:
   - `actualValue > threshold` → `winningSide = YES`
   - `actualValue <= threshold` → `winningSide = NO`
6. Create `Resolution` row with `actualValue`, `actualLabel`, `winningSide`, `sourceFiling`.
7. Set `Market` → `status: RESOLVED`.

**Run manually:** `npx tsx scripts/resolve.ts`

---

## 5. Company Detail Page

**Route:** `/company/[ticker]` (new route, separate from `/markets/[marketId]`)

**Layout (Option A — approved):**

```
┌─────────────────────────────────────────┐
│  AAPL  Apple Inc.         Reports in 12d │
├─────────────────────────────────────────┤
│                                         │
│         📈 Stock price chart            │
│              (full width, 90 days)      │
│                                         │
├─────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐    │
│  │ GROSS MARGIN │  │     EPS      │    │
│  │   > 47%      │  │   > $1.55    │    │
│  │ YES 64¢ NO 36│  │ YES 71¢ NO 29│    │
│  └──────────────┘  └──────────────┘    │
│  ┌──────────────┐  ┌──────────────┐    │
│  │  REV GROWTH  │  │  OP MARGIN   │    │
│  │   > 14%      │  │   > 10%      │    │
│  │ YES 58¢ NO 42│  │ YES 55¢ NO 45│    │
│  └──────────────┘  └──────────────┘    │
└─────────────────────────────────────────┘
```

**Data sources:**
- Stock chart: read from `StockPriceCache` for the ticker
- Bets grid: read from `Market` joined with `EarningsEvent` where status = OPEN

**Chart library:** Recharts (already a React project, lightweight, no extra deps needed — confirm if already installed, otherwise add it).

---

## 6. Environment Variables

Add to `.env`:
```
FMP_API_KEY="your_fmp_api_key_here"
```

---

## 7. Out of Scope

- Order matching / trade execution (already exists in schema, not touched here)
- User authentication
- Payout distribution after resolution (schema has `payoutsIssuedAt` — future work)
- Adding new companies via UI (done manually via seed or direct DB insert for now)
