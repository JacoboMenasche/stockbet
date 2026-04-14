# Leaderboard — Design Spec

**Date:** 2026-04-13
**Status:** Approved

---

## Overview

A dedicated `/leaderboard` page showing the top 50 traders ranked by total ROI (percentage profit) across all resolved positions. Supports an all-time / 30-day toggle.

---

## 1. Metric Definition

**ROI % = `sum(realizedPL) / sum(avgCostCents × shares) × 100`**

- `realizedPL` — cents profit/loss on a resolved position (non-null = resolved)
- `avgCostCents × shares` — cost basis per position in cents
- Only positions with `realizedPL IS NOT NULL` are included
- Negative ROI is valid and ranks below zero

**Eligibility:** Users with fewer than 5 resolved positions are excluded. This prevents a single lucky bet from dominating the top of the list.

**Top N:** Maximum 50 rows shown.

---

## 2. Data Model

No schema changes required. All data comes from the existing `Position` and `User` tables.

---

## 3. Query

**File:** `src/lib/queries/leaderboard.ts`

**Function:** `getLeaderboard(window: "all" | "30d")`

Logic:
1. Query `Position` where `realizedPL IS NOT NULL`
2. If `window = "30d"`: additionally filter `updatedAt >= now - 30 days`
3. Join `User` for `displayName` and `avatarUrl`
4. Group by `userId`
5. Compute per user:
   - `totalRealizedPL` = `sum(realizedPL)` (cents)
   - `totalCostBasis` = `sum(avgCostCents * shares)` (cents)
   - `roiPct` = `totalRealizedPL / totalCostBasis * 100`
   - `positionCount` = count of resolved positions
6. Exclude users where `positionCount < 5`
7. Order by `roiPct` descending
8. Take top 50
9. Add `rank` field (1-based index)

Return type per row:
```ts
{
  rank: number;
  userId: string;
  displayName: string | null;
  roiPct: number;          // e.g. 42.5 = 42.5%
  totalRealizedPL: number; // cents
  positionCount: number;
}
```

Because Prisma does not support computed aggregates directly, the query fetches all qualifying grouped data with `groupBy` + `_sum` + `_count`, then filters and sorts in application code.

---

## 4. UI

### Page: `src/app/leaderboard/page.tsx`

- Server component
- Reads `?window=30d` search param (defaults to `"all"`)
- Calls `getLeaderboard(window)`
- Passes results to `LeaderboardTable` client component

### Component: `src/components/leaderboard/LeaderboardTable.tsx`

- Client component (handles toggle interaction)
- **Header:** "Leaderboard" + subtitle "Top traders by return on investment"
- **Toggle:** "All time" / "30 days" — clicking updates the URL search param via `useRouter`
- **Table columns:** Rank · Trader · ROI % · Total P&L · Trades
- **ROI cell:** green if positive (`var(--color-yes)`), red if negative, gray if zero
- **P&L cell:** formatted as `+$X.XX` / `-$X.XX` in dollars (divide cents by 100)
- **Name cell:** `displayName` or `"Anonymous"` if null
- **Empty state:** "Not enough data yet — come back once more trades have resolved." shown when fewer than 5 users qualify

### Nav: `src/components/layout/TopNav.tsx`

Add `{ href: "/leaderboard", label: "Leaderboard" }` to `NAV_LINKS`.

---

## 5. Out of Scope

- Unrealized P&L counting toward ROI
- Per-market or per-challenge leaderboards
- User profile links from leaderboard rows
- Avatar images in the table
- Pagination (top 50 is the full list)
- Real-time updates (page re-fetches on navigation)
