# Betting Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow signed-in users to buy YES/NO shares on open markets with a linear AMM that updates the displayed probability on each trade.

**Architecture:** A pure AMM utility (`src/lib/amm.ts`) owns the pricing math and is unit-tested independently. A single API route (`POST /api/markets/[marketId]/buy`) runs the full buy transaction atomically. A client `BuyPanel` component renders the buy form with a live cost preview using the same AMM utility. The market detail page (`src/app/markets/[marketId]/page.tsx`) replaces its placeholder with real data and the BuyPanel.

**Tech Stack:** Prisma 5, Next.js 15 App Router, NextAuth v5, Vitest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Make `Trade.sellOrderId` nullable (AMM has no counterparty) |
| `src/lib/amm.ts` | Create | Pure AMM math: `ammCost`, `ammNewPrices` |
| `src/lib/__tests__/amm.test.ts` | Create | Unit tests for AMM formulas |
| `src/app/api/markets/[marketId]/buy/route.ts` | Create | POST endpoint: validate → calculate → transact |
| `src/components/markets/BuyPanel.tsx` | Create | Client component: side toggle, shares input, live preview, submit |
| `src/app/markets/[marketId]/page.tsx` | Modify | Replace placeholder with real market data + BuyPanel |

---

### Task 1: Schema change + AMM utility

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/lib/amm.ts`
- Create: `src/lib/__tests__/amm.test.ts`

- [ ] **Step 1: Make `Trade.sellOrderId` nullable in schema**

In `prisma/schema.prisma`, find the Trade model and change these two lines:

```prisma
  sellOrderId String?
  sellOrder   Order?   @relation("SellOrder", fields: [sellOrderId], references: [id])
```

(was `String` and `Order` — add `?` to both)

- [ ] **Step 2: Push schema to DB**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx prisma generate
```

- [ ] **Step 4: Create `src/lib/amm.ts`**

```typescript
export const SENSITIVITY = 40; // shares per 1 cent of price movement

/**
 * Total cost in cents to buy `shares` when current price for that side is `currentPrice` cents.
 * Uses linear AMM: price rises by 1 cent per SENSITIVITY shares.
 * Formula: integral of (currentPrice + x/SENSITIVITY) from 0 to shares
 *        = shares * currentPrice + shares² / (2 * SENSITIVITY)
 */
export function ammCost(shares: number, currentPrice: number): number {
  return shares * currentPrice + Math.floor((shares * shares) / (2 * SENSITIVITY));
}

/**
 * New YES and NO prices after buying `shares` of `side`.
 * Buying YES raises yesPriceLatest; buying NO raises noPriceLatest.
 * Both prices are clamped to [1, 99] and always sum to 100.
 */
export function ammNewPrices(
  shares: number,
  currentYesPrice: number,
  side: "YES" | "NO"
): { yesPriceLatest: number; noPriceLatest: number } {
  const delta = Math.floor(shares / SENSITIVITY);
  if (side === "YES") {
    const newYes = Math.min(99, Math.max(1, currentYesPrice + delta));
    return { yesPriceLatest: newYes, noPriceLatest: 100 - newYes };
  } else {
    const currentNoPrice = 100 - currentYesPrice;
    const newNo = Math.min(99, Math.max(1, currentNoPrice + delta));
    return { yesPriceLatest: 100 - newNo, noPriceLatest: newNo };
  }
}
```

- [ ] **Step 5: Write tests in `src/lib/__tests__/amm.test.ts`**

```typescript
import { describe, it, expect } from "vitest";
import { ammCost, ammNewPrices, SENSITIVITY } from "@/lib/amm";

describe("ammCost", () => {
  it("200 shares at price 50 → 10500 cents", () => {
    // 200*50 + 200²/80 = 10000 + 500 = 10500
    expect(ammCost(200, 50)).toBe(10_500);
  });

  it("10 shares at price 50 → 501 cents (minimal slippage)", () => {
    // 10*50 + 100/80 = 500 + 1 = 501
    expect(ammCost(10, 50)).toBe(501);
  });

  it("cost increases with shares due to slippage", () => {
    expect(ammCost(200, 50)).toBeGreaterThan(200 * 50);
  });
});

describe("ammNewPrices", () => {
  it("buying YES raises yesPriceLatest by floor(shares/SENSITIVITY)", () => {
    const result = ammNewPrices(200, 50, "YES");
    expect(result.yesPriceLatest).toBe(55); // 50 + floor(200/40)
    expect(result.noPriceLatest).toBe(45);  // 100 - 55
  });

  it("buying NO raises noPriceLatest and lowers yesPriceLatest", () => {
    const result = ammNewPrices(200, 50, "NO");
    expect(result.noPriceLatest).toBe(55);
    expect(result.yesPriceLatest).toBe(45);
  });

  it("clamps YES price at 99", () => {
    const result = ammNewPrices(400, 97, "YES");
    expect(result.yesPriceLatest).toBe(99);
    expect(result.noPriceLatest).toBe(1);
  });

  it("clamps NO price at 99", () => {
    const result = ammNewPrices(400, 3, "NO");
    expect(result.noPriceLatest).toBe(99);
    expect(result.yesPriceLatest).toBe(1);
  });

  it("prices always sum to 100", () => {
    const cases = [
      ammNewPrices(10, 50, "YES"),
      ammNewPrices(10, 50, "NO"),
      ammNewPrices(400, 97, "YES"),
      ammNewPrices(400, 3, "NO"),
    ];
    for (const { yesPriceLatest, noPriceLatest } of cases) {
      expect(yesPriceLatest + noPriceLatest).toBe(100);
    }
  });
});
```

- [ ] **Step 6: Run tests**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx vitest run src/lib/__tests__/amm.test.ts
```

Expected: `7 tests passed`

- [ ] **Step 7: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add prisma/schema.prisma src/lib/amm.ts src/lib/__tests__/amm.test.ts && git commit -m "feat: nullable Trade.sellOrderId + AMM pricing utility with tests"
```

---

### Task 2: Buy API route

**Files:**
- Create: `src/app/api/markets/[marketId]/buy/route.ts`

- [ ] **Step 1: Create directory and file**

Create `src/app/api/markets/[marketId]/buy/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ammCost, ammNewPrices } from "@/lib/amm";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  let body: { side: unknown; shares: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { side, shares } = body;

  if (side !== "YES" && side !== "NO") {
    return NextResponse.json({ error: "side must be YES or NO" }, { status: 400 });
  }
  if (!Number.isInteger(shares) || (shares as number) < 10) {
    return NextResponse.json({ error: "Minimum 10 shares" }, { status: 400 });
  }

  const sharesNum = shares as number;
  const sideEnum = side as "YES" | "NO";

  const market = await db.market.findUnique({
    where: { id: marketId },
    select: { id: true, status: true, yesPriceLatest: true, noPriceLatest: true },
  });

  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }
  if (market.status !== "OPEN") {
    return NextResponse.json({ error: "Market is not open for trading" }, { status: 400 });
  }

  const currentPrice = sideEnum === "YES" ? market.yesPriceLatest : market.noPriceLatest;
  const cost = ammCost(sharesNum, currentPrice);
  const newPrices = ammNewPrices(sharesNum, market.yesPriceLatest, sideEnum);
  const newCurrentPrice = sideEnum === "YES" ? newPrices.yesPriceLatest : newPrices.noPriceLatest;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { cashBalanceCents: true },
  });

  if (!user || Number(user.cashBalanceCents) < cost) {
    return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });
  }

  const result = await db.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: session.user.id },
      data: { cashBalanceCents: { decrement: BigInt(cost) } },
      select: { cashBalanceCents: true },
    });

    const order = await tx.order.create({
      data: {
        marketId: market.id,
        userId: session.user.id,
        side: sideEnum,
        price: currentPrice,
        shares: sharesNum,
        filledShares: sharesNum,
        status: "FILLED",
      },
    });

    await tx.trade.create({
      data: {
        marketId: market.id,
        buyOrderId: order.id,
        sellOrderId: null,
        side: sideEnum,
        price: currentPrice,
        shares: sharesNum,
      },
    });

    const existing = await tx.position.findUnique({
      where: {
        marketId_userId_side: {
          marketId: market.id,
          userId: session.user.id,
          side: sideEnum,
        },
      },
    });

    let position;
    if (existing) {
      const totalShares = existing.shares + sharesNum;
      const newAvgCost = Math.floor(
        (existing.shares * existing.avgCostCents + cost) / totalShares
      );
      const unrealizedPL = totalShares * (newCurrentPrice - newAvgCost);
      position = await tx.position.update({
        where: { id: existing.id },
        data: {
          shares: totalShares,
          avgCostCents: newAvgCost,
          currentPrice: newCurrentPrice,
          unrealizedPL,
        },
      });
    } else {
      const avgCostCents = Math.floor(cost / sharesNum);
      position = await tx.position.create({
        data: {
          marketId: market.id,
          userId: session.user.id,
          side: sideEnum,
          shares: sharesNum,
          avgCostCents,
          currentPrice: newCurrentPrice,
          unrealizedPL: 0,
        },
      });
    }

    await tx.market.update({
      where: { id: market.id },
      data: {
        yesPriceLatest: newPrices.yesPriceLatest,
        noPriceLatest: newPrices.noPriceLatest,
        totalVolume: { increment: BigInt(cost) },
        volume24h: { increment: BigInt(cost) },
      },
    });

    return { updatedUser, position, newPrices };
  });

  return NextResponse.json({
    cashBalanceCents: Number(result.updatedUser.cashBalanceCents),
    yesPriceLatest: result.newPrices.yesPriceLatest,
    noPriceLatest: result.newPrices.noPriceLatest,
    position: {
      shares: result.position.shares,
      avgCostCents: result.position.avgCostCents,
      currentPrice: result.position.currentPrice,
      unrealizedPL: result.position.unrealizedPL,
    },
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "api/markets"
```

Expected: no output (no errors in the new file).

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/app/api/markets/ && git commit -m "feat: POST /api/markets/[marketId]/buy with AMM pricing"
```

---

### Task 3: BuyPanel component

**Files:**
- Create: `src/components/markets/BuyPanel.tsx`

- [ ] **Step 1: Create `src/components/markets/BuyPanel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { ammCost, ammNewPrices } from "@/lib/amm";
import { formatCents } from "@/lib/format";
import { cn } from "@/lib/cn";

interface BuyPanelProps {
  marketId: string;
  initialYesPrice: number;
  initialNoPrice: number;
  isOpen: boolean;
}

export function BuyPanel({
  marketId,
  initialYesPrice,
  initialNoPrice,
  isOpen,
}: BuyPanelProps) {
  const { update } = useSession();
  const [side, setSide] = useState<"YES" | "NO">("YES");
  const [shares, setShares] = useState(100);
  const [yesPrice, setYesPrice] = useState(initialYesPrice);
  const [noPrice, setNoPrice] = useState(initialNoPrice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentPrice = side === "YES" ? yesPrice : noPrice;
  const cost = ammCost(shares, currentPrice);
  const newPrices = ammNewPrices(shares, yesPrice, side);
  const newPrice = side === "YES" ? newPrices.yesPriceLatest : newPrices.noPriceLatest;
  const payout = shares * 100; // cents

  async function handleBuy() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const res = await fetch(`/api/markets/${marketId}/buy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ side, shares }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Something went wrong.");
      return;
    }

    setYesPrice(data.yesPriceLatest);
    setNoPrice(data.noPriceLatest);
    await update({ cashBalanceCents: data.cashBalanceCents });
    setSuccessMsg(
      `Bought ${shares} ${side} shares for ${formatCents(cost)}. New price: ${data.yesPriceLatest}¢ Yes / ${data.noPriceLatest}¢ No.`
    );
  }

  return (
    <div
      className="rounded-xl border p-6"
      style={{
        borderColor: "rgba(255,255,255,0.08)",
        backgroundColor: "rgba(255,255,255,0.02)",
      }}
    >
      <p
        className="text-xs uppercase tracking-wider mb-4"
        style={{ color: "rgba(255,255,255,0.3)" }}
      >
        Place bet
      </p>

      {/* YES / NO toggle */}
      <div
        className="flex rounded-lg p-1 mb-5 gap-1"
        style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
      >
        {(["YES", "NO"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={cn(
              "flex-1 py-2 rounded-md text-sm font-medium transition-all",
              side === s
                ? s === "YES"
                  ? "text-white"
                  : "text-white"
                : "text-white/40 hover:text-white/70"
            )}
            style={
              side === s
                ? {
                    backgroundColor:
                      s === "YES" ? "rgba(0,194,168,0.2)" : "rgba(245,166,35,0.2)",
                    color: s === "YES" ? "var(--color-yes)" : "var(--color-no)",
                  }
                : undefined
            }
          >
            {s}
          </button>
        ))}
      </div>

      {/* Shares input */}
      <div className="mb-5">
        <label
          className="block text-xs mb-2"
          style={{ color: "rgba(255,255,255,0.4)" }}
        >
          Shares (min 10)
        </label>
        <input
          type="number"
          min={10}
          step={10}
          value={shares}
          onChange={(e) => setShares(Math.max(10, parseInt(e.target.value) || 10))}
          className="w-full rounded-lg px-3 py-2 text-sm text-white tabular outline-none focus:ring-1"
          style={{
            backgroundColor: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        />
      </div>

      {/* Live preview */}
      <div
        className="rounded-lg p-4 mb-5 space-y-2"
        style={{ backgroundColor: "rgba(255,255,255,0.03)" }}
      >
        <div className="flex justify-between text-sm">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Cost</span>
          <span className="font-medium text-white tabular">{formatCents(cost)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>New price</span>
          <span
            className="font-medium tabular"
            style={{ color: side === "YES" ? "var(--color-yes)" : "var(--color-no)" }}
          >
            {newPrice}¢
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Payout if correct</span>
          <span className="font-medium text-white tabular">{formatCents(payout)}</span>
        </div>
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleBuy}
        disabled={!isOpen || loading}
        className="w-full py-3 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
        style={{
          backgroundColor:
            side === "YES" ? "rgba(0,194,168,0.15)" : "rgba(245,166,35,0.15)",
          color: side === "YES" ? "var(--color-yes)" : "var(--color-no)",
          border: `1px solid ${side === "YES" ? "rgba(0,194,168,0.3)" : "rgba(245,166,35,0.3)"}`,
        }}
      >
        {loading ? "Placing bet…" : isOpen ? `Buy ${side}` : "Market closed"}
      </button>

      {error && (
        <p className="text-xs mt-3" style={{ color: "var(--color-no)" }}>
          {error}
        </p>
      )}
      {successMsg && (
        <p className="text-xs mt-3" style={{ color: "var(--color-yes)" }}>
          {successMsg}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep "BuyPanel"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/components/markets/BuyPanel.tsx && git commit -m "feat: BuyPanel client component with live AMM cost preview"
```

---

### Task 4: Market detail page

**Files:**
- Modify: `src/app/markets/[marketId]/page.tsx`

- [ ] **Step 1: Replace the placeholder with real market detail page**

Replace the entire contents of `src/app/markets/[marketId]/page.tsx`:

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

- [ ] **Step 2: TypeScript check**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx tsc --noEmit 2>&1 | grep -v "node_modules"
```

Expected: no new errors.

- [ ] **Step 3: Start dev server and test manually**

```bash
cd C:\Users\jmena\Desktop\stockbet && npx next dev
```

Test checklist:
1. Go to `/markets` → click any contract row → lands on market detail page
2. Page shows question, threshold, YES/NO prices, total volume
3. Not signed in → shows "Sign in to place bets"
4. Sign in → BuyPanel appears with YES/NO toggle, shares input, live preview
5. Change shares → Cost, New price, Payout update immediately (no API call)
6. Click "Buy YES" → confirmation message appears, TopNav balance decreases
7. Prices on the page update to reflect new AMM prices

Stop with Ctrl+C.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\jmena\Desktop\stockbet && git add src/app/markets/ && git commit -m "feat: market detail page with BuyPanel"
```
