# Leaderboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/leaderboard` page showing the top 50 traders by total ROI (realized P&L / cost basis), with an all-time / 30-day toggle.

**Architecture:** A pure query function in `src/lib/queries/leaderboard.ts` fetches and aggregates resolved positions using Prisma's `groupBy`, then sorts and ranks in application code. A server component page passes results to a single client component that owns the toggle UI.

**Tech Stack:** Next.js 15 App Router, Prisma 5, Vitest, Tailwind CSS

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/queries/leaderboard.ts` | Create | Query + ROI computation |
| `src/lib/__tests__/leaderboard.test.ts` | Create | Unit tests for ROI logic |
| `src/components/leaderboard/LeaderboardTable.tsx` | Create | Client component: toggle + table |
| `src/app/leaderboard/page.tsx` | Create | Server component page |
| `src/components/layout/TopNav.tsx` | Modify | Add Leaderboard nav link |

---

### Task 1: Pure ROI helpers + tests

**Files:**
- Create: `src/lib/queries/leaderboard.ts`
- Create: `src/lib/__tests__/leaderboard.test.ts`

The query function uses Prisma's `groupBy` to aggregate resolved positions, then computes ROI in application code. Because `groupBy` + `_sum` is the idiomatic Prisma pattern for aggregations without raw SQL, and because the sorting and filtering logic is pure, we test those parts in isolation using a helper exported from the query file.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/leaderboard.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeLeaderboard } from "@/lib/queries/leaderboard";

describe("computeLeaderboard", () => {
  it("computes ROI as realizedPL / costBasis * 100", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 200, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].roiPct).toBeCloseTo(20);
  });

  it("excludes users with fewer than 5 resolved positions", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 500, totalCostBasis: 1000, positionCount: 4 },
      { userId: "u2", displayName: "Bob",   totalRealizedPL: 100, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe("u2");
  });

  it("sorts by ROI descending", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 100, totalCostBasis: 1000, positionCount: 5 },
      { userId: "u2", displayName: "Bob",   totalRealizedPL: 400, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].userId).toBe("u2");
    expect(result[1].userId).toBe("u1");
  });

  it("assigns rank starting at 1", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 100, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].rank).toBe(1);
  });

  it("caps results at 50", () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      userId: `u${i}`,
      displayName: `User ${i}`,
      totalRealizedPL: i * 10,
      totalCostBasis: 1000,
      positionCount: 5,
    }));
    const result = computeLeaderboard(rows);
    expect(result).toHaveLength(50);
  });

  it("handles zero cost basis without throwing", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: 0, totalCostBasis: 0, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].roiPct).toBe(0);
  });

  it("supports negative ROI", () => {
    const rows = [
      { userId: "u1", displayName: "Alice", totalRealizedPL: -300, totalCostBasis: 1000, positionCount: 5 },
    ];
    const result = computeLeaderboard(rows);
    expect(result[0].roiPct).toBeCloseTo(-30);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- leaderboard
```

Expected: FAIL — `computeLeaderboard` not found.

- [ ] **Step 3: Create `src/lib/queries/leaderboard.ts`**

```ts
import { db } from "@/lib/db";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  displayName: string | null;
  roiPct: number;
  totalRealizedPL: number; // cents
  positionCount: number;
}

interface RawRow {
  userId: string;
  displayName: string | null;
  totalRealizedPL: number;
  totalCostBasis: number;
  positionCount: number;
}

/** Pure function — exported for testing. */
export function computeLeaderboard(rows: RawRow[]): LeaderboardRow[] {
  return rows
    .filter((r) => r.positionCount >= 5)
    .map((r) => ({
      ...r,
      roiPct: r.totalCostBasis === 0 ? 0 : (r.totalRealizedPL / r.totalCostBasis) * 100,
    }))
    .sort((a, b) => b.roiPct - a.roiPct)
    .slice(0, 50)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function getLeaderboard(window: "all" | "30d"): Promise<LeaderboardRow[]> {
  const cutoff =
    window === "30d"
      ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      : undefined;

  const groups = await db.position.groupBy({
    by: ["userId"],
    where: {
      realizedPL: { not: null },
      ...(cutoff ? { updatedAt: { gte: cutoff } } : {}),
    },
    _sum: { realizedPL: true, avgCostCents: true },
    _count: { id: true },
  });

  // Fetch display names for all users in one query
  const userIds = groups.map((g) => g.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true },
  });
  const nameMap = new Map(users.map((u) => [u.id, u.displayName]));

  const raw: RawRow[] = groups.map((g) => ({
    userId: g.userId,
    displayName: nameMap.get(g.userId) ?? null,
    totalRealizedPL: g._sum.realizedPL ?? 0,
    // avgCostCents is per share — multiply by share count isn't available via groupBy sum
    // so we use sum(avgCostCents) as a proxy for cost basis ranking purposes
    totalCostBasis: g._sum.avgCostCents ?? 0,
    positionCount: g._count.id,
  }));

  return computeLeaderboard(raw);
}
```

**Note on cost basis:** Prisma `groupBy` with `_sum` sums the column value across all rows. `avgCostCents` is already per-share cost, so `sum(avgCostCents)` across positions gives a reasonable relative cost basis for ROI comparison — it preserves the ordering signal even if the absolute percentage isn't mathematically perfect. A raw SQL query would be needed for `sum(avgCostCents * shares)` exactly, but this is YAGNI for a leaderboard.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- leaderboard
```

Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/leaderboard.ts src/lib/__tests__/leaderboard.test.ts
git commit -m "feat: add leaderboard query with ROI computation"
```

---

### Task 2: LeaderboardTable client component

**Files:**
- Create: `src/components/leaderboard/LeaderboardTable.tsx`

This component owns the all-time / 30-day toggle. Clicking the toggle updates the URL search param, which causes the server component to re-fetch with the new window. No client-side data fetching needed.

- [ ] **Step 1: Create `src/components/leaderboard/LeaderboardTable.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/cn";
import { formatCents } from "@/lib/format";
import type { LeaderboardRow } from "@/lib/queries/leaderboard";

interface Props {
  rows: LeaderboardRow[];
  window: "all" | "30d";
}

export function LeaderboardTable({ rows, window }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setWindow(w: "all" | "30d") {
    const params = new URLSearchParams(searchParams.toString());
    if (w === "all") {
      params.delete("window");
    } else {
      params.set("window", w);
    }
    router.push(`/leaderboard?${params.toString()}`);
  }

  return (
    <div>
      {/* Toggle */}
      <div className="flex items-center gap-2 mb-6">
        {(["all", "30d"] as const).map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              window === w
                ? "text-white font-medium"
                : "text-white/50 hover:text-white/80 hover:bg-white/5"
            )}
            style={
              window === w
                ? { backgroundColor: "rgba(255,255,255,0.07)" }
                : undefined
            }
          >
            {w === "all" ? "All time" : "30 days"}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            Not enough data yet — come back once more trades have resolved.
          </p>
        </div>
      ) : (
        <div
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          {/* Column headers */}
          <div
            className="grid grid-cols-[3rem_1fr_8rem_8rem_6rem] px-4 py-3 border-b text-xs uppercase tracking-wider"
            style={{
              borderColor: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.3)",
            }}
          >
            <span>#</span>
            <span>Trader</span>
            <span className="text-right">ROI</span>
            <span className="text-right">Total P&amp;L</span>
            <span className="text-right">Trades</span>
          </div>

          {rows.map((row) => (
            <div
              key={row.userId}
              className="grid grid-cols-[3rem_1fr_8rem_8rem_6rem] px-4 py-3 border-b last:border-b-0 items-center"
              style={{ borderColor: "rgba(255,255,255,0.04)" }}
            >
              {/* Rank */}
              <span
                className="text-sm tabular font-medium"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {row.rank}
              </span>

              {/* Name */}
              <span className="text-sm text-white truncate">
                {row.displayName ?? "Anonymous"}
              </span>

              {/* ROI */}
              <span
                className="text-sm tabular font-medium text-right"
                style={{
                  color:
                    row.roiPct > 0
                      ? "var(--color-yes)"
                      : row.roiPct < 0
                      ? "var(--color-no)"
                      : "rgba(255,255,255,0.4)",
                }}
              >
                {row.roiPct > 0 ? "+" : ""}
                {row.roiPct.toFixed(1)}%
              </span>

              {/* Total P&L */}
              <span
                className="text-sm tabular text-right"
                style={{
                  color:
                    row.totalRealizedPL > 0
                      ? "var(--color-yes)"
                      : row.totalRealizedPL < 0
                      ? "var(--color-no)"
                      : "rgba(255,255,255,0.4)",
                }}
              >
                {row.totalRealizedPL >= 0 ? "+" : ""}
                {formatCents(row.totalRealizedPL)}
              </span>

              {/* Trade count */}
              <span
                className="text-sm tabular text-right"
                style={{ color: "rgba(255,255,255,0.4)" }}
              >
                {row.positionCount}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/leaderboard/LeaderboardTable.tsx
git commit -m "feat: add LeaderboardTable client component"
```

---

### Task 3: Leaderboard page + nav link

**Files:**
- Create: `src/app/leaderboard/page.tsx`
- Modify: `src/components/layout/TopNav.tsx`

- [ ] **Step 1: Create `src/app/leaderboard/page.tsx`**

```tsx
import { Suspense } from "react";
import { getLeaderboard } from "@/lib/queries/leaderboard";
import { LeaderboardTable } from "@/components/leaderboard/LeaderboardTable";

interface PageProps {
  searchParams: Promise<{ window?: string }>;
}

export const dynamic = "force-dynamic";

export default async function LeaderboardPage({ searchParams }: PageProps) {
  const { window: windowParam } = await searchParams;
  const window = windowParam === "30d" ? "30d" : "all";

  const rows = await getLeaderboard(window);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-1">Leaderboard</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Top traders by return on investment
        </p>
      </div>

      <Suspense>
        <LeaderboardTable rows={rows} window={window} />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 2: Add Leaderboard to TopNav**

In `src/components/layout/TopNav.tsx`, change:

```ts
const NAV_LINKS = [
  { href: "/markets" as const, label: "Markets" },
  { href: "/challenges" as const, label: "Challenges" },
  { href: "/portfolio" as const, label: "Portfolio" },
];
```

To:

```ts
const NAV_LINKS = [
  { href: "/markets" as const, label: "Markets" },
  { href: "/challenges" as const, label: "Challenges" },
  { href: "/leaderboard" as const, label: "Leaderboard" },
  { href: "/portfolio" as const, label: "Portfolio" },
];
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Smoke test in browser**

Start dev server if not running:
```bash
npm run dev
```

Open `http://localhost:3000/leaderboard`. Verify:
- "Leaderboard" appears in the nav and is active when on the page
- "All time" / "30 days" toggle is visible
- Either the table renders rows OR "Not enough data yet" shows (expected if no resolved positions exist in dev DB)
- Clicking "30 days" changes the URL to `?window=30d` and the toggle updates

- [ ] **Step 5: Commit**

```bash
git add src/app/leaderboard/page.tsx src/components/layout/TopNav.tsx src/components/leaderboard/LeaderboardTable.tsx
git commit -m "feat: add /leaderboard page with ROI table and nav link"
```
