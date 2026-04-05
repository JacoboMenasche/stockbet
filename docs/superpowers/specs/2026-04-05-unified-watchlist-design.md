# Unified Watchlist Design

**Date:** 2026-04-05

## Goal

Extend the existing company-level watchlist to also support individual bet (market-level) bookmarks. Users can bookmark a whole company (shows all its open markets) or a specific bet (shows just that market under the company header). Both appear in the same grouped portfolio watchlist tab.

---

## What Changes

### Added
- `Watchlist` Prisma model (market-level bookmarks) — re-introduced
- `POST/DELETE /api/watchlist/[marketId]` route — re-introduced
- `MarketWatchlistButton` component (`src/components/markets/MarketWatchlistButton.tsx`) — small bookmark toggle for individual bets
- `CompanyWatchlistButton` added to `MarketRow` on the markets feed
- `MarketWatchlistButton` added to each contract card on the company detail page
- `MarketWatchlistButton` added to the market detail page header
- `getWatchlistData` query replaces `getCompanyWatchlist` in `src/lib/queries/portfolio.ts`

### Modified
- `prisma/schema.prisma` — re-add `Watchlist` model + reverse relations on `User` and `Market`
- `src/lib/queries/portfolio.ts` — replace `getCompanyWatchlist` / `CompanyWatchlistItem` with `getWatchlistData` / `WatchlistGroup`
- `src/components/portfolio/CompanyWatchlistTable.tsx` — update props to accept `WatchlistGroup[]`; remove button calls company-watchlist API for company-bookmarked groups, watchlist API for bet-bookmarked groups
- `src/app/portfolio/page.tsx` — use `getWatchlistData`
- `src/app/markets/page.tsx` — fetch user's company watchlist set, pass `initialCompanyBookmarked` + `companyId` to each `MarketRow`
- `src/components/markets/MarketRow.tsx` — accept optional `companyId`, `initialCompanyBookmarked`; render `CompanyWatchlistButton` in header when props provided
- `src/app/company/[ticker]/page.tsx` — fetch user's market watchlist set for this company's markets; pass `initialBookmarked` per contract card; render `MarketWatchlistButton` on each card
- `src/app/markets/[marketId]/page.tsx` — check if bet is bookmarked; render `MarketWatchlistButton` in header

### Unchanged
- `CompanyWatchlist` model
- `CompanyWatchlistButton` component
- `/api/company-watchlist/[companyId]` route

---

## Schema

Re-add after the `Resolution` model:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Watchlist
// User-bookmarked individual markets shown on the portfolio watchlist tab.
// ─────────────────────────────────────────────────────────────────────────────

model Watchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  marketId  String
  market    Market   @relation(fields: [marketId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, marketId])
  @@index([userId])
}
```

In `Market` model, add after `resolution Resolution?`:
```prisma
  watchlist Watchlist[]
```

In `User` model, add after `companyWatchlist CompanyWatchlist[]`:
```prisma
  watchlist Watchlist[]
```

---

## API

### `POST /api/watchlist/[marketId]`
- Auth required (401 if not)
- Upserts `Watchlist` row for `(userId, marketId)`
- Returns `{ bookmarked: true }`

### `DELETE /api/watchlist/[marketId]`
- Auth required (401 if not)
- `deleteMany` for `(userId, marketId)`
- Returns `{ bookmarked: false }`

---

## Query: `getWatchlistData`

Replaces `getCompanyWatchlist`. Returns `WatchlistGroup[]` — one entry per unique company across both watchlist tables.

```typescript
export type WatchlistGroup = {
  companyId: string;
  company: { id: string; ticker: string; name: string };
  bookmarkType: "company" | "markets";  // company = show all, markets = show specific
  markets: {
    id: string;
    question: string;
    yesPriceLatest: number;
    noPriceLatest: number;
    earningsEvent: { reportDate: Date };
  }[];
};
```

Logic:
1. Fetch all `CompanyWatchlist` entries for user (with company + open markets + earningsEvent)
2. Fetch all `Watchlist` entries for user (with market + company + earningsEvent)
3. Build a `Map<companyId, WatchlistGroup>`:
   - For each `CompanyWatchlist` entry: add group with `bookmarkType: "company"`, all open markets
   - For each `Watchlist` entry: if company already in map (company bookmark wins — skip); otherwise upsert group with `bookmarkType: "markets"`, accumulate the specific markets
4. Return `Array.from(map.values())`

---

## Components

### `MarketWatchlistButton` (`src/components/markets/MarketWatchlistButton.tsx`)
- `"use client"` component
- Props: `marketId: string`, `initialBookmarked: boolean`
- Hits `/api/watchlist/${marketId}` — POST to add, DELETE to remove
- Optimistic toggle with error rollback (same pattern as `CompanyWatchlistButton`)
- Visual: same style as `CompanyWatchlistButton` — "Watch" / "Saved" with Bookmark icon

### `MarketRow` updates
- New optional props: `companyId?: string`, `initialCompanyBookmarked?: boolean`
- When both provided and user is signed in, render `<CompanyWatchlistButton>` in the header row (right side, before the chevron)
- `MarketRow` is a client component — receives initial state from server as prop

### `CompanyWatchlistTable` updates
- Props change: `initialItems: WatchlistGroup[]` (was `CompanyWatchlistItem[]`)
- Remove button behaviour:
  - `bookmarkType === "company"` → calls `DELETE /api/company-watchlist/${companyId}`
  - `bookmarkType === "markets"` → calls `DELETE /api/watchlist/${marketId}` for each bookmarked market in the group
- Empty state message updated: "No watchlist items yet. Watch companies or individual bets to track them here."

---

## Page Changes

### `src/app/markets/page.tsx`
- If session exists: fetch `Set<companyId>` of user's `CompanyWatchlist` in parallel with feed
- Pass `companyId` and `initialCompanyBookmarked` to each `MarketRow`

### `src/app/company/[ticker]/page.tsx`
- Existing: checks `CompanyWatchlist` for `initialBookmarked` on the company header button
- New: if session exists, fetch `Set<marketId>` of user's `Watchlist` for markets in this company
- Pass `initialBookmarked` per contract card; render `<MarketWatchlistButton>` on each card

### `src/app/markets/[marketId]/page.tsx`
- If session exists: check `db.watchlist.findUnique` for `(userId, marketId)`
- Render `<MarketWatchlistButton marketId={market.id} initialBookmarked={bookmarked} />` in the header when session exists

### `src/app/portfolio/page.tsx`
- Replace `getCompanyWatchlist` with `getWatchlistData`
- Pass result to `<CompanyWatchlistTable initialItems={watchlistData} />`

---

## Display Logic Summary

| User action | Portfolio tab shows |
|---|---|
| Bookmarks company | Company header + all open markets |
| Bookmarks specific bet | Company header + only that bet |
| Bookmarks company + specific bet from same company | Company header + all open markets (company wins) |
| Removes company bookmark | Entire group disappears |
| Removes market bookmark (bet group) | That specific market row disappears; if last one, whole group disappears |
