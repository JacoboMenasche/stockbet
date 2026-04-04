# Portfolio Positions Design

## Goal

Replace the "coming soon" placeholder on `/portfolio` with a full portfolio page: a summary of the user's financial position at the top, and three tabs below — open positions, watchlist, and bet history.

---

## Architecture

**Tab routing:** URL search param `?tab=` drives which tab renders. Default is `positions`. A client `PortfolioTabs` component handles active highlight and navigation via `router.push`. All tab content is server-rendered — no client-side data fetching.

---

## Schema Change

Add a `Watchlist` model so users can bookmark markets:

```prisma
model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  marketId  String
  market    Market   @relation(fields: [marketId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, marketId])
}
```

Also add the reverse relations on `User` and `Market`:
- `User.watchlist Watchlist[]`
- `Market.watchlist Watchlist[]`

---

## Summary Section

Three stat cards rendered server-side at the top of the page, always visible regardless of active tab.

| Card | Value | Source |
|---|---|---|
| Cash balance | formatted cents | `session.user.cashBalanceCents` |
| Open position value | sum of `shares × currentPrice` | all user positions where `market.status = OPEN` |
| Unrealized P&L | sum of `unrealizedPL` | same positions; green if ≥ 0, red if < 0 |

---

## Tabs

### Open Positions (default: `?tab=positions`)

Query: all `Position` records for the user where `market.status = OPEN`, include `market.company`.

Table columns:
- Market question (links to `/markets/[id]`)
- Ticker
- Side (YES/NO badge)
- Shares
- Avg cost (cents formatted)
- Current price (cents)
- Unrealized P&L (green/red)

### Watchlist (`?tab=watchlist`)

Query: all `Watchlist` records for the user, include `market`, `market.company`, `market.earningsEvent`.

Table columns:
- Market question (links to `/markets/[id]`)
- Ticker
- YES price / NO price
- Days until report
- Remove button → calls `DELETE /api/watchlist/[marketId]`, client-side optimistic removal

### History (`?tab=history`)

Query: all `Position` records for the user where `market.status = RESOLVED`, include `market.company`, `market.resolution`.

Table columns:
- Market question
- Ticker
- Side (YES/NO badge)
- Shares
- Avg cost
- Payout received: `shares × 100` cents if `resolution.winningSide === side`, else `0`
- Result: WIN (green) / LOSS (red) badge

---

## Watchlist Toggle

**API:** `POST /api/watchlist/[marketId]` adds bookmark; `DELETE /api/watchlist/[marketId]` removes it. Both require auth (401 if not signed in). Returns `{ bookmarked: boolean }`.

**Button:** `WatchlistButton` client component on the market detail page. Shows a bookmark icon — filled if already bookmarked, outline if not. Receives `initialBookmarked: boolean` as prop (resolved server-side). Calls the API on click and flips state optimistically.

---

## Query Functions (`src/lib/queries/portfolio.ts`)

- `getOpenPositions(userId)` — positions with `market.status = OPEN`
- `getWatchlist(userId)` — watchlist with market + company + earningsEvent
- `getPositionHistory(userId)` — positions with `market.status = RESOLVED` + resolution
- `getPortfolioSummary(userId)` — cash balance + aggregate open position value + unrealized P&L

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `Watchlist` model + reverse relations |
| `src/lib/queries/portfolio.ts` | Create | All portfolio query functions |
| `src/app/portfolio/page.tsx` | Modify | Tab param routing + summary fetch |
| `src/components/portfolio/PortfolioSummary.tsx` | Create | Three stat cards |
| `src/components/portfolio/PortfolioTabs.tsx` | Create | Client tab switcher |
| `src/components/portfolio/PositionsTable.tsx` | Create | Open positions table |
| `src/components/portfolio/WatchlistTable.tsx` | Create | Watchlist table with remove button |
| `src/components/portfolio/HistoryTable.tsx` | Create | Resolved positions table |
| `src/app/api/watchlist/[marketId]/route.ts` | Create | POST/DELETE bookmark toggle |
| `src/app/markets/[marketId]/page.tsx` | Modify | Pass `initialBookmarked` to WatchlistButton |
| `src/components/markets/WatchlistButton.tsx` | Create | Client bookmark toggle button |

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Not signed in on portfolio page | Redirect to `/auth/signin` |
| Not signed in on watchlist API | 401 |
| Market already bookmarked (POST) | 200, idempotent upsert |
| Market not bookmarked (DELETE) | 200, no-op |
| Empty tab | Show "Nothing here yet" placeholder |
