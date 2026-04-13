# CLOB Trading System — Design Spec
**Date:** 2026-04-11
**Status:** Approved

---

## Overview

Replace the linear AMM pricing model with a Central Limit Order Book (CLOB). Price is discovered by users posting limit orders; market orders fill instantly against the best available price. The platform seeds each new market with capped limit orders to guarantee initial liquidity.

---

## 1. Data Model

### Changes to existing models

```prisma
enum OrderType { LIMIT MARKET }

model Order {
  // existing fields unchanged, add:
  orderType OrderType @default(LIMIT)
}
```

`Market.yesPriceLatest` and `Market.noPriceLatest` change meaning: no longer AMM-calculated, now set to the last trade price on each fill. `noPriceLatest` is always `100 - yesPriceLatest`.

### New: Platform system user

A special `User` row with `id = "platform"` is created via seed script. All platform seed orders are posted under this user. This user has no password, cannot log in, and has an effectively unlimited virtual balance.

### Removed

`src/lib/amm.ts` is deleted. `SENSITIVITY` constant is removed.

---

## 2. Core Logic

### `src/lib/order-book.ts` — pure functions (no DB)

```typescript
type Fill = { orderId: string; shares: number; price: number; userId: string };

// Highest YES bid price in the book
function getBestBid(orders: Order[]): number | null

// Lowest YES ask price in the book
function getBestAsk(orders: Order[]): number | null

// Mid price for display: (bid + ask) / 2, rounded to nearest integer
// Falls back to last trade price if one side is empty
function getMidPrice(bid: number | null, ask: number | null, lastPrice: number): number

// Match a market order against available orders in the book.
// Returns fills (which orders to fill and at what price/shares)
// and remainingShares (unfilled portion).
// For BUY YES: sweeps lowest asks first (price ascending).
// For SELL YES / BUY NO: sweeps highest bids first (price descending).
function matchMarketOrder(
  side: "YES" | "NO",
  action: "BUY" | "SELL",
  shares: number,
  book: Order[]
): { fills: Fill[]; remainingShares: number }

// Check if a limit order crosses immediately (can fill on arrival).
// Buy limit at price P crosses if best ask <= P.
// Sell limit at price P crosses if best bid >= P.
function limitCrossesImmediately(
  action: "BUY" | "SELL",
  price: number,
  bestBid: number | null,
  bestAsk: number | null
): boolean
```

### `src/lib/matching-engine.ts` — DB operations

```typescript
// Place a limit or market order.
// - Validates balance (buy) or position size (sell).
// - For market orders: calls matchMarketOrder, executes fills in a transaction.
// - For limit orders: checks for immediate cross, fills what it can, rests remainder in book.
// - On each fill: creates Trade, updates Position, debits buyer, credits seller,
//   updates Market.yesPriceLatest to fill price.
// - Returns { filledShares, avgFillPrice, orderStatus }.
export async function placeOrder(params: {
  userId: string;
  marketId: string;
  side: "YES" | "NO";
  action: "BUY" | "SELL";
  orderType: "LIMIT" | "MARKET";
  shares: number;
  price?: number; // required for LIMIT orders
}): Promise<{ filledShares: number; avgFillPrice: number; status: OrderStatus }>

// Post platform seed orders for a newly created market.
// Posts: buy YES at 45¢ (500 shares) and sell YES at 55¢ (500 shares).
// Both orders belong to the platform user.
// Called from createDailyMarkets() after each market is created.
export async function seedMarket(marketId: string): Promise<void>

// Cancel all OPEN orders for a market and refund reserved balances.
// Called from resolveAllOpenMarketsForToday() before payouts.
export async function cancelMarketOrders(marketId: string): Promise<void>
```

---

## 3. Order Book Mechanics

### Single YES book

One order book per market. NO is not a separate instrument — buying NO at price P is equivalent to selling YES at price `100 - P`. All orders are stored as YES-side with a `side` field on `Order` indicating whether the user holds YES or NO.

**YES + NO = 100¢ invariant** is maintained: whenever `yesPriceLatest` is updated, `noPriceLatest = 100 - yesPriceLatest` is updated in the same transaction.

### Matching rules

| Action | Matches against |
|--------|----------------|
| Market buy YES | Lowest YES asks (price ascending) |
| Market sell YES | Highest YES bids (price descending) |
| Market buy NO | Highest YES bids (= cheapest NO) |
| Limit buy YES at P | Any ask ≤ P, then rests |
| Limit sell YES at P | Any bid ≥ P, then rests |

### Partial fills

Market orders fill as much as available. Remaining unfilled shares are cancelled (not queued). Limit orders fill what they can and queue the rest.

### Limit order immediate cross

A limit buy at 60¢ when the best ask is 55¢ fills at 55¢ (buyer gets a better price than requested). A limit sell at 45¢ when the best bid is 52¢ fills at 52¢.

---

## 4. Platform Seeding

When a market is created, `seedMarket()` posts:
- **Buy YES at 45¢** — 500 shares (platform bids for YES)
- **Sell YES at 55¢** — 500 shares (platform offers YES)

These orders are capped at 500 shares. Once consumed, they are gone — no automatic replenishment. The platform seed orders are not cancelled at market close (4pm ET); they expire naturally when the market resolves.

The seed orders give all markets a guaranteed 10¢ spread and 50¢ midpoint as a starting point. As real users post limit orders at tighter prices, the effective spread narrows and the platform orders become the fallback backstop.

---

## 5. API Routes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/markets/[marketId]/buy` | Updated — accepts `orderType`, `price` (limit only), `side`. Calls `placeOrder`. |
| POST | `/api/markets/[marketId]/sell` | **New** — sell YES shares. Accepts `orderType`, `price` (limit only), `shares`. |
| GET | `/api/markets/[marketId]/orderbook` | **New** — returns aggregated bids/asks by price level and current mid price. |
| DELETE | `/api/markets/[marketId]/orders/[orderId]` | **New** — cancel an open limit order (own orders only). Refunds reserved balance. |

### POST /buy and POST /sell request body

```typescript
{
  side: "YES" | "NO";        // buy only
  action: "BUY" | "SELL";   // sell only (always YES)
  orderType: "MARKET" | "LIMIT";
  shares: number;            // minimum 1
  price?: number;            // required for LIMIT, integer 1–99
}
```

### GET /orderbook response

```typescript
{
  bids: { price: number; shares: number; isPlatform: boolean }[];  // sorted desc
  asks: { price: number; shares: number; isPlatform: boolean }[];  // sorted asc
  midPrice: number;
  lastTradePrice: number;
}
```

---

## 6. UI Changes

### Market detail page

Replace the current AMM buy widget with:
- **Order book panel** — live bids (green) and asks (red) sorted by price, platform orders visually de-emphasised
- **Trade widget** — Buy YES / Sell YES / Buy NO tabs, Market / Limit toggle, shares input, estimated cost, confirm button
- Limit order tab shows price input and an "Add to book" label
- After a market order fills: show fill summary (shares filled, avg price, cost)
- User's own open limit orders shown below the book with a cancel button

### TopNav / Portfolio

Portfolio page gains an "Open Orders" section showing the user's pending limit orders across all markets.

---

## 7. Resolution Changes

`resolveAllOpenMarketsForToday()` gains one step at the start of each market's resolution:

1. Call `cancelMarketOrders(marketId)` — cancels all open limit orders, refunds reserved balances
2. Pay out positions as before (unchanged)

---

## 8. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Market order, no liquidity | Rejected: "No sellers available — try a limit order" |
| Partial fill on market order | Filled portion executes; remaining shares cancelled |
| Limit order crosses immediately | Fills at the better (counterparty's) price |
| Sell with no position | Rejected: "You have no YES shares to sell" |
| Cancel someone else's order | 403 Forbidden |
| Order placed on closed/resolved market | 400: "Market is not open for trading" |
| Platform seed orders at resolution | Cancelled along with all other open orders |

---

## 9. Out of Scope

- Real-time order book via WebSockets (polling on page focus is sufficient at MVP)
- Order book depth chart / price history chart
- Stop-loss or conditional orders
- Professional market maker API / incentive program
- Fee structure (all trades free at MVP)
