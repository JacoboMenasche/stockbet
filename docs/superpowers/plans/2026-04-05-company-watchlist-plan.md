# Company Watchlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the market-level watchlist with a company-level watchlist where users bookmark companies and see all their open markets grouped under each company in the portfolio watchlist tab.

**Architecture:** Swap the `Watchlist` model for a new `CompanyWatchlist` model (userId + companyId). A `CompanyWatchlistButton` on the company page toggles the bookmark. The portfolio watchlist tab renders a `CompanyWatchlistTable` that groups open markets under each bookmarked company header.

**Tech Stack:** Prisma 5, Next.js 15 App Router, NextAuth v5

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Remove `Watchlist`, add `CompanyWatchlist` + reverse relations |
| `src/lib/queries/portfolio.ts` | Modify | Remove `getWatchlist`/`WatchlistItem`, add `getCompanyWatchlist`/`CompanyWatchlistItem` |
| `src/app/api/watchlist/[marketId]/route.ts` | Delete | No longer needed |
| `src/app/api/company-watchlist/[companyId]/route.ts` | Create | POST/DELETE company bookmark |
| `src/components/markets/WatchlistButton.tsx` | Delete | Replaced by company-level button |
| `src/components/company/CompanyWatchlistButton.tsx` | Create | Client toggle button on company page |
| `src/components/portfolio/WatchlistTable.tsx` | Delete | Replaced by CompanyWatchlistTable |
| `src/components/portfolio/CompanyWatchlistTable.tsx` | Create | Grouped company + markets watchlist |
| `src/app/portfolio/page.tsx` | Modify | Use `getCompanyWatchlist` + `CompanyWatchlistTable` |
| `src/app/markets/[marketId]/page.tsx` | Modify | Remove `WatchlistButton` |
| `src/app/company/[ticker]/page.tsx` | Modify | Add `CompanyWatchlistButton` |

---

### Task 1: Update schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Remove `Watchlist` model and its reverse relations**

In `prisma/schema.prisma`:

Remove the entire `Watchlist` block (lines ~257–271):
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

In the `Market` model, remove:
```prisma
  watchlist           Watchlist[]
```

In the `User` model, remove:
```prisma
  watchlist Watchlist[]
```

- [ ] **Step 2: Add `CompanyWatchlist` model and reverse relations**

After the `Resolution` model, add:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// CompanyWatchlist
// User-bookmarked companies shown on the portfolio watchlist tab.
// ─────────────────────────────────────────────────────────────────────────────

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

In the `Company` model, add after `stockPrices StockPriceCache[]`:
```prisma
  companyWatchlist CompanyWatchlist[]
```

In the `User` model, add after `positions Position[]`:
```prisma
  companyWatchlist CompanyWatchlist[]
```

- [ ] **Step 3: Push schema to DB**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Regenerate Prisma client**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add prisma/schema.prisma && git commit -m "feat: replace Watchlist with CompanyWatchlist model"
```

---

### Task 2: Update portfolio query functions

**Files:**
- Modify: `src/lib/queries/portfolio.ts`

- [ ] **Step 1: Replace `getWatchlist` with `getCompanyWatchlist`**

Replace the entire contents of `src/lib/queries/portfolio.ts` with:

```typescript
import { db } from "@/lib/db";

export type OpenPosition = Awaited<ReturnType<typeof getOpenPositions>>[number];
export type CompanyWatchlistItem = Awaited<ReturnType<typeof getCompanyWatchlist>>[number];
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

Expected: no output (errors elsewhere are pre-existing and expected).

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/lib/queries/portfolio.ts && git commit -m "feat: replace getWatchlist with getCompanyWatchlist"
```

---

### Task 3: Delete old watchlist files

**Files:**
- Delete: `src/app/api/watchlist/[marketId]/route.ts`
- Delete: `src/components/markets/WatchlistButton.tsx`
- Delete: `src/components/portfolio/WatchlistTable.tsx`

- [ ] **Step 1: Delete the three files**

```bash
cd C:\Users\jmena\Desktop\stockbet && rm src/app/api/watchlist/[marketId]/route.ts && rm src/components/markets/WatchlistButton.tsx && rm src/components/portfolio/WatchlistTable.tsx
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add -A && git commit -m "chore: remove market-level watchlist files"
```

---

### Task 4: Create company-watchlist API route

**Files:**
- Create: `src/app/api/company-watchlist/[companyId]/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;

  await db.companyWatchlist.upsert({
    where: { userId_companyId: { userId: session.user.id, companyId } },
    create: { userId: session.user.id, companyId },
    update: {},
  });

  return NextResponse.json({ bookmarked: true });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ companyId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { companyId } = await context.params;

  await db.companyWatchlist.deleteMany({
    where: { userId: session.user.id, companyId },
  });

  return NextResponse.json({ bookmarked: false });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "api/company-watchlist"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/app/api/company-watchlist/ && git commit -m "feat: POST/DELETE /api/company-watchlist/[companyId]"
```

---

### Task 5: Create CompanyWatchlistButton

**Files:**
- Create: `src/components/company/CompanyWatchlistButton.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";

interface CompanyWatchlistButtonProps {
  companyId: string;
  initialBookmarked: boolean;
}

export function CompanyWatchlistButton({
  companyId,
  initialBookmarked,
}: CompanyWatchlistButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const method = bookmarked ? "DELETE" : "POST";
    setBookmarked(!bookmarked);
    await fetch(`/api/company-watchlist/${companyId}`, { method });
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

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "CompanyWatchlistButton"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/components/company/CompanyWatchlistButton.tsx && git commit -m "feat: CompanyWatchlistButton component"
```

---

### Task 6: Create CompanyWatchlistTable

**Files:**
- Create: `src/components/portfolio/CompanyWatchlistTable.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { daysUntil } from "@/lib/format";
import type { CompanyWatchlistItem } from "@/lib/queries/portfolio";

interface CompanyWatchlistTableProps {
  initialItems: CompanyWatchlistItem[];
}

export function CompanyWatchlistTable({ initialItems }: CompanyWatchlistTableProps) {
  const [items, setItems] = useState(initialItems);

  async function handleRemove(companyId: string) {
    setItems((prev) => prev.filter((i) => i.companyId !== companyId));
    await fetch(`/api/company-watchlist/${companyId}`, { method: "DELETE" });
  }

  if (items.length === 0) {
    return (
      <p className="text-sm py-12 text-center" style={{ color: "rgba(255,255,255,0.3)" }}>
        No companies watchlisted yet. Add them from the company page.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.id}>
          {/* Company header */}
          <div
            className="flex items-center justify-between py-2 mb-2"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-3">
              <Link
                href={`/company/${item.company.ticker}`}
                className="text-white font-medium hover:underline"
              >
                {item.company.name}
              </Link>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{
                  backgroundColor: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {item.company.ticker}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(item.companyId)}
              className="p-1 rounded hover:bg-white/10 transition-colors"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Markets under this company */}
          {item.company.markets.length === 0 ? (
            <p className="text-xs py-3 pl-2" style={{ color: "rgba(255,255,255,0.25)" }}>
              No open markets.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {["Market", "YES", "NO", "Days left"].map((h) => (
                    <th
                      key={h}
                      className="pb-2 text-left font-normal text-xs"
                      style={{ color: "rgba(255,255,255,0.3)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.company.markets.map((m) => (
                  <tr
                    key={m.id}
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  >
                    <td className="py-2 pr-4">
                      <Link
                        href={`/markets/${m.id}`}
                        className="text-white hover:underline line-clamp-2 max-w-sm block"
                      >
                        {m.question}
                      </Link>
                    </td>
                    <td
                      className="py-2 pr-4 tabular font-medium"
                      style={{ color: "var(--color-yes)" }}
                    >
                      {m.yesPriceLatest}¢
                    </td>
                    <td
                      className="py-2 pr-4 tabular font-medium"
                      style={{ color: "var(--color-no)" }}
                    >
                      {m.noPriceLatest}¢
                    </td>
                    <td className="py-2 tabular" style={{ color: "rgba(255,255,255,0.45)" }}>
                      {daysUntil(m.earningsEvent.reportDate)}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "CompanyWatchlistTable"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/components/portfolio/CompanyWatchlistTable.tsx && git commit -m "feat: CompanyWatchlistTable grouped by company"
```

---

### Task 7: Update portfolio page

**Files:**
- Modify: `src/app/portfolio/page.tsx`

- [ ] **Step 1: Replace watchlist imports and usage**

Replace the entire file with:

```tsx
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BalanceTopUp } from "@/components/portfolio/BalanceTopUp";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { CompanyWatchlistTable } from "@/components/portfolio/CompanyWatchlistTable";
import { HistoryTable } from "@/components/portfolio/HistoryTable";
import {
  getPortfolioSummary,
  getOpenPositions,
  getCompanyWatchlist,
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
  const watchlist = tab === "watchlist" ? await getCompanyWatchlist(userId) : null;
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

      <Suspense>
        <PortfolioTabs />
      </Suspense>

      {tab === "positions" && openPositions && (
        <PositionsTable positions={openPositions} />
      )}
      {tab === "watchlist" && watchlist && (
        <CompanyWatchlistTable initialItems={watchlist} />
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

Expected: only the two pre-existing errors in `TopNav.tsx` and `FeedControls.tsx`.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/app/portfolio/page.tsx && git commit -m "feat: portfolio watchlist tab uses CompanyWatchlistTable"
```

---

### Task 8: Update market detail page

**Files:**
- Modify: `src/app/markets/[marketId]/page.tsx`

- [ ] **Step 1: Remove WatchlistButton**

Replace the entire file with:

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BuyPanel } from "@/components/markets/BuyPanel";
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

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
        {market.company.ticker} · {metricLabel(market.metricType)} · Reports{" "}
        {formatDate(market.earningsEvent.reportDate)}
      </p>

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

      {/* Buy panel */}
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

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: only the two pre-existing errors in `TopNav.tsx` and `FeedControls.tsx`.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add "src/app/markets/[marketId]/page.tsx" && git commit -m "chore: remove WatchlistButton from market detail page"
```

---

### Task 9: Update company page

**Files:**
- Modify: `src/app/company/[ticker]/page.tsx`

- [ ] **Step 1: Add CompanyWatchlistButton to company page**

Replace the entire file with:

```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCompanyDetail } from "@/lib/queries/company";
import { StockChart } from "@/components/company/StockChart";
import { CompanyWatchlistButton } from "@/components/company/CompanyWatchlistButton";
import { metricLabel } from "@/lib/metricLabel";
import { formatVolume, daysUntil, formatDate } from "@/lib/format";
import { CountdownChip } from "@/components/markets/CountdownChip";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default async function CompanyPage({ params }: PageProps) {
  const { ticker } = await params;
  const session = await auth();

  let company;
  try {
    company = await getCompanyDetail(ticker);
  } catch {
    notFound();
  }

  const bookmarked = session?.user?.id
    ? !!(await db.companyWatchlist.findUnique({
        where: {
          userId_companyId: {
            userId: session.user.id,
            companyId: company.id,
          },
        },
      }))
    : false;

  const event = company.earningsEvents[0] ?? null;
  const markets = event?.markets ?? [];

  const chartData = company.stockPrices.map((p) => ({
    date: new Date(p.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    close: Number(p.close),
  }));

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <span
          className="inline-flex items-center justify-center h-10 w-16 rounded-md text-sm font-semibold tracking-wider"
          style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
        >
          {company.ticker}
        </span>
        <div>
          <h1 className="text-xl font-medium text-white">{company.name}</h1>
          {company.sector && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {company.sector}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {event && (
            <>
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
                Reports {formatDate(event.reportDate)}
              </span>
              <CountdownChip days={daysUntil(event.reportDate)} />
            </>
          )}
          {session && (
            <CompanyWatchlistButton
              companyId={company.id}
              initialBookmarked={bookmarked}
            />
          )}
        </div>
      </div>

      {/* Stock chart */}
      <div
        className="rounded-xl border p-4 mb-6"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
          Price — last 90 days
        </p>
        <StockChart data={chartData} ticker={company.ticker} />
      </div>

      {/* Bets grid */}
      {markets.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No open markets for this company.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            Open contracts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {markets.map((m) => (
              <Link
                key={m.id}
                href={`/markets/${m.id}`}
                className="rounded-xl border p-4 block hover:border-white/20 transition-colors"
                style={{
                  borderColor: "rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <p
                  className="text-xs uppercase tracking-wider mb-1"
                  style={{ color: "rgba(255,255,255,0.35)" }}
                >
                  {metricLabel(m.metricType)}
                </p>
                <p className="text-sm font-medium text-white mb-3">{m.question}</p>
                <div className="flex gap-2 mb-3">
                  <span
                    className="flex-1 text-center py-1.5 rounded-lg text-sm font-semibold"
                    style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
                  >
                    YES {m.yesPriceLatest}¢
                  </span>
                  <span
                    className="flex-1 text-center py-1.5 rounded-lg text-sm font-semibold"
                    style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}
                  >
                    NO {m.noPriceLatest}¢
                  </span>
                </div>
                {m.consensusEstimate && (
                  <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                    Consensus {m.consensusEstimate}
                    {m.analystRangeLow && m.analystRangeHigh
                      ? ` · Range ${m.analystRangeLow}–${m.analystRangeHigh}`
                      : ""}
                  </p>
                )}
                <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                  Vol {formatVolume(m.volume24h)} (24h)
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: only the two pre-existing errors in `TopNav.tsx` and `FeedControls.tsx`.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add "src/app/company/[ticker]/page.tsx" && git commit -m "feat: CompanyWatchlistButton on company page"
```
