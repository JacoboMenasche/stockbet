# Company Watchlist Design

**Date:** 2026-04-04

## Goal

Replace the market-level watchlist with a company-level watchlist. Users bookmark companies from the company detail page. The portfolio watchlist tab shows each bookmarked company as a group header with all its open markets listed underneath.

---

## What Changes

### Removed
- `Watchlist` Prisma model (market-level bookmarks)
- `WatchlistButton` component (`src/components/markets/WatchlistButton.tsx`)
- `WatchlistTable` component (`src/components/portfolio/WatchlistTable.tsx`)
- `getWatchlist` query and `WatchlistItem` type in `src/lib/queries/portfolio.ts`
- `POST/DELETE /api/watchlist/[marketId]` route

### Added
- `CompanyWatchlist` Prisma model
- `POST/DELETE /api/company-watchlist/[companyId]` route
- `CompanyWatchlistButton` component on the company page
- `CompanyWatchlistTable` component on the portfolio watchlist tab
- `getCompanyWatchlist` query in `src/lib/queries/portfolio.ts`

---

## Schema

```prisma
model CompanyWatchlist {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  companyId String
  company   Company  @relation(fields: [companyId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, companyId])
  @@index([userId])
}
```

Reverse relations added:
- `User`: `companyWatchlist CompanyWatchlist[]`
- `Company`: `watchlist CompanyWatchlist[]`

The existing `Watchlist` model and its reverse relations on `User` and `Market` are removed.

---

## API

### `POST /api/company-watchlist/[companyId]`
- Requires auth; returns 401 if unauthenticated
- Upserts a `CompanyWatchlist` row for `(userId, companyId)`
- Returns `{ bookmarked: true }`

### `DELETE /api/company-watchlist/[companyId]`
- Requires auth; returns 401 if unauthenticated
- Deletes the `CompanyWatchlist` row for `(userId, companyId)`
- Returns `{ bookmarked: false }`

---

## Query

```typescript
// src/lib/queries/portfolio.ts
export async function getCompanyWatchlist(userId: string) {
  return db.companyWatchlist.findMany({
    where: { userId },
    include: {
      company: {
        include: {
          markets: {
            where: { status: "OPEN" },
            include: { earningsEvent: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
```

---

## Components

### `CompanyWatchlistButton` (`src/components/company/CompanyWatchlistButton.tsx`)
- `"use client"` component
- Props: `companyId: string`, `initialBookmarked: boolean`
- Optimistic toggle: flips state immediately, then calls `POST` or `DELETE`
- Shows "Watch" (outline bookmark) or "Saved" (filled bookmark)
- Disabled during in-flight request
- Placed in the company page header, aligned right — only rendered when session exists

### `CompanyWatchlistTable` (`src/components/portfolio/CompanyWatchlistTable.tsx`)
- `"use client"` component
- Props: `initialItems: CompanyWatchlistItem[]`
- Renders one group per bookmarked company:
  - **Group header:** company name, ticker chip, remove (×) button — clicking × calls `DELETE` and removes the group optimistically
  - **Market rows (under header):** market question (links to `/markets/[id]`), YES price, NO price, days until earnings
  - **Empty state per company:** "No open markets" if company has no open markets
- Overall empty state: "No companies watchlisted yet. Add them from the company page."

---

## Portfolio Page

`src/app/portfolio/page.tsx` — watchlist tab:
- Calls `getCompanyWatchlist(userId)` when `tab === "watchlist"`
- Passes result to `<CompanyWatchlistTable initialItems={watchlist} />`
- No other tab changes

---

## Company Page

`src/app/company/[ticker]/page.tsx`:
- Checks if the current user has bookmarked this company:
  ```typescript
  const bookmarked = session?.user?.id
    ? !!(await db.companyWatchlist.findUnique({
        where: { userId_companyId: { userId: session.user.id, companyId: company.id } },
      }))
    : false;
  ```
- Renders `<CompanyWatchlistButton companyId={company.id} initialBookmarked={bookmarked} />` in the header row, right-aligned, only when `session` exists

---

## Cleanup

After implementing, verify no remaining imports of `WatchlistButton`, `WatchlistTable`, or `getWatchlist` across the codebase.
