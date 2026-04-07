# Admin Panel Design

**Date:** 2026-04-06

## Goal

A protected admin page where the developer can manage earnings events, create/edit markets (bets), manually resolve markets with payouts, and trigger FMP data syncs — all from the browser.

---

## Access Control

Email allowlist. No new DB fields or roles.

```typescript
const ADMIN_EMAILS = ["jmenasche1214@gmail.com"];
```

- `/admin` page: server component checks `session.user.email`, redirects to `/` if not admin
- `/api/admin/*` routes: each checks the same list, returns 403 if not admin
- Middleware already requires auth for `/admin` paths (not in `PUBLIC_PATHS`)

---

## Page Structure

Single page at `/admin` with 4 tabs via `?tab=` query param (same pattern as portfolio page).

### Earnings tab (default)
- Table of upcoming earnings events: company ticker, report date, release time, quarter, number of markets
- "Edit" per row: inline form to change report date and release time (PRE_MARKET / POST_MARKET)
- "Add Earnings" button: form with company dropdown, quarter, report date, release time
- "Sync from FMP" button: refreshes all earnings dates from FMP API

### Markets tab
- Table of all open markets: company, question, metric type, threshold, YES/NO prices, volume
- "Edit" per row: inline form to update question, threshold, thresholdLabel, prices
- "Create Market" button: form with earnings event dropdown, metric type, threshold, question

### Resolve tab
- Table of markets ready to resolve (report date has passed, status OPEN or CLOSED)
- Each row shows company, metric type, question, current prices
- "Resolve" button per row: form to enter actual value and winning side (YES/NO)
- Triggers payout: creates Resolution record, credits winners, sets realizedPL, stamps payoutsIssuedAt — all in one transaction (same logic as `scripts/resolve.ts`)

### Sync tab
- "Run Full Sync" button: runs FMP sync for all companies (earnings dates + stock prices)
- Status output showing what was updated

---

## API Routes

All under `/api/admin/`. All check admin email, return 403 if not authorized.

### `POST /api/admin/earnings`
Create a new earnings event.
- Body: `{ companyId, quarter, reportDate, releaseTime }`
- Returns the created event

### `PATCH /api/admin/earnings/[id]`
Update an earnings event.
- Body: `{ reportDate?, releaseTime? }`
- Returns the updated event

### `POST /api/admin/markets`
Create a new market (bet).
- Body: `{ companyId, earningsEventId, question, metricType, threshold, thresholdLabel, consensusEstimate? }`
- Creates with status OPEN, default prices (50/50)
- Returns the created market

### `PATCH /api/admin/markets/[id]`
Edit a market.
- Body: `{ question?, threshold?, thresholdLabel?, yesPriceLatest?, noPriceLatest?, consensusEstimate? }`
- Returns the updated market

### `POST /api/admin/resolve/[marketId]`
Manually resolve a market and trigger payouts.
- Body: `{ actualValue, actualLabel, winningSide: "YES" | "NO" }`
- In a single transaction:
  1. Create Resolution record
  2. Mark market RESOLVED
  3. Settle all positions (winners get `shares * 100` credited, all get `realizedPL`)
  4. Stamp `payoutsIssuedAt`
- Returns the resolution

### `POST /api/admin/sync`
Run FMP sync for all companies.
- No body
- Runs sync logic (earnings calendar + stock prices)
- Returns `{ updated: string[] }` — list of tickers that had data changes

---

## What Changes

### Added
- `src/lib/admin.ts` — `isAdmin(session)` helper, `ADMIN_EMAILS` constant
- `src/app/admin/page.tsx` — admin page server component
- `src/components/admin/AdminTabs.tsx` — tab navigation (same pattern as PortfolioTabs)
- `src/components/admin/EarningsPanel.tsx` — earnings table + forms
- `src/components/admin/MarketsPanel.tsx` — markets table + forms
- `src/components/admin/ResolvePanel.tsx` — resolve table + forms
- `src/components/admin/SyncPanel.tsx` — sync button + status
- `src/app/api/admin/earnings/route.ts` — POST create earnings
- `src/app/api/admin/earnings/[id]/route.ts` — PATCH update earnings
- `src/app/api/admin/markets/route.ts` — POST create market
- `src/app/api/admin/markets/[id]/route.ts` — PATCH update market
- `src/app/api/admin/resolve/[marketId]/route.ts` — POST resolve + payout
- `src/app/api/admin/sync/route.ts` — POST run FMP sync

### Unchanged
- `scripts/resolve.ts` — auto-resolve script stays as-is
- `scripts/sync.ts` — CLI sync script stays as-is
- `prisma/schema.prisma` — no schema changes

---

## Existing Code Reuse

- Tab pattern: reuses `PortfolioTabs` approach (query param switching)
- Payout logic: resolve API replicates the transaction pattern from `scripts/resolve.ts`
- FMP sync: sync API imports and runs the same FMP fetching logic
- UI styling: same dark theme, inline styles, Lucide icons as the rest of the app
