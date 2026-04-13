# CLOB Trading System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the linear AMM with a Central Limit Order Book — users post limit orders, market orders fill instantly against the best available price, and the platform seeds each market with capped liquidity at 45¢/55¢.

**Architecture:** Pure matching functions in `order-book.ts` (fully unit-testable) orchestrated by `matching-engine.ts` (all DB ops). The existing `Order`/`Trade`/`Position` schema needs two new enums and one nullable field. `BuyPanel` is replaced by `TradePanel` + `OrderBook` components. `amm.ts` is deleted.

**Tech Stack:** Next.js 15 app router, Prisma + Neon PostgreSQL, Vitest for unit tests.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add `OrderAction`, `OrderType` enums; update `Order` |
| Create | `src/lib/order-book.ts` | Pure functions: getBestBid, getBestAsk, getMidPrice, matchMarketBuy, matchMarketSell, limitCrossesImmediately |
| Create | `src/lib/__tests__/order-book.test.ts` | Unit tests for all pure functions |
| Create | `src/lib/matching-engine.ts` | DB ops: placeOrder, seedMarket, cancelMarketOrders |
| Modify | `src/lib/create-daily-markets.ts` | Call seedMarket after each market create |
| Modify | `src/lib/resolve-markets.ts` | Call cancelMarketOrders before payouts |
| Modify | `src/app/api/markets/[marketId]/buy/route.ts` | Replace AMM with placeOrder |
| Create | `src/app/api/markets/[marketId]/sell/route.ts` | Sell YES/NO shares |
| Create | `src/app/api/markets/[marketId]/orderbook/route.ts` | GET aggregated order book |
| Create | `src/app/api/markets/[marketId]/orders/[orderId]/route.ts` | DELETE cancel order |
| Create | `src/components/markets/TradePanel.tsx` | Buy/Sell/Limit/Market widget (replaces BuyPanel) |
| Create | `src/components/markets/OrderBook.tsx` | Order book display component |
| Modify | `src/app/markets/[marketId]/page.tsx` | Use TradePanel + OrderBook; fetch order book |
| Modify | `src/lib/queries/portfolio.ts` | Add getOpenOrders query |
| Modify | `src/app/portfolio/page.tsx` | Open Orders section |
| Delete | `src/lib/amm.ts` | Replaced by order-book.ts |
| Delete | `src/lib/__tests__/amm.test.ts` | Replaced by order-book.test.ts |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add two new enums after the existing `OrderStatus` enum**

Open `prisma/schema.prisma`. After the `OrderStatus` enum (around line 37), add:

```prisma
enum OrderAction {
  BUY
  SELL
}

enum OrderType {
  LIMIT
  MARKET
}
```

- [ ] **Step 2: Update the Order model**

Find the `Order` model. Change `price Int // cents (1–99)` to nullable, and add `action` and `orderType` fields:

```prisma
model Order {
  id       String @id @default(cuid())
  marketId String
  market   Market @relation(fields: [marketId], references: [id])
  userId   String
  user     User   @relation(fields: [userId], references: [id])

  side         Side
  action       OrderAction @default(BUY)
  orderType    OrderType   @default(LIMIT)
  price        Int?        // cents (1–99); null for market orders
  shares       Int
  filledShares Int         @default(0)
  status       OrderStatus @default(OPEN)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  buyTrades  Trade[] @relation("BuyOrder")
  sellTrades Trade[] @relation("SellOrder")

  @@index([marketId, side, price, status])
  @@index([userId])
}
```

- [ ] **Step 3: Push schema to database**

```bash
cd /Users/jacobomenasche/Desktop/stockbets
npx prisma db push --env-file .env
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Verify generated client has new types**

```bash
grep -n "OrderAction\|OrderType" node_modules/.prisma/client/index.d.ts | head -10
```

Expected: Lines showing `OrderAction` and `OrderType` enums.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add OrderAction and OrderType enums, make Order.price nullable"
```

---

## Task 2: Pure Functions — order-book.ts + tests

**Files:**
- Create: `src/lib/order-book.ts`
- Create: `src/lib/__tests__/order-book.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/order-book.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  getBestBid,
  getBestAsk,
  getMidPrice,
  matchMarketBuy,
  matchMarketSell,
  limitCrossesImmediately,
  type BookEntry,
} from "@/lib/order-book";

describe("getBestBid", () => {
  it("returns the highest price from bids", () => {
    const bids: BookEntry[] = [
      { id: "a", userId: "u1", price: 45, available: 100 },
      { id: "b", userId: "u2", price: 62, available: 50 },
      { id: "c", userId: "u3", price: 50, available: 200 },
    ];
    expect(getBestBid(bids)).toBe(62);
  });

  it("returns null for an empty book", () => {
    expect(getBestBid([])).toBeNull();
  });
});

describe("getBestAsk", () => {
  it("returns the lowest price from asks", () => {
    const asks: BookEntry[] = [
      { id: "a", userId: "u1", price: 55, available: 500 },
      { id: "b", userId: "u2", price: 58, available: 150 },
      { id: "c", userId: "u3", price: 61, available: 300 },
    ];
    expect(getBestAsk(asks)).toBe(55);
  });

  it("returns null for an empty book", () => {
    expect(getBestAsk([])).toBeNull();
  });
});

describe("getMidPrice", () => {
  it("returns (bid + ask) / 2 rounded when both sides exist", () => {
    expect(getMidPrice(54, 60, 50)).toBe(57);
  });

  it("rounds 0.5 up", () => {
    expect(getMidPrice(45, 56, 50)).toBe(51); // (45+56)/2 = 50.5 → 51
  });

  it("falls back to lastTradePrice when bid is null", () => {
    expect(getMidPrice(null, 60, 50)).toBe(50);
  });

  it("falls back to lastTradePrice when ask is null", () => {
    expect(getMidPrice(54, null, 50)).toBe(50);
  });

  it("falls back to lastTradePrice when both are null", () => {
    expect(getMidPrice(null, null, 42)).toBe(42);
  });
});

describe("matchMarketBuy", () => {
  const asks: BookEntry[] = [
    { id: "a1", userId: "seller1", price: 55, available: 500 },
    { id: "a2", userId: "seller2", price: 58, available: 150 },
    { id: "a3", userId: "seller3", price: 61, available: 300 },
  ];

  it("fills entirely from the lowest ask when sufficient", () => {
    const { fills, remainingShares } = matchMarketBuy(100, asks);
    expect(fills).toHaveLength(1);
    expect(fills[0]).toEqual({ orderId: "a1", shares: 100, price: 55, counterpartyUserId: "seller1" });
    expect(remainingShares).toBe(0);
  });

  it("sweeps across multiple price levels", () => {
    const { fills, remainingShares } = matchMarketBuy(600, asks);
    expect(fills).toHaveLength(2);
    expect(fills[0]).toEqual({ orderId: "a1", shares: 500, price: 55, counterpartyUserId: "seller1" });
    expect(fills[1]).toEqual({ orderId: "a2", shares: 100, price: 58, counterpartyUserId: "seller2" });
    expect(remainingShares).toBe(0);
  });

  it("returns remaining shares when book is exhausted", () => {
    const { fills, remainingShares } = matchMarketBuy(1100, asks);
    expect(fills).toHaveLength(3);
    expect(remainingShares).toBe(150); // 1100 - 500 - 150 - 300 = 150
  });

  it("returns empty fills and full remaining for an empty book", () => {
    const { fills, remainingShares } = matchMarketBuy(100, []);
    expect(fills).toHaveLength(0);
    expect(remainingShares).toBe(100);
  });
});

describe("matchMarketSell", () => {
  const bids: BookEntry[] = [
    { id: "b1", userId: "buyer1", price: 62, available: 200 },
    { id: "b2", userId: "buyer2", price: 54, available: 100 },
    { id: "b3", userId: "buyer3", price: 45, available: 500 },
  ];

  it("fills from the highest bid first", () => {
    const { fills, remainingShares } = matchMarketSell(100, bids);
    expect(fills).toHaveLength(1);
    expect(fills[0]).toEqual({ orderId: "b1", shares: 100, price: 62, counterpartyUserId: "buyer1" });
    expect(remainingShares).toBe(0);
  });

  it("sweeps multiple levels when needed", () => {
    const { fills, remainingShares } = matchMarketSell(350, bids);
    expect(fills[0]).toEqual({ orderId: "b1", shares: 200, price: 62, counterpartyUserId: "buyer1" });
    expect(fills[1]).toEqual({ orderId: "b2", shares: 100, price: 54, counterpartyUserId: "buyer2" });
    expect(fills[2]).toEqual({ orderId: "b3", shares: 50, price: 45, counterpartyUserId: "buyer3" });
    expect(remainingShares).toBe(0);
  });

  it("returns remaining when book exhausted", () => {
    const { fills, remainingShares } = matchMarketSell(1000, bids);
    expect(remainingShares).toBe(200); // 1000 - 200 - 100 - 500 = 200
  });
});

describe("limitCrossesImmediately", () => {
  it("limit BUY crosses when best ask <= buy price", () => {
    expect(limitCrossesImmediately("BUY", 60, 45, 55)).toBe(true);
    expect(limitCrossesImmediately("BUY", 60, 45, 60)).toBe(true); // exact match
    expect(limitCrossesImmediately("BUY", 60, 45, 61)).toBe(false);
  });

  it("limit SELL crosses when best bid >= sell price", () => {
    expect(limitCrossesImmediately("SELL", 50, 54, 60)).toBe(true);
    expect(limitCrossesImmediately("SELL", 50, 50, 60)).toBe(true); // exact match
    expect(limitCrossesImmediately("SELL", 50, 49, 60)).toBe(false);
  });

  it("returns false when the relevant side is null", () => {
    expect(limitCrossesImmediately("BUY", 60, null, null)).toBe(false);
    expect(limitCrossesImmediately("SELL", 50, null, null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect all to fail**

```bash
cd /Users/jacobomenasche/Desktop/stockbets
npm test -- order-book
```

Expected: FAIL — `Cannot find module '@/lib/order-book'`

- [ ] **Step 3: Create `src/lib/order-book.ts`**

```typescript
export type BookEntry = {
  id: string;
  userId: string;
  price: number;     // YES-equivalent price, 1–99
  available: number; // shares - filledShares
};

export type Fill = {
  orderId: string;
  shares: number;
  price: number;
  counterpartyUserId: string;
};

/** Highest price anyone is willing to pay for YES (best bid). */
export function getBestBid(bids: BookEntry[]): number | null {
  if (bids.length === 0) return null;
  return Math.max(...bids.map((b) => b.price));
}

/** Lowest price anyone is willing to sell YES for (best ask). */
export function getBestAsk(asks: BookEntry[]): number | null {
  if (asks.length === 0) return null;
  return Math.min(...asks.map((a) => a.price));
}

/** Mid price for display. Falls back to lastTradePrice if either side is empty. */
export function getMidPrice(
  bestBid: number | null,
  bestAsk: number | null,
  lastTradePrice: number
): number {
  if (bestBid !== null && bestAsk !== null) {
    return Math.round((bestBid + bestAsk) / 2);
  }
  return lastTradePrice;
}

/**
 * Match a market BUY against asks (sweeps lowest price first).
 * Returns fills array and any remaining unfilled shares.
 */
export function matchMarketBuy(
  shares: number,
  asks: BookEntry[]
): { fills: Fill[]; remainingShares: number } {
  const sorted = [...asks].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));
  const fills: Fill[] = [];
  let remaining = shares;

  for (const ask of sorted) {
    if (remaining <= 0) break;
    const filled = Math.min(remaining, ask.available);
    fills.push({ orderId: ask.id, shares: filled, price: ask.price, counterpartyUserId: ask.userId });
    remaining -= filled;
  }

  return { fills, remainingShares: remaining };
}

/**
 * Match a market SELL against bids (sweeps highest price first).
 * Returns fills array and any remaining unfilled shares.
 */
export function matchMarketSell(
  shares: number,
  bids: BookEntry[]
): { fills: Fill[]; remainingShares: number } {
  const sorted = [...bids].sort((a, b) => b.price - a.price || a.id.localeCompare(b.id));
  const fills: Fill[] = [];
  let remaining = shares;

  for (const bid of sorted) {
    if (remaining <= 0) break;
    const filled = Math.min(remaining, bid.available);
    fills.push({ orderId: bid.id, shares: filled, price: bid.price, counterpartyUserId: bid.userId });
    remaining -= filled;
  }

  return { fills, remainingShares: remaining };
}

/**
 * Returns true if a limit order would match immediately on arrival.
 * Limit BUY crosses if bestAsk <= buyPrice.
 * Limit SELL crosses if bestBid >= sellPrice.
 */
export function limitCrossesImmediately(
  action: "BUY" | "SELL",
  price: number,
  bestBid: number | null,
  bestAsk: number | null
): boolean {
  if (action === "BUY") return bestAsk !== null && bestAsk <= price;
  return bestBid !== null && bestBid >= price;
}
```

- [ ] **Step 4: Run tests — expect all to pass**

```bash
npm test -- order-book
```

Expected: 18 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/order-book.ts src/lib/__tests__/order-book.test.ts
git commit -m "feat: add order-book pure functions with tests"
```

---

## Task 3: Matching Engine

**Files:**
- Create: `src/lib/matching-engine.ts`

- [ ] **Step 1: Create `src/lib/matching-engine.ts`**

```typescript
import { db } from "@/lib/db";
import { OrderAction, OrderStatus, OrderType, Side } from "@prisma/client";
import {
  BookEntry,
  Fill,
  getBestBid,
  getBestAsk,
  getMidPrice,
  matchMarketBuy,
  matchMarketSell,
  limitCrossesImmediately,
} from "@/lib/order-book";

// ─── Constants ───────────────────────────────────────────────────────────────

export const PLATFORM_USER_ID = "platform";
const SEED_BID_PRICE = 45;
const SEED_ASK_PRICE = 55;
const SEED_SHARES = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

type DbOrder = {
  id: string;
  userId: string;
  side: Side;
  action: OrderAction;
  price: number | null;
  shares: number;
  filledShares: number;
};

export interface PlaceOrderParams {
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  action: "BUY" | "SELL";
  orderType: "LIMIT" | "MARKET";
  shares: number;
  price?: number; // required for LIMIT
}

export interface PlaceOrderResult {
  orderId: string;
  filledShares: number;
  avgFillPrice: number;
  status: string;
  newYesPrice: number;
  newNoPrice: number;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

/**
 * Convert an order's stored price to the YES-equivalent price used in the book.
 * Buy YES at P  → YES bid at P
 * Sell YES at P → YES ask at P
 * Buy NO at P   → YES ask at (100-P)   [buyer of NO = seller of YES equiv]
 * Sell NO at P  → YES bid at (100-P)   [seller of NO = buyer of YES equiv]
 */
function toYesEquivPrice(side: Side, price: number): number {
  return side === Side.YES ? price : 100 - price;
}

/**
 * Extract YES bids from open orders:
 * - Buy YES orders (willing to buy YES)
 * - Sell NO orders (equivalent to buying YES)
 */
function extractBids(orders: DbOrder[]): BookEntry[] {
  return orders
    .filter(
      (o) =>
        (o.action === OrderAction.BUY && o.side === Side.YES) ||
        (o.action === OrderAction.SELL && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: toYesEquivPrice(o.side, o.price!),
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);
}

/**
 * Extract YES asks from open orders:
 * - Sell YES orders (willing to sell YES)
 * - Buy NO orders (equivalent to selling YES)
 */
function extractAsks(orders: DbOrder[]): BookEntry[] {
  return orders
    .filter(
      (o) =>
        (o.action === OrderAction.SELL && o.side === Side.YES) ||
        (o.action === OrderAction.BUY && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: toYesEquivPrice(o.side, o.price!),
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);
}

// ─── Position helper ──────────────────────────────────────────────────────────

async function upsertPosition(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  userId: string,
  marketId: string,
  side: Side,
  sharesDelta: number, // positive = add, negative = reduce
  fillPrice: number
) {
  const existing = await tx.position.findUnique({
    where: { marketId_userId_side: { marketId, userId, side } },
  });

  if (existing) {
    const newShares = existing.shares + sharesDelta;
    if (newShares <= 0) {
      await tx.position.delete({
        where: { marketId_userId_side: { marketId, userId, side } },
      });
    } else {
      const newAvgCost =
        sharesDelta > 0
          ? Math.round(
              (existing.shares * existing.avgCostCents + sharesDelta * fillPrice) / newShares
            )
          : existing.avgCostCents;
      await tx.position.update({
        where: { marketId_userId_side: { marketId, userId, side } },
        data: {
          shares: newShares,
          avgCostCents: newAvgCost,
          currentPrice: fillPrice,
          unrealizedPL: newShares * (fillPrice - newAvgCost),
        },
      });
    }
  } else if (sharesDelta > 0) {
    await tx.position.create({
      data: {
        marketId,
        userId,
        side,
        shares: sharesDelta,
        avgCostCents: fillPrice,
        currentPrice: fillPrice,
        unrealizedPL: 0,
      },
    });
  }
}

// ─── placeOrder ───────────────────────────────────────────────────────────────

export async function placeOrder({
  userId,
  marketId,
  side,
  action,
  orderType,
  shares,
  price,
}: PlaceOrderParams): Promise<PlaceOrderResult> {
  // Validate inputs
  if (shares < 1) throw new Error("Minimum 1 share");
  if (orderType === "LIMIT") {
    if (!price || price < 1 || price > 99) throw new Error("Limit price must be 1–99");
  }

  const market = await db.market.findUnique({
    where: { id: marketId },
    select: { status: true, yesPriceLatest: true, noPriceLatest: true },
  });
  if (!market) throw new Error("Market not found");
  if (market.status !== "OPEN") throw new Error("Market is not open for trading");

  // Sellers must have a position to sell
  if (action === "SELL") {
    const pos = await db.position.findUnique({
      where: { marketId_userId_side: { marketId, userId, side: side as Side } },
      select: { shares: true },
    });
    if (!pos || pos.shares < shares) {
      throw new Error(`You have no ${side} shares to sell`);
    }
  }

  // Load all open orders from other users for matching
  const dbOrders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
      NOT: { userId },
    },
    select: {
      id: true, userId: true, side: true, action: true,
      price: true, shares: true, filledShares: true,
    },
  });

  const bids = extractBids(dbOrders as DbOrder[]);
  const asks = extractAsks(dbOrders as DbOrder[]);

  // Determine if this order is "buying YES" from the book's perspective
  const isBuyingYes =
    (side === "YES" && action === "BUY") || (side === "NO" && action === "SELL");

  const bookToMatch = isBuyingYes ? asks : bids;
  const matchFn = isBuyingYes ? matchMarketBuy : matchMarketSell;

  let fills: Fill[] = [];
  let remainingShares = shares;

  if (orderType === "MARKET") {
    const result = matchFn(shares, bookToMatch);
    fills = result.fills;
    remainingShares = result.remainingShares;
    if (fills.length === 0) {
      throw new Error("No liquidity available — try a limit order");
    }
  } else {
    // Limit order: match immediately if it crosses the spread
    const yesPrice = toYesEquivPrice(side as Side, price!);
    const bookAction = isBuyingYes ? "BUY" : "SELL";
    if (limitCrossesImmediately(bookAction, yesPrice, getBestBid(bids), getBestAsk(asks))) {
      const result = matchFn(shares, bookToMatch);
      fills = result.fills;
      remainingShares = result.remainingShares;
    }
    // remainingShares rest in the book
  }

  const filledCount = fills.reduce((s, f) => s + f.shares, 0);
  const totalFillCost = fills.reduce((s, f) => s + f.price * f.shares, 0);
  const avgFillPrice =
    filledCount > 0 ? Math.round(totalFillCost / filledCount) : (price ?? market.yesPriceLatest);

  // For resting limit BUY orders, reserve the balance upfront
  const restingReservation =
    orderType === "LIMIT" && action === "BUY" && remainingShares > 0
      ? price! * remainingShares
      : 0;
  const totalBuyerDebit = totalFillCost + restingReservation;

  if (action === "BUY") {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { cashBalanceCents: true },
    });
    if (!user || Number(user.cashBalanceCents) < totalBuyerDebit) {
      throw new Error("Insufficient balance");
    }
  }

  const orderStatus: OrderStatus =
    remainingShares === 0
      ? OrderStatus.FILLED
      : filledCount > 0
      ? OrderStatus.PARTIALLY_FILLED
      : OrderStatus.OPEN;

  const result = await db.$transaction(async (tx) => {
    // Create the order record
    const order = await tx.order.create({
      data: {
        marketId,
        userId,
        side: side as Side,
        action: action as OrderAction,
        orderType: orderType as OrderType,
        price: price ?? null,
        shares,
        filledShares: filledCount,
        status: orderStatus,
      },
    });

    // Process each fill
    for (const fill of fills) {
      const counterOrder = (dbOrders as DbOrder[]).find((o) => o.id === fill.orderId)!;
      const newCounterFilled = counterOrder.filledShares + fill.shares;
      const newCounterStatus =
        newCounterFilled >= counterOrder.shares
          ? OrderStatus.FILLED
          : OrderStatus.PARTIALLY_FILLED;

      // Trade record — buyOrderId is always the YES-buyer's order
      await tx.trade.create({
        data: {
          marketId,
          buyOrderId: isBuyingYes ? order.id : fill.orderId,
          sellOrderId: isBuyingYes ? fill.orderId : order.id,
          side: Side.YES,
          price: fill.price,
          shares: fill.shares,
        },
      });

      // Update counterparty order
      await tx.order.update({
        where: { id: fill.orderId },
        data: { filledShares: newCounterFilled, status: newCounterStatus },
      });

      if (isBuyingYes) {
        // We are the buyer; counterparty is a YES seller or NO buyer (ask side)
        // Credit the counterparty for their sale
        await tx.user.update({
          where: { id: fill.counterpartyUserId },
          data: { cashBalanceCents: { increment: BigInt(fill.price * fill.shares) } },
        });
        // Counterparty's position decreases (they sold)
        await upsertPosition(tx, fill.counterpartyUserId, marketId,
          counterOrder.side, -fill.shares, fill.price);
      } else {
        // We are the seller; counterparty is a YES buyer or NO seller (bid side)
        // Counterparty had reserved balance — they already paid, now we credit seller (us)
        await tx.user.update({
          where: { id: userId },
          data: { cashBalanceCents: { increment: BigInt(fill.price * fill.shares) } },
        });
        // Counterparty's position increases (they bought)
        await upsertPosition(tx, fill.counterpartyUserId, marketId,
          counterOrder.side, fill.shares, fill.price);
      }
    }

    // Debit the buyer (fills + resting reservation)
    if (action === "BUY" && totalBuyerDebit > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { cashBalanceCents: { decrement: BigInt(totalBuyerDebit) } },
      });
    }

    // Update our own position for filled shares
    if (filledCount > 0) {
      await upsertPosition(
        tx, userId, marketId, side as Side,
        action === "BUY" ? filledCount : -filledCount,
        avgFillPrice
      );
    }

    // Update market last trade price
    if (fills.length > 0) {
      const lastFill = fills[fills.length - 1];
      const newYes = Math.min(99, Math.max(1, isBuyingYes ? lastFill.price : 100 - lastFill.price));
      await tx.market.update({
        where: { id: marketId },
        data: {
          yesPriceLatest: newYes,
          noPriceLatest: 100 - newYes,
          totalVolume: { increment: BigInt(totalFillCost) },
          volume24h: { increment: BigInt(totalFillCost) },
        },
      });
    }

    return order;
  });

  const updatedMarket = await db.market.findUnique({
    where: { id: marketId },
    select: { yesPriceLatest: true, noPriceLatest: true },
  });

  return {
    orderId: result.id,
    filledShares: filledCount,
    avgFillPrice,
    status: orderStatus,
    newYesPrice: updatedMarket?.yesPriceLatest ?? market.yesPriceLatest,
    newNoPrice: updatedMarket?.noPriceLatest ?? market.noPriceLatest,
  };
}

// ─── seedMarket ───────────────────────────────────────────────────────────────

/**
 * Post platform limit orders for a new market: bid at 45¢ and ask at 55¢,
 * 500 shares each. Creates the platform user if it doesn't exist.
 */
export async function seedMarket(marketId: string): Promise<void> {
  await db.user.upsert({
    where: { id: PLATFORM_USER_ID },
    update: {},
    create: {
      id: PLATFORM_USER_ID,
      email: "platform@internal",
      cashBalanceCents: BigInt(0),
    },
  });

  await db.order.createMany({
    data: [
      {
        marketId,
        userId: PLATFORM_USER_ID,
        side: Side.YES,
        action: OrderAction.BUY,
        orderType: OrderType.LIMIT,
        price: SEED_BID_PRICE,
        shares: SEED_SHARES,
        filledShares: 0,
        status: OrderStatus.OPEN,
      },
      {
        marketId,
        userId: PLATFORM_USER_ID,
        side: Side.YES,
        action: OrderAction.SELL,
        orderType: OrderType.LIMIT,
        price: SEED_ASK_PRICE,
        shares: SEED_SHARES,
        filledShares: 0,
        status: OrderStatus.OPEN,
      },
    ],
  });
}

// ─── cancelMarketOrders ───────────────────────────────────────────────────────

/**
 * Cancel all open orders for a market and refund reserved balance to buyers.
 * Called at resolution before payouts.
 */
export async function cancelMarketOrders(marketId: string): Promise<void> {
  const openOrders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
    },
    select: { id: true, userId: true, action: true, price: true, shares: true, filledShares: true },
  });

  if (openOrders.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const order of openOrders) {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });

      // Refund reserved balance for resting BUY limit orders
      if (order.action === OrderAction.BUY && order.price !== null && order.userId !== PLATFORM_USER_ID) {
        const unfilledShares = order.shares - order.filledShares;
        if (unfilledShares > 0) {
          const refund = order.price * unfilledShares;
          await tx.user.update({
            where: { id: order.userId },
            data: { cashBalanceCents: { increment: BigInt(refund) } },
          });
        }
      }
    }
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jacobomenasche/Desktop/stockbets
npx tsc --noEmit 2>&1 | grep "matching-engine" | head -20
```

Expected: no errors for matching-engine.ts.

- [ ] **Step 3: Commit**

```bash
git add src/lib/matching-engine.ts
git commit -m "feat: add CLOB matching engine with placeOrder, seedMarket, cancelMarketOrders"
```

---

## Task 4: Wire seedMarket into market creation

**Files:**
- Modify: `src/lib/create-daily-markets.ts`

- [ ] **Step 1: Import seedMarket and call it after each market is created**

Open `src/lib/create-daily-markets.ts`. Add the import at the top:

```typescript
import { seedMarket } from "@/lib/matching-engine";
```

In `createPhase1Markets`, after `await db.market.create(...)`, add:

```typescript
  const market = await db.market.create({
    data: { ... }, // existing
  });

  await seedMarket(market.id);

  console.log(`[phase-1] Created Direction bet for ${ticker} on ${betDate.toDateString()}`);
```

In `createPhase2Markets`, `db.market.createMany` does not return IDs. Replace it with two separate `db.market.create` calls so we can seed each:

```typescript
  const moveMarket = await db.market.create({
    data: {
      companyId,
      question: `Will ${companyName} move more than ${moveThreshold}% today?`,
      metricType: MetricType.PERCENTAGE_MOVE,
      threshold: moveThreshold,
      thresholdLabel: `>${moveThreshold}%`,
      status: MarketStatus.OPEN,
      betDate,
      yesPriceLatest: 35,
      noPriceLatest: 65,
      volume24h: 0,
    },
  });
  await seedMarket(moveMarket.id);

  const targetMarket = await db.market.create({
    data: {
      companyId,
      question: `Will ${companyName} close at or above $${targetPrice.toFixed(2)} today?`,
      metricType: MetricType.PRICE_TARGET,
      threshold: targetPrice,
      thresholdLabel: `$${targetPrice.toFixed(2)}`,
      status: MarketStatus.OPEN,
      betDate,
      yesPriceLatest: 40,
      noPriceLatest: 60,
      volume24h: 0,
    },
  });
  await seedMarket(targetMarket.id);

  console.log(`[phase-2] Created Move + Price Target bets for ${ticker} — open: $${basePrice}, target: $${targetPrice}, move threshold: ${moveThreshold}%`);
```

Remove the old `db.market.createMany` call entirely.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "create-daily-markets" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/create-daily-markets.ts
git commit -m "feat: seed each new market with platform limit orders at 45/55"
```

---

## Task 5: Wire cancelMarketOrders into resolution

**Files:**
- Modify: `src/lib/resolve-markets.ts`

- [ ] **Step 1: Import and call cancelMarketOrders**

Open `src/lib/resolve-markets.ts`. Add to the existing import from `@/lib/challenges`:

```typescript
import { resolveChallengesForDate, awardPerformanceBonuses } from "@/lib/challenges";
import { cancelMarketOrders } from "@/lib/matching-engine";
```

In `resolveMarket`, at the very start of the `db.$transaction` call, before `tx.resolution.create`, add:

```typescript
async function resolveMarket(
  marketId: string,
  winningSide: Side,
  actualValue: number,
  actualLabel: string
) {
  // Cancel all open orders and refund reserved balances before paying out positions
  await cancelMarketOrders(marketId);

  await db.$transaction(async (tx) => {
    // ... rest unchanged
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "resolve-markets" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/resolve-markets.ts
git commit -m "feat: cancel open orders before market resolution"
```

---

## Task 6: Update buy API route

**Files:**
- Modify: `src/app/api/markets/[marketId]/buy/route.ts`

- [ ] **Step 1: Replace the entire file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { placeOrder } from "@/lib/matching-engine";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  let body: { side: unknown; orderType: unknown; shares: unknown; price: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { side, orderType = "MARKET", shares, price } = body;

  if (side !== "YES" && side !== "NO") {
    return NextResponse.json({ error: "side must be YES or NO" }, { status: 400 });
  }
  if (orderType !== "MARKET" && orderType !== "LIMIT") {
    return NextResponse.json({ error: "orderType must be MARKET or LIMIT" }, { status: 400 });
  }
  if (!Number.isInteger(shares) || (shares as number) < 1) {
    return NextResponse.json({ error: "shares must be a positive integer" }, { status: 400 });
  }
  if (orderType === "LIMIT") {
    if (!Number.isInteger(price) || (price as number) < 1 || (price as number) > 99) {
      return NextResponse.json({ error: "limit price must be an integer 1–99" }, { status: 400 });
    }
  }

  try {
    const result = await placeOrder({
      userId: session.user.id,
      marketId,
      side: side as "YES" | "NO",
      action: "BUY",
      orderType: orderType as "MARKET" | "LIMIT",
      shares: shares as number,
      price: price as number | undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order failed";
    const status =
      message === "Market not found" ? 404 :
      message === "Insufficient balance" ? 400 :
      message === "No liquidity available — try a limit order" ? 400 :
      message === "Market is not open for trading" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "buy/route" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/markets/[marketId]/buy/route.ts
git commit -m "feat: update buy route to use CLOB matching engine"
```

---

## Task 7: Sell API route

**Files:**
- Create: `src/app/api/markets/[marketId]/sell/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { placeOrder } from "@/lib/matching-engine";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { marketId } = await context.params;

  let body: { side: unknown; orderType: unknown; shares: unknown; price: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { side = "YES", orderType = "MARKET", shares, price } = body;

  if (side !== "YES" && side !== "NO") {
    return NextResponse.json({ error: "side must be YES or NO" }, { status: 400 });
  }
  if (orderType !== "MARKET" && orderType !== "LIMIT") {
    return NextResponse.json({ error: "orderType must be MARKET or LIMIT" }, { status: 400 });
  }
  if (!Number.isInteger(shares) || (shares as number) < 1) {
    return NextResponse.json({ error: "shares must be a positive integer" }, { status: 400 });
  }
  if (orderType === "LIMIT") {
    if (!Number.isInteger(price) || (price as number) < 1 || (price as number) > 99) {
      return NextResponse.json({ error: "limit price must be an integer 1–99" }, { status: 400 });
    }
  }

  try {
    const result = await placeOrder({
      userId: session.user.id,
      marketId,
      side: side as "YES" | "NO",
      action: "SELL",
      orderType: orderType as "MARKET" | "LIMIT",
      shares: shares as number,
      price: price as number | undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Order failed";
    const status =
      message === "Market not found" ? 404 :
      message.startsWith("You have no") ? 400 :
      message === "No liquidity available — try a limit order" ? 400 :
      message === "Market is not open for trading" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "sell/route" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/markets/[marketId]/sell/route.ts
git commit -m "feat: add sell order API route"
```

---

## Task 8: Order book API route

**Files:**
- Create: `src/app/api/markets/[marketId]/orderbook/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { OrderStatus, OrderAction, Side } from "@prisma/client";
import { getBestBid, getBestAsk, getMidPrice } from "@/lib/order-book";
import { PLATFORM_USER_ID } from "@/lib/matching-engine";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string }> }
) {
  const { marketId } = await context.params;

  const market = await db.market.findUnique({
    where: { id: marketId },
    select: { yesPriceLatest: true, noPriceLatest: true },
  });
  if (!market) {
    return NextResponse.json({ error: "Market not found" }, { status: 404 });
  }

  const orders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
    },
    select: { id: true, userId: true, side: true, action: true, price: true, shares: true, filledShares: true },
    orderBy: { price: "asc" },
  });

  // Aggregate bids: Buy YES + Sell NO orders, grouped by YES-equivalent price
  const bidMap = new Map<number, { shares: number; isPlatform: boolean }>();
  for (const o of orders) {
    const isBid =
      (o.action === OrderAction.BUY && o.side === Side.YES) ||
      (o.action === OrderAction.SELL && o.side === Side.NO);
    if (!isBid || o.price === null) continue;
    const yesPrice = o.side === Side.YES ? o.price : 100 - o.price;
    const avail = o.shares - o.filledShares;
    if (avail <= 0) continue;
    const existing = bidMap.get(yesPrice) ?? { shares: 0, isPlatform: false };
    bidMap.set(yesPrice, {
      shares: existing.shares + avail,
      isPlatform: existing.isPlatform || o.userId === PLATFORM_USER_ID,
    });
  }

  // Aggregate asks: Sell YES + Buy NO orders, grouped by YES-equivalent price
  const askMap = new Map<number, { shares: number; isPlatform: boolean }>();
  for (const o of orders) {
    const isAsk =
      (o.action === OrderAction.SELL && o.side === Side.YES) ||
      (o.action === OrderAction.BUY && o.side === Side.NO);
    if (!isAsk || o.price === null) continue;
    const yesPrice = o.side === Side.YES ? o.price : 100 - o.price;
    const avail = o.shares - o.filledShares;
    if (avail <= 0) continue;
    const existing = askMap.get(yesPrice) ?? { shares: 0, isPlatform: false };
    askMap.set(yesPrice, {
      shares: existing.shares + avail,
      isPlatform: existing.isPlatform || o.userId === PLATFORM_USER_ID,
    });
  }

  const bids = Array.from(bidMap.entries())
    .map(([price, { shares, isPlatform }]) => ({ price, shares, isPlatform }))
    .sort((a, b) => b.price - a.price); // descending

  const asks = Array.from(askMap.entries())
    .map(([price, { shares, isPlatform }]) => ({ price, shares, isPlatform }))
    .sort((a, b) => a.price - b.price); // ascending

  const bestBid = bids[0]?.price ?? null;
  const bestAsk = asks[0]?.price ?? null;
  const midPrice = getMidPrice(bestBid, bestAsk, market.yesPriceLatest);

  return NextResponse.json({
    bids,
    asks,
    midPrice,
    lastTradePrice: market.yesPriceLatest,
    noPrice: market.noPriceLatest,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "orderbook/route" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/markets/[marketId]/orderbook/route.ts
git commit -m "feat: add order book API route"
```

---

## Task 9: Cancel order API route

**Files:**
- Create: `src/app/api/markets/[marketId]/orders/[orderId]/route.ts`

- [ ] **Step 1: Create the file**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrderAction, OrderStatus } from "@prisma/client";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ marketId: string; orderId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { orderId } = await context.params;

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { userId: true, status: true, action: true, price: true, shares: true, filledShares: true },
  });

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
  if (order.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (order.status !== OrderStatus.OPEN && order.status !== OrderStatus.PARTIALLY_FILLED) {
    return NextResponse.json({ error: "Order cannot be cancelled" }, { status: 400 });
  }

  const unfilledShares = order.shares - order.filledShares;
  const refund =
    order.action === OrderAction.BUY && order.price !== null
      ? order.price * unfilledShares
      : 0;

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CANCELLED },
    });
    if (refund > 0) {
      await tx.user.update({
        where: { id: session.user.id },
        data: { cashBalanceCents: { increment: BigInt(refund) } },
      });
    }
  });

  return NextResponse.json({ cancelled: true, refundCents: refund });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "orders/\[orderId\]" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/markets/[marketId]/orders/[orderId]/route.ts
git commit -m "feat: add cancel order API route"
```

---

## Task 10: OrderBook component

**Files:**
- Create: `src/components/markets/OrderBook.tsx`

- [ ] **Step 1: Create `src/components/markets/OrderBook.tsx`**

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";

interface BookLevel {
  price: number;
  shares: number;
  isPlatform: boolean;
}

interface OrderBookData {
  bids: BookLevel[];
  asks: BookLevel[];
  midPrice: number;
  lastTradePrice: number;
  noPrice: number;
}

interface OrderBookProps {
  marketId: string;
}

export function OrderBook({ marketId }: OrderBookProps) {
  const [book, setBook] = useState<OrderBookData | null>(null);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/orderbook`);
      if (res.ok) setBook(await res.json());
    } catch {}
  }, [marketId]);

  useEffect(() => {
    fetchBook();
    const id = setInterval(fetchBook, 5000);
    return () => clearInterval(id);
  }, [fetchBook]);

  if (!book) {
    return (
      <div
        className="rounded-xl border p-4 animate-pulse"
        style={{ borderColor: "rgba(255,255,255,0.08)", height: 180 }}
      />
    );
  }

  const rowStyle = (isPlatform: boolean) => ({
    color: isPlatform ? "rgba(255,255,255,0.25)" : undefined,
  });

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <p className="text-xs font-medium mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        Order Book
      </p>

      {/* Asks — reverse so lowest ask is closest to mid */}
      <div className="space-y-0.5 mb-1">
        {book.asks
          .slice(0, 5)
          .reverse()
          .map((a) => (
            <div
              key={a.price}
              className="flex justify-between text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: "rgba(248,113,113,0.06)", ...rowStyle(a.isPlatform) }}
            >
              <span style={{ color: a.isPlatform ? undefined : "#f87171" }}>{a.price}¢</span>
              <span style={{ color: "rgba(255,255,255,0.4)" }}>{a.shares.toLocaleString()}</span>
            </div>
          ))}
      </div>

      {/* Mid price */}
      <div
        className="flex justify-between items-center px-2 py-1.5 my-1 rounded"
        style={{ backgroundColor: "rgba(167,139,250,0.08)" }}
      >
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
          Mid
        </span>
        <span className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
          {book.midPrice}¢ YES · {book.noPrice}¢ NO
        </span>
      </div>

      {/* Bids */}
      <div className="space-y-0.5 mt-1">
        {book.bids.slice(0, 5).map((b) => (
          <div
            key={b.price}
            className="flex justify-between text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(74,222,128,0.06)", ...rowStyle(b.isPlatform) }}
          >
            <span style={{ color: a.isPlatform ? undefined : "#4ade80" }}>{b.price}¢</span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{b.shares.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Wait — there's a typo above in the bid row: `a.isPlatform` should be `b.isPlatform`. Use this corrected version:

```tsx
"use client";

import { useEffect, useState, useCallback } from "react";

interface BookLevel {
  price: number;
  shares: number;
  isPlatform: boolean;
}

interface OrderBookData {
  bids: BookLevel[];
  asks: BookLevel[];
  midPrice: number;
  lastTradePrice: number;
  noPrice: number;
}

interface OrderBookProps {
  marketId: string;
}

export function OrderBook({ marketId }: OrderBookProps) {
  const [book, setBook] = useState<OrderBookData | null>(null);

  const fetchBook = useCallback(async () => {
    try {
      const res = await fetch(`/api/markets/${marketId}/orderbook`);
      if (res.ok) setBook(await res.json());
    } catch {}
  }, [marketId]);

  useEffect(() => {
    fetchBook();
    const id = setInterval(fetchBook, 5000);
    return () => clearInterval(id);
  }, [fetchBook]);

  if (!book) {
    return (
      <div
        className="rounded-xl border p-4 animate-pulse"
        style={{ borderColor: "rgba(255,255,255,0.08)", height: 180 }}
      />
    );
  }

  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <p className="text-xs font-medium mb-3" style={{ color: "rgba(255,255,255,0.3)" }}>
        Order Book
      </p>

      {/* Asks reversed so lowest ask is closest to mid */}
      <div className="space-y-0.5 mb-1">
        {[...book.asks.slice(0, 5)].reverse().map((a) => (
          <div
            key={a.price}
            className="flex justify-between text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(248,113,113,0.06)" }}
          >
            <span style={{ color: a.isPlatform ? "rgba(248,113,113,0.4)" : "#f87171" }}>
              {a.price}¢
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{a.shares.toLocaleString()}</span>
          </div>
        ))}
      </div>

      {/* Mid price */}
      <div
        className="flex justify-between items-center px-2 py-1.5 my-1 rounded"
        style={{ backgroundColor: "rgba(167,139,250,0.08)" }}
      >
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>Mid</span>
        <span className="text-sm font-semibold" style={{ color: "#a78bfa" }}>
          {book.midPrice}¢ YES · {book.noPrice}¢ NO
        </span>
      </div>

      {/* Bids */}
      <div className="space-y-0.5 mt-1">
        {book.bids.slice(0, 5).map((b) => (
          <div
            key={b.price}
            className="flex justify-between text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: "rgba(74,222,128,0.06)" }}
          >
            <span style={{ color: b.isPlatform ? "rgba(74,222,128,0.4)" : "#4ade80" }}>
              {b.price}¢
            </span>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>{b.shares.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "OrderBook" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/markets/OrderBook.tsx
git commit -m "feat: add OrderBook component with 5s polling"
```

---

## Task 11: TradePanel component (replaces BuyPanel)

**Files:**
- Create: `src/components/markets/TradePanel.tsx`

- [ ] **Step 1: Create `src/components/markets/TradePanel.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/format";

type Tab = "BUY_YES" | "SELL_YES" | "BUY_NO";
type OrderType = "MARKET" | "LIMIT";

interface TradePanelProps {
  marketId: string;
  isOpen: boolean;
  bestAsk: number;  // current best ask (cost estimate for market buy)
  bestBid: number;  // current best bid (proceeds estimate for market sell)
}

export function TradePanel({ marketId, isOpen, bestAsk, bestBid }: TradePanelProps) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("BUY_YES");
  const [orderType, setOrderType] = useState<OrderType>("MARKET");
  const [shares, setShares] = useState(100);
  const [limitPrice, setLimitPrice] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const isBuy = tab === "BUY_YES" || tab === "BUY_NO";
  const side: "YES" | "NO" = tab === "BUY_NO" ? "NO" : "YES";
  const action: "BUY" | "SELL" = tab === "SELL_YES" ? "SELL" : "BUY";

  const estimatedPrice = orderType === "LIMIT" ? limitPrice : (isBuy ? bestAsk : bestBid);
  const estimatedTotal = estimatedPrice * shares;

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    const endpoint = action === "BUY"
      ? `/api/markets/${marketId}/buy`
      : `/api/markets/${marketId}/sell`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          side,
          action,
          orderType,
          shares,
          ...(orderType === "LIMIT" ? { price: limitPrice } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Order failed");
        return;
      }

      const verb = action === "BUY" ? "Bought" : "Sold";
      if (data.filledShares > 0) {
        setSuccessMsg(
          `${verb} ${data.filledShares} ${side} @ avg ${data.avgFillPrice}¢. ` +
          `New price: ${data.newYesPrice}¢ YES`
        );
      } else {
        setSuccessMsg(`Limit order placed at ${limitPrice}¢ — waiting for a match.`);
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const tabConfig: { key: Tab; label: string; color: string; bg: string }[] = [
    { key: "BUY_YES", label: "Buy YES", color: "var(--color-yes)", bg: "rgba(0,194,168,0.15)" },
    { key: "SELL_YES", label: "Sell YES", color: "var(--color-no)", bg: "rgba(245,166,35,0.15)" },
    { key: "BUY_NO", label: "Buy NO", color: "var(--color-no)", bg: "rgba(245,166,35,0.15)" },
  ];

  const activeTab = tabConfig.find((t) => t.key === tab)!;

  return (
    <div
      className="rounded-xl border p-6"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <p className="text-xs uppercase tracking-wider mb-4" style={{ color: "rgba(255,255,255,0.3)" }}>
        Trade
      </p>

      {/* Tab selector */}
      <div className="flex rounded-lg p-1 mb-4 gap-1" style={{ backgroundColor: "rgba(255,255,255,0.05)" }}>
        {tabConfig.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setError(null); setSuccessMsg(null); }}
            className="flex-1 py-2 rounded-md text-xs font-medium transition-all"
            style={
              tab === t.key
                ? { backgroundColor: t.bg, color: t.color }
                : { color: "rgba(255,255,255,0.4)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Market / Limit toggle */}
      <div className="flex gap-2 mb-4">
        {(["MARKET", "LIMIT"] as const).map((ot) => (
          <button
            key={ot}
            type="button"
            onClick={() => setOrderType(ot)}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={
              orderType === ot
                ? { backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }
                : { backgroundColor: "transparent", color: "rgba(255,255,255,0.3)", border: "1px solid rgba(255,255,255,0.08)" }
            }
          >
            {ot}
          </button>
        ))}
      </div>

      {/* Shares */}
      <div className="mb-4">
        <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
          Shares
        </label>
        <input
          type="number"
          min={1}
          value={shares}
          onChange={(e) => setShares(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
          style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        />
      </div>

      {/* Limit price (only shown for limit orders) */}
      {orderType === "LIMIT" && (
        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: "rgba(255,255,255,0.4)" }}>
            Limit Price (¢)
          </label>
          <input
            type="number"
            min={1}
            max={99}
            value={limitPrice}
            onChange={(e) => setLimitPrice(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
            className="w-full rounded-lg px-3 py-2 text-sm text-white outline-none"
            style={{ backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
        </div>
      )}

      {/* Estimate */}
      <div className="rounded-lg p-3 mb-4 space-y-1.5" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
        <div className="flex justify-between text-xs">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>
            {isBuy ? "Est. cost" : "Est. proceeds"}
          </span>
          <span className="text-white tabular">{formatCents(estimatedTotal)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: "rgba(255,255,255,0.4)" }}>Payout if correct</span>
          <span className="text-white tabular">{formatCents(shares * 100)}</span>
        </div>
        {orderType === "MARKET" && (
          <div className="flex justify-between text-xs">
            <span style={{ color: "rgba(255,255,255,0.4)" }}>Fills at</span>
            <span style={{ color: "rgba(255,255,255,0.5)" }}>
              {isBuy ? `best ask (${bestAsk}¢)` : `best bid (${bestBid}¢)`}
            </span>
          </div>
        )}
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!isOpen || loading}
        className="w-full py-3 rounded-lg text-sm font-medium transition-opacity disabled:opacity-40"
        style={{ backgroundColor: activeTab.bg, color: activeTab.color, border: `1px solid ${activeTab.color}33` }}
      >
        {loading
          ? "Placing order…"
          : !isOpen
          ? "Market closed"
          : orderType === "MARKET"
          ? `${activeTab.label} — ${shares} shares`
          : `Place limit ${action} at ${limitPrice}¢`}
      </button>

      {error && <p className="text-xs mt-3" style={{ color: "var(--color-no)" }}>{error}</p>}
      {successMsg && <p className="text-xs mt-3" style={{ color: "var(--color-yes)" }}>{successMsg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "TradePanel" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/markets/TradePanel.tsx
git commit -m "feat: add TradePanel component with buy/sell/limit/market support"
```

---

## Task 12: Update market detail page

**Files:**
- Modify: `src/app/markets/[marketId]/page.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TradePanel } from "@/components/markets/TradePanel";
import { OrderBook } from "@/components/markets/OrderBook";
import { MarketWatchlistButton } from "@/components/markets/MarketWatchlistButton";
import { formatDate, formatVolume } from "@/lib/format";
import { metricLabel } from "@/lib/metricLabel";
import { getBestBid, getBestAsk } from "@/lib/order-book";
import { OrderStatus, OrderAction, Side } from "@prisma/client";

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
    include: { company: true },
  });

  if (!market) notFound();

  const isOpen = market.status === "OPEN";

  // Fetch open orders to compute best bid/ask for the trade panel
  const openOrders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
    },
    select: { userId: true, side: true, action: true, price: true, shares: true, filledShares: true, id: true },
  });

  // Compute bids and asks for best price display
  const bids = openOrders
    .filter(
      (o) =>
        (o.action === OrderAction.BUY && o.side === Side.YES) ||
        (o.action === OrderAction.SELL && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: o.side === Side.YES ? o.price! : 100 - o.price!,
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);

  const asks = openOrders
    .filter(
      (o) =>
        (o.action === OrderAction.SELL && o.side === Side.YES) ||
        (o.action === OrderAction.BUY && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: o.side === Side.YES ? o.price! : 100 - o.price!,
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);

  const bestBid = getBestBid(bids) ?? market.yesPriceLatest;
  const bestAsk = getBestAsk(asks) ?? market.yesPriceLatest;

  const bookmarked = session?.user?.id
    ? !!(await db.watchlist.findUnique({
        where: { userId_marketId: { userId: session.user.id, marketId: market.id } },
      }))
    : false;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Breadcrumb + watchlist button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {market.company.ticker} · {metricLabel(market.metricType)}
          {market.betDate ? ` · ${formatDate(market.betDate)}` : ""}
        </p>
        {session && (
          <MarketWatchlistButton marketId={market.id} initialBookmarked={bookmarked} />
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
          <p className="text-2xl font-semibold tabular" style={{ color: "var(--color-yes)" }}>
            {market.yesPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>YES</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular" style={{ color: "var(--color-no)" }}>
            {market.noPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>NO</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-medium text-white/60 tabular">
            {formatVolume(market.totalVolume)}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Total volume</p>
        </div>
      </div>

      {/* Order book + trade panel side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <OrderBook marketId={market.id} />
        {session ? (
          <TradePanel
            marketId={market.id}
            isOpen={isOpen}
            bestAsk={bestAsk}
            bestBid={bestBid}
          />
        ) : (
          <div
            className="rounded-xl border p-6 text-center flex items-center justify-center"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              <a href="/auth/signin" className="underline hover:text-white transition-colors">
                Sign in
              </a>{" "}
              to trade.
            </p>
          </div>
        )}
      </div>

      {/* Resolution criteria */}
      {market.resolutionCriteria && (
        <div className="mt-4">
          <div className="h-px w-full mb-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
          <h2
            className="text-xs font-medium mb-2 uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Resolution Criteria
          </h2>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              {market.resolutionCriteria}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "markets/\[marketId\]/page" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/markets/[marketId]/page.tsx
git commit -m "feat: update market detail page with OrderBook and TradePanel"
```

---

## Task 13: Portfolio — Open Orders section

**Files:**
- Modify: `src/lib/queries/portfolio.ts`
- Modify: `src/app/portfolio/page.tsx`

- [ ] **Step 1: Add `getOpenOrders` to `src/lib/queries/portfolio.ts`**

Open `src/lib/queries/portfolio.ts`. Add after the last export:

```typescript
export type OpenOrder = Awaited<ReturnType<typeof getOpenOrders>>[number];

export async function getOpenOrders(userId: string) {
  return db.order.findMany({
    where: {
      userId,
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    },
    include: {
      market: {
        select: {
          id: true,
          question: true,
          inviteSlug: true,
          company: { select: { ticker: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
```

Note: `Market` does not have `inviteSlug`. Remove that field — use `market.id` instead:

```typescript
export async function getOpenOrders(userId: string) {
  return db.order.findMany({
    where: {
      userId,
      status: { in: ["OPEN", "PARTIALLY_FILLED"] },
    },
    include: {
      market: {
        select: {
          id: true,
          question: true,
          company: { select: { ticker: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Step 2: Add Open Orders section to portfolio page**

Open `src/app/portfolio/page.tsx`. Read the current file to understand its structure, then:

1. Import `getOpenOrders` and `OpenOrder`
2. Fetch open orders alongside other queries
3. Add an "Open Orders" section that lists each order with: ticker, question snippet, side, action, price, shares remaining, and a cancel button

Find the import line at the top of portfolio/page.tsx and add:
```typescript
import { getOpenOrders } from "@/lib/queries/portfolio";
```

Find where other queries are fetched (likely in a `Promise.all` or sequential awaits) and add `getOpenOrders(session.user.id)`.

Then, before the closing `</div>` of the page, add:

```tsx
{openOrders.length > 0 && (
  <div className="mt-8">
    <h2 className="text-sm font-medium mb-4 uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.3)" }}>
      Open Orders
    </h2>
    <div className="space-y-2">
      {openOrders.map((order) => (
        <OpenOrderRow key={order.id} order={order} />
      ))}
    </div>
  </div>
)}
```

And create `src/components/portfolio/OpenOrderRow.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { OpenOrder } from "@/lib/queries/portfolio";

export function OpenOrderRow({ order }: { order: OpenOrder }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const remaining = order.shares - order.filledShares;

  async function handleCancel() {
    setLoading(true);
    try {
      await fetch(`/api/markets/${order.marketId}/orders/${order.id}`, {
        method: "DELETE",
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
      style={{ borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white truncate">{order.market.company.ticker}</p>
        <p className="text-xs mt-0.5 truncate" style={{ color: "rgba(255,255,255,0.4)" }}>
          {order.action} {order.side} · {order.price}¢ limit · {remaining} shares remaining
        </p>
      </div>
      <button
        type="button"
        onClick={handleCancel}
        disabled={loading}
        className="shrink-0 text-xs px-3 py-1.5 rounded-lg disabled:opacity-40"
        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)", border: "1px solid rgba(255,255,255,0.1)" }}
      >
        {loading ? "…" : "Cancel"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep -E "portfolio|OpenOrder" | head -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/queries/portfolio.ts src/app/portfolio/page.tsx src/components/portfolio/OpenOrderRow.tsx
git commit -m "feat: add open orders section to portfolio page"
```

---

## Task 14: Delete AMM files

**Files:**
- Delete: `src/lib/amm.ts`
- Delete: `src/lib/__tests__/amm.test.ts`

- [ ] **Step 1: Remove the files**

```bash
rm /Users/jacobomenasche/Desktop/stockbets/src/lib/amm.ts
rm /Users/jacobomenasche/Desktop/stockbets/src/lib/__tests__/amm.test.ts
```

- [ ] **Step 2: Check nothing imports amm.ts**

```bash
grep -r "from.*amm\|require.*amm" /Users/jacobomenasche/Desktop/stockbets/src --include="*.ts" --include="*.tsx"
```

Expected: no output. If any file still imports from `@/lib/amm`, fix those imports (the old `BuyPanel` import was the main consumer; it's been replaced by `TradePanel`).

- [ ] **Step 3: Run all tests**

```bash
cd /Users/jacobomenasche/Desktop/stockbets
npm test
```

Expected: order-book tests (18) + challenges tests (17) = 35 tests passing. No failures.

- [ ] **Step 4: Final TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -30
```

Expected: only pre-existing errors unrelated to CLOB work (e.g., in scripts/ or admin pages).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: remove AMM — fully replaced by CLOB order book"
```

---

## Self-Review

**Spec coverage:**
- ✅ Single YES order book — `extractBids`/`extractAsks` normalize all orders to YES-equivalent
- ✅ `OrderType` / `OrderAction` enums added to schema — Task 1
- ✅ `Order.price` nullable — Task 1
- ✅ Platform seed user upserted in `seedMarket` — Task 3
- ✅ Seed orders: 45¢ bid, 55¢ ask, 500 shares each — Task 3
- ✅ `placeOrder` handles MARKET and LIMIT, BUY and SELL — Task 3
- ✅ Partial fills supported — `matchMarketBuy`/`matchMarketSell` return remainingShares — Task 2
- ✅ "No liquidity" error for market orders with empty book — Task 3
- ✅ Limit order immediate cross → fills at counterparty price — Task 3
- ✅ Resting limit BUY reserves balance upfront — Task 3
- ✅ `cancelMarketOrders` refunds reserved balance — Task 3
- ✅ Called at resolution before payouts — Task 5
- ✅ `seedMarket` called for all 3 market types — Task 4
- ✅ Buy route updated — Task 6
- ✅ Sell route added — Task 7
- ✅ Order book route (GET) — Task 8
- ✅ Cancel order route (DELETE) — Task 9
- ✅ `OrderBook` component, 5s polling — Task 10
- ✅ `TradePanel`: Buy YES/Sell YES/Buy NO tabs, Market/Limit toggle — Task 11
- ✅ Market detail page: OrderBook + TradePanel side by side — Task 12
- ✅ Portfolio: Open Orders section with cancel — Task 13
- ✅ `amm.ts` deleted — Task 14
- ✅ `BuyPanel` replaced — TradePanel imported in market page (Task 12), BuyPanel not imported anywhere after Task 14

**Placeholder scan:** No TBDs. All steps have complete code.

**Type consistency:**
- `BookEntry` defined in `order-book.ts`, used in `matching-engine.ts` via import ✅
- `Fill` type used consistently across tasks 2–3 ✅
- `PlaceOrderResult` includes `newYesPrice`/`newNoPrice` returned by buy/sell routes ✅
- `OpenOrder` type exported from `portfolio.ts`, used in `OpenOrderRow` ✅
