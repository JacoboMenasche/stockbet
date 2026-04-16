# Earnings Fundamental Markets — Design Spec

**Date:** 2026-04-16  
**Status:** Approved  
**Scope:** Add four earnings beat/miss market types to the existing stockbets platform

---

## Overview

Extend the market catalog with four fundamental beat/miss bet types that resolve against Wall Street consensus estimates on earnings day. All markets are same-day YES/NO binary contracts, consistent with the existing price-based markets.

**New MetricTypes:**
- `EPS_BEAT` — Will the company beat EPS consensus?
- `REVENUE_BEAT` — Will the company beat revenue consensus?
- `NET_INCOME_BEAT` — Will the company beat net income consensus?
- `EBITDA_BEAT` — Will the company beat EBITDA consensus?

---

## Market Lifecycle

```
OPEN → CLOSED → RESOLVED
```

| Status | Description |
|---|---|
| `OPEN` | Bets accepted from creation until `earningsCloseAt` |
| `CLOSED` | No new orders; positions locked. Awaiting actuals from FMP. |
| `RESOLVED` | FMP actuals confirmed, winner determined, payouts issued |

### Close Cutoff (`earningsCloseAt`)

Determined by when the company reports earnings:

| Report Time | Close Cutoff |
|---|---|
| Pre-market | 9:25 AM ET on earnings day |
| After-market | 3:55 PM ET on earnings day |
| During-market | 12:00 PM ET on earnings day (midday) |

The `close-markets` cron queries `WHERE earningsCloseAt <= NOW() AND status = OPEN` to flip markets to `CLOSED`.

---

## Schema Changes

### `MetricType` enum
```prisma
enum MetricType {
  PRICE_DIRECTION
  PRICE_TARGET
  PERCENTAGE_MOVE
  EPS_BEAT        // new
  REVENUE_BEAT    // new
  NET_INCOME_BEAT // new
  EBITDA_BEAT     // new
}
```

### `Market` model — add one field
```prisma
earningsCloseAt  DateTime?
// null for price markets; computed close cutoff for fundamental markets
```

### `EarningsEvent` model — add one field
```prisma
reportTime  String?
// "pre-market" | "after-market" | "during-market"
```

---

## Resolution Logic

### Consensus Source (Threshold)

FMP `/stable/analyst-estimates?symbol=X&period=annual` — annual figures only (current plan).  
Quarterly proxy: `annualAvg / 4` via a `getQuarterlyEstimate(metric, annualAvg)` helper.

**When FMP quarterly data becomes available** (plan upgrade), replace only this helper — no other logic changes.

| MetricType | Annual field used | Threshold stored |
|---|---|---|
| `EPS_BEAT` | `epsAvg` | `epsAvg / 4` |
| `REVENUE_BEAT` | `revenueAvg` | `revenueAvg / 4` |
| `NET_INCOME_BEAT` | `netIncomeAvg` | `netIncomeAvg / 4` |
| `EBITDA_BEAT` | `ebitdaAvg` | `ebitdaAvg / 4` |

### Actuals Source

FMP `/stable/income-statement?symbol=X&period=quarterly` — first row is the most recently filed quarter.

**Guard:** verify the returned row's `date` matches the expected earnings quarter before resolving, to prevent resolving on stale data.

### Resolution Rule

`winningSide = YES` if `actual > threshold`, otherwise `NO`.

### Retry Logic (EBITDA / Net Income Lag)

EBITDA and net income may not appear in FMP same-day. The `resolve-fundamental-markets` cron:
- Runs every 30 minutes after earnings windows close
- Retries `CLOSED` markets until actuals are confirmed
- After 24 hours without resolution, flags the market for manual review (logs a `[resolve] MANUAL_REVIEW_REQUIRED` warning)

---

## Market Creation

### Inputs
- `EarningsEvent` with `date` and `reportTime`
- FMP annual consensus estimates for the relevant company

### Per Market
| Field | Value |
|---|---|
| `question` | "Will AAPL beat EPS consensus of $1.62 this quarter?" |
| `threshold` | `annualAvg / 4` (e.g. `1.62` for EPS) |
| `thresholdLabel` | Human-readable (e.g. `$1.62`, `$94.3B`) |
| `earningsCloseAt` | Computed from `EarningsEvent.date` + `reportTime` |
| `consensusEstimate` | Display string for UI |
| `metricType` | One of 4 new values |
| `betDate` | Earnings event date |

Four markets are created per company per earnings event (one per MetricType).

---

## New Cron Jobs

### `close-markets`
- **Schedule:** runs at 9:25 AM ET and 3:55 PM ET daily
- **Logic:** `UPDATE market SET status = CLOSED WHERE earningsCloseAt <= NOW() AND status = OPEN`

### `resolve-fundamental-markets`
- **Schedule:** runs every 30 minutes from 7 AM – midnight ET on earnings days
- **Logic:** fetch actuals from FMP income statement, compare to threshold, resolve if data is present
- **Fallback:** after 24 hours unresolved, emit `[resolve] MANUAL_REVIEW_REQUIRED` log

---

## What Does Not Change

- Matching engine (YES/NO binary contracts, same order book logic)
- Payout logic (winning side pays out at 100¢)
- Challenge/league scoring (fundamental markets are just more markets)
- Price-based market creation (runs independently)

---

## Open Items

1. **FMP earnings calendar** — `earning_calendar` returns empty on current plan. `EarningsEvent.reportTime` may need to be seeded manually until plan is upgraded.
2. **FMP quarterly estimates** — locked behind premium. Using `annualAvg / 4` proxy until upgraded.
3. **Annual÷4 proxy accuracy** — EPS and revenue are reasonably linear; EBITDA and net income have more seasonality. Consider a seasonality adjustment factor per quarter if results skew.
