# Portfolio Positions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "coming soon" placeholder on `/portfolio` with a summary section + three URL-param-driven tabs: open positions, watchlist, and bet history.

**Architecture:** URL search param `?tab=` controls which tab renders server-side. A client `PortfolioTabs` component handles navigation. All data is fetched server-side per tab — no client data fetching except the watchlist remove button (optimistic). A new `Watchlist` DB model stores bookmarks; a `WatchlistButton` on the market detail page toggles them.

**Tech Stack:** Prisma 5, Next.js 15 App Router, NextAuth v5

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `Watchlist` model + reverse relations on `User` and `Market` |
| `src/lib/queries/portfolio.ts` | Create | `getOpenPositions`, `getWatchlist`, `getPositionHistory`, `getPortfolioSummary` |
| `src/app/api/watchlist/[marketId]/route.ts` | Create | POST (add) / DELETE (remove) bookmark |
| `src/components/portfolio/PortfolioSummary.tsx` | Create | Two stat cards: open position value + unrealized P&L |
| `src/components/portfolio/PortfolioTabs.tsx` | Create | Client tab switcher (uses `useRouter`) |
| `src/components/portfolio/PositionsTable.tsx` | Create | Open positions table (server) |
| `src/components/portfolio/WatchlistTable.tsx` | Create | Watchlist table with optimistic remove (client) |
| `src/components/portfolio/HistoryTable.tsx` | Create | Resolved positions table (server) |
| `src/app/portfolio/page.tsx` | Modify | Read `?tab=`, fetch data, render layout |
| `src/components/markets/WatchlistButton.tsx` | Create | Client bookmark toggle button |
| `src/app/markets/[marketId]/page.tsx` | Modify | Check if bookmarked, pass `initialBookmarked` to WatchlistButton |

---

### Task 1: Schema — Add Watchlist model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `Watchlist` model and reverse relations**

In `prisma/schema.prisma`, add after the `Resolution` model:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// Watchlist
// User-bookmarked markets shown on the portfolio watchlist tab.
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

Then in the `Market` model, add after `resolution Resolution?`:

```prisma
  watchlist           Watchlist[]
```

Then in the `User` model, add after `positions Position[]`:

```prisma
  watchlist Watchlist[]
```

- [ ] **Step 2: Push schema to DB**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add prisma/schema.prisma && git commit -m "feat: add Watchlist model for portfolio bookmarks"
```

---

### Task 2: Portfolio query functions

**Files:**
- Create: `src/lib/queries/portfolio.ts`

- [ ] **Step 1: Create `src/lib/queries/portfolio.ts`**

```typescript
import { db } from "@/lib/db";

export type OpenPosition = Awaited<ReturnType<typeof getOpenPositions>>[number];
export type WatchlistItem = Awaited<ReturnType<typeof getWatchlist>>[number];
export type PositionHistoryItem = Awaited<ReturnType<typeof getPositionHistory>>[number];
export type PortfolioSummaryData = Awaited<ReturnType<typeof getPortfolioSummary>>;

export async function getOpenPositions(userId: string) {
  return db.position.findMany({
    where: {
      userId,
      market: { status: "OPEN" },
    },
    include: {
      market: {
        include: { company: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getWatchlist(userId: string) {
  return db.watchlist.findMany({
    where: { userId },
    include: {
      market: {
        include: {
          company: true,
          earningsEvent: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getPositionHistory(userId: string) {
  return db.position.findMany({
    where: {
      userId,
      market: { status: "RESOLVED" },
    },
    include: {
      market: {
        include: {
          company: true,
          resolution: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });
}

export async function getPortfolioSummary(userId: string) {
  const positions = await db.position.findMany({
    where: {
      userId,
      market: { status: "OPEN" },
    },
    select: {
      shares: true,
      currentPrice: true,
      unrealizedPL: true,
    },
  });

  const openPositionValue = positions.reduce(
    (sum, p) => sum + p.shares * p.currentPrice,
    0
  );
  const unrealizedPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0);

  return { openPositionValue, unrealizedPL };
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "queries/portfolio"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/lib/queries/portfolio.ts && git commit -m "feat: portfolio query functions"
```

---

### Task 3: Watchlist API route

**Files:**
- Create: `src/app/api/watchlist/[marketId]/route.ts`

- [ ] **Step 1: Create directory and file**

Create `src/app/api/watchlist/[marketId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  await db.watchlist.upsert({
    where: { userId_marketId: { userId: session.user.id, marketId } },
    create: { userId: session.user.id, marketId },
    update: {},
  });

  return NextResponse.json({ bookmarked: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  await db.watchlist.deleteMany({
    where: { userId: session.user.id, marketId },
  });

  return NextResponse.json({ bookmarked: false });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "api/watchlist"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/app/api/watchlist/ && git commit -m "feat: POST/DELETE /api/watchlist/[marketId] bookmark toggle"
```

---

### Task 4: Portfolio UI components

**Files:**
- Create: `src/components/portfolio/PortfolioSummary.tsx`
- Create: `src/components/portfolio/PortfolioTabs.tsx`
- Create: `src/components/portfolio/PositionsTable.tsx`
- Create: `src/components/portfolio/WatchlistTable.tsx`
- Create: `src/components/portfolio/HistoryTable.tsx`

- [ ] **Step 1: Create `src/components/portfolio/PortfolioSummary.tsx`**

```tsx
import { formatCents } from "@/lib/format";
import type { PortfolioSummaryData } from "@/lib/queries/portfolio";

interface PortfolioSummaryProps {
  summary: PortfolioSummaryData;
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  const { openPositionValue, unrealizedPL } = summary;
  const plPositive = unrealizedPL >= 0;

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          Position value
        </p>
        <p className="text-xl font-semibold tabular text-white">
          {formatCents(openPositionValue)}
        </p>
      </div>

      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          Unrealized P&amp;L
        </p>
        <p
          className="text-xl font-semibold tabular"
          style={{ color: plPositive ? "var(--color-yes)" : "var(--color-no)" }}
        >
          {plPositive ? "+" : ""}{formatCents(unrealizedPL)}
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/portfolio/PortfolioTabs.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "positions", label: "Open Positions" },
  { key: "watchlist", label: "Watchlist" },
  { key: "history",   label: "History" },
] as const;

export function PortfolioTabs() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const active = searchParams.get("tab") ?? "positions";

  return (
    <div
      className="flex gap-1 rounded-lg p-1 mb-6"
      style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
    >
      {TABS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          onClick={() => router.push(`/portfolio?tab=${key}`)}
          className={cn(
            "flex-1 py-2 rounded-md text-sm font-medium transition-all",
            active === key
              ? "text-white"
              : "text-white/40 hover:text-white/70"
          )}
          style={
            active === key
              ? { backgroundColor: "rgba(255,255,255,0.08)" }
              : undefined
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/portfolio/PositionsTable.tsx`**

```tsx
import Link from "next/link";
import { formatCents } from "@/lib/format";
import type { OpenPosition } from "@/lib/queries/portfolio";

interface PositionsTableProps {
  positions: OpenPosition[];
}

export function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No open positions yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["Market", "Ticker", "Side", "Shares", "Avg cost", "Price", "P&L"].map((h) => (
              <th
                key={h}
                className="pb-3 text-left font-normal"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {positions.map((p) => {
            const plPositive = p.unrealizedPL >= 0;
            return (
              <tr
                key={p.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <td className="py-3 pr-4">
                  <Link
                    href={`/markets/${p.marketId}`}
                    className="text-white hover:underline line-clamp-2 max-w-xs block"
                  >
                    {p.market.question}
                  </Link>
                </td>
                <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {p.market.company.ticker}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor:
                        p.side === "YES"
                          ? "rgba(0,194,168,0.15)"
                          : "rgba(245,166,35,0.15)",
                      color:
                        p.side === "YES" ? "var(--color-yes)" : "var(--color-no)",
                    }}
                  >
                    {p.side}
                  </span>
                </td>
                <td className="py-3 pr-4 tabular text-white">{p.shares}</td>
                <td className="py-3 pr-4 tabular text-white">{formatCents(p.avgCostCents)}</td>
                <td className="py-3 pr-4 tabular text-white">{p.currentPrice}¢</td>
                <td
                  className="py-3 tabular font-medium"
                  style={{ color: plPositive ? "var(--color-yes)" : "var(--color-no)" }}
                >
                  {plPositive ? "+" : ""}{formatCents(p.unrealizedPL)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/portfolio/WatchlistTable.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { daysUntil } from "@/lib/format";
import type { WatchlistItem } from "@/lib/queries/portfolio";

interface WatchlistTableProps {
  initialItems: WatchlistItem[];
}

export function WatchlistTable({ initialItems }: WatchlistTableProps) {
  const [items, setItems] = useState(initialItems);

  async function handleRemove(marketId: string) {
    setItems((prev) => prev.filter((i) => i.marketId !== marketId));
    await fetch(`/api/watchlist/${marketId}`, { method: "DELETE" });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No bookmarks yet. Add markets from the market detail page.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["Market", "Ticker", "YES", "NO", "Days left", ""].map((h, i) => (
              <th
                key={i}
                className="pb-3 text-left font-normal"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
            >
              <td className="py-3 pr-4">
                <Link
                  href={`/markets/${item.marketId}`}
                  className="text-white hover:underline line-clamp-2 max-w-xs block"
                >
                  {item.market.question}
                </Link>
              </td>
              <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                {item.market.company.ticker}
              </td>
              <td className="py-3 pr-4 tabular font-medium" style={{ color: "var(--color-yes)" }}>
                {item.market.yesPriceLatest}¢
              </td>
              <td className="py-3 pr-4 tabular font-medium" style={{ color: "var(--color-no)" }}>
                {item.market.noPriceLatest}¢
              </td>
              <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                {daysUntil(item.market.earningsEvent.reportDate)}d
              </td>
              <td className="py-3">
                <button
                  type="button"
                  onClick={() => handleRemove(item.marketId)}
                  className="p-1 rounded hover:bg-white/10 transition-colors"
                  style={{ color: "rgba(255,255,255,0.3)" }}
                >
                  <X className="h-4 w-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/portfolio/HistoryTable.tsx`**

```tsx
import { formatCents } from "@/lib/format";
import type { PositionHistoryItem } from "@/lib/queries/portfolio";

interface HistoryTableProps {
  history: PositionHistoryItem[];
}

export function HistoryTable({ history }: HistoryTableProps) {
  if (history.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No resolved bets yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            {["Market", "Ticker", "Side", "Shares", "Avg cost", "Payout", "Result"].map((h) => (
              <th
                key={h}
                className="pb-3 text-left font-normal"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {history.map((p) => {
            const won =
              p.market.resolution !== null &&
              p.market.resolution.winningSide === p.side;
            const payout = won ? p.shares * 100 : 0;

            return (
              <tr
                key={p.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <td className="py-3 pr-4">
                  <span className="text-white line-clamp-2 max-w-xs block">
                    {p.market.question}
                  </span>
                </td>
                <td className="py-3 pr-4 tabular" style={{ color: "rgba(255,255,255,0.5)" }}>
                  {p.market.company.ticker}
                </td>
                <td className="py-3 pr-4">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium"
                    style={{
                      backgroundColor:
                        p.side === "YES"
                          ? "rgba(0,194,168,0.15)"
                          : "rgba(245,166,35,0.15)",
                      color:
                        p.side === "YES" ? "var(--color-yes)" : "var(--color-no)",
                    }}
                  >
                    {p.side}
                  </span>
                </td>
                <td className="py-3 pr-4 tabular text-white">{p.shares}</td>
                <td className="py-3 pr-4 tabular text-white">{formatCents(p.avgCostCents)}</td>
                <td className="py-3 pr-4 tabular text-white">{formatCents(payout)}</td>
                <td className="py-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-semibold"
                    style={{
                      backgroundColor: won
                        ? "rgba(0,194,168,0.15)"
                        : "rgba(245,166,35,0.15)",
                      color: won ? "var(--color-yes)" : "var(--color-no)",
                    }}
                  >
                    {won ? "WIN" : "LOSS"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "components/portfolio"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/components/portfolio/ && git commit -m "feat: PortfolioSummary, PortfolioTabs, PositionsTable, WatchlistTable, HistoryTable components"
```

---

### Task 5: Update portfolio page

**Files:**
- Modify: `src/app/portfolio/page.tsx`

- [ ] **Step 1: Replace `src/app/portfolio/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BalanceTopUp } from "@/components/portfolio/BalanceTopUp";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { WatchlistTable } from "@/components/portfolio/WatchlistTable";
import { HistoryTable } from "@/components/portfolio/HistoryTable";
import {
  getPortfolioSummary,
  getOpenPositions,
  getWatchlist,
  getPositionHistory,
} from "@/lib/queries/portfolio";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { tab = "positions" } = await searchParams;
  const userId = session.user.id;

  const [user, summary] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { cashBalanceCents: true, lastTopUpAt: true },
    }),
    getPortfolioSummary(userId),
  ]);

  if (!user) redirect("/auth/signin");

  const isOnCooldown =
    user.lastTopUpAt !== null &&
    Date.now() - user.lastTopUpAt.getTime() < 24 * 60 * 60 * 1000;
  const nextTopUpAt =
    isOnCooldown && user.lastTopUpAt
      ? new Date(user.lastTopUpAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null;

  const openPositions = tab === "positions" ? await getOpenPositions(userId) : null;
  const watchlist = tab === "watchlist" ? await getWatchlist(userId) : null;
  const history = tab === "history" ? await getPositionHistory(userId) : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-2">Portfolio</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Your balance and open positions
        </p>
      </div>

      <BalanceTopUp
        initialCashBalanceCents={Number(user.cashBalanceCents)}
        initialNextTopUpAt={nextTopUpAt}
      />

      <PortfolioSummary summary={summary} />

      <PortfolioTabs />

      {tab === "positions" && openPositions && (
        <PositionsTable positions={openPositions} />
      )}
      {tab === "watchlist" && watchlist && (
        <WatchlistTable initialItems={watchlist} />
      )}
      {tab === "history" && history && (
        <HistoryTable history={history} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: only the two pre-existing errors in `TopNav.tsx` and `FeedControls.tsx` — no new errors.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/app/portfolio/page.tsx && git commit -m "feat: portfolio page with summary + tabbed positions/watchlist/history"
```

---

### Task 6: WatchlistButton + market detail page

**Files:**
- Create: `src/components/markets/WatchlistButton.tsx`
- Modify: `src/app/markets/[marketId]/page.tsx`

- [ ] **Step 1: Create `src/components/markets/WatchlistButton.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";

interface WatchlistButtonProps {
  marketId: string;
  initialBookmarked: boolean;
}

export function WatchlistButton({ marketId, initialBookmarked }: WatchlistButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const method = bookmarked ? "DELETE" : "POST";
    setBookmarked(!bookmarked);
    await fetch(`/api/watchlist/${marketId}`, { method });
    setLoading(false);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      title={bookmarked ? "Remove from watchlist" : "Add to watchlist"}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-40"
      style={{
        backgroundColor: bookmarked
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        color: bookmarked ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.4)",
      }}
    >
      <Bookmark
        className="h-3.5 w-3.5"
        fill={bookmarked ? "currentColor" : "none"}
      />
      {bookmarked ? "Saved" : "Watch"}
    </button>
  );
}
```

- [ ] **Step 2: Modify `src/app/markets/[marketId]/page.tsx`**

Add `WatchlistButton` import and check if the current user has bookmarked this market. Replace the entire file:

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BuyPanel } from "@/components/markets/BuyPanel";
import { WatchlistButton } from "@/components/markets/WatchlistButton";
import { formatDate, formatVolume } from "@/lib/format";
import { metricLabel } from "@/lib/metricLabel";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  const session = await auth();

  const market = await db.market.findUnique({
    where: { id: marketId },
    include: {
      company: true,
      earningsEvent: true,
    },
  });

  if (!market) notFound();

  const isOpen = market.status === "OPEN";

  const bookmarked = session?.user?.id
    ? !!(await db.watchlist.findUnique({
        where: {
          userId_marketId: {
            userId: session.user.id,
            marketId: market.id,
          },
        },
      }))
    : false;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Breadcrumb + watchlist button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {market.company.ticker} · {metricLabel(market.metricType)} · Reports{" "}
          {formatDate(market.earningsEvent.reportDate)}
        </p>
        {session && (
          <WatchlistButton
            marketId={market.id}
            initialBookmarked={bookmarked}
          />
        )}
      </div>

      {/* Question */}
      <h1 className="text-xl font-medium text-white mb-2">{market.question}</h1>
      <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
        Threshold: {market.thresholdLabel}
        {market.consensusEstimate ? ` · Analyst est. ${market.consensusEstimate}` : ""}
      </p>

      {/* Prices + volume */}
      <div className="flex items-center gap-6 mb-8">
        <div>
          <p
            className="text-2xl font-semibold tabular"
            style={{ color: "var(--color-yes)" }}
          >
            {market.yesPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            YES
          </p>
        </div>
        <div>
          <p
            className="text-2xl font-semibold tabular"
            style={{ color: "var(--color-no)" }}
          >
            {market.noPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            NO
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-medium text-white/60 tabular">
            {formatVolume(market.totalVolume)}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Total volume
          </p>
        </div>
      </div>

      {/* Buy panel (only shown when signed in) */}
      {session ? (
        <BuyPanel
          marketId={market.id}
          initialYesPrice={market.yesPriceLatest}
          initialNoPrice={market.noPriceLatest}
          isOpen={isOpen}
        />
      ) : (
        <div
          className="rounded-xl border p-6 text-center"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            <a href="/auth/signin" className="underline hover:text-white transition-colors">
              Sign in
            </a>{" "}
            to place bets.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: only the two pre-existing errors in `TopNav.tsx` and `FeedControls.tsx`.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/components/markets/WatchlistButton.tsx src/app/markets/ && git commit -m "feat: WatchlistButton on market detail page"
```
