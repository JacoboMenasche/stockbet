# Betting Engine Design

## Goal

Allow signed-in users to buy YES or NO shares on open markets using their play-money balance, with an AMM pricing model that updates the displayed probability on each trade.

## Tech Stack

- Prisma/PostgreSQL — Order, Trade, Position, Market models (already in schema)
- Next.js 15 API route — `POST /api/markets/[marketId]/buy`
- NextAuth session — authenticate requests, refresh balance after trade
- React client component — BuyPanel on market detail page

---

## Pricing Model

**Linear AMM** with `SENSITIVITY = 40` (medium reactivity — $100 moves price ~5 cents).

```
SENSITIVITY = 40  // shares per 1 cent of price movement

cost(shares, currentPrice) = shares * currentPrice + shares² / (2 * SENSITIVITY)
// Integral of price curve: P + x/SENSITIVITY from 0 to shares
// All values in integer cents

newPrice = clamp(currentPrice + floor(shares / SENSITIVITY), 1, 99)
```

Example: YES at 50¢, buy 200 shares → cost = 200×50 + 200²/80 = 10,000 + 500 = 10,500 cents ($105), new YES price = 55¢.

NO price always equals `100 - yesPriceLatest`.

---

## Schema Change

`Trade.sellOrderId` must be made nullable — AMM trades have no counterparty order:

```prisma
sellOrderId String?
sellOrder   Order?   @relation("SellOrder", fields: [sellOrderId], references: [id])
```

---

## Buy API

**Route:** `POST /api/markets/[marketId]/buy`

**Auth:** Requires valid session (401 if not signed in).

**Request body:** `{ side: "YES" | "NO", shares: number }`

**Validation:**
- `shares` must be an integer ≥ 10
- Market must exist and have status `OPEN` (404 / 400 respectively)

**Logic:**
1. Load market (`yesPriceLatest`, `noPriceLatest`, `status`, `totalVolume`, `volume24h`)
2. Determine `currentPrice` = `yesPriceLatest` if side=YES, else `noPriceLatest`
3. Calculate `cost` using AMM formula
4. Load user `cashBalanceCents` — return 400 if `cost > cashBalanceCents`
5. In a single `$transaction`:
   - Decrement `user.cashBalanceCents` by `cost`
   - Create `Order` (side, price=currentPrice, shares, filledShares=shares, status=FILLED)
   - Create `Trade` (buyOrderId=order.id, sellOrderId=null, side, price=currentPrice, shares)
   - Upsert `Position`: if exists → increment shares, recalculate `avgCostCents` as weighted average, update `currentPrice` and `unrealizedPL`; if not → create with shares, avgCostCents=currentPrice, currentPrice, unrealizedPL=0
   - Update `Market`: set `yesPriceLatest`/`noPriceLatest` to new prices, increment `totalVolume` and `volume24h` by cost
6. Return: `{ cashBalanceCents: number, yesPriceLatest: number, noPriceLatest: number, position: { shares, avgCostCents, currentPrice, unrealizedPL } }`

**unrealizedPL formula:** `shares * (currentPrice - avgCostCents)` cents

---

## BuyPanel Component

**File:** `src/components/markets/BuyPanel.tsx` (client component)

**Props:** `{ marketId: string, initialYesPrice: number, initialNoPrice: number }`

**State:**
- `side`: "YES" | "NO" (toggle tabs)
- `shares`: number input (min 10, step 10)
- `yesPrice` / `noPrice`: updated optimistically after successful trade
- `loading`: boolean

**Live preview** (computed from current state, no API call):
- "Cost: $51.25"
- "New price: 55¢"
- "Potential payout: $200.00" = `shares × 100` cents formatted

**On submit:**
1. POST to `/api/markets/[marketId]/buy`
2. On success: update local price state, call `useSession().update({ cashBalanceCents: data.cashBalanceCents })` to refresh TopNav
3. On error: show inline error message

**Disabled states:**
- Button disabled while loading
- Button disabled if market is not OPEN (passed as prop)

---

## Market Detail Page

**File:** `src/app/markets/[marketId]/page.tsx` (server component)

Currently a placeholder. Replace with:
1. Fetch market from DB by `marketId` (include company, earningsEvent, positions for current user)
2. Pass `yesPriceLatest`, `noPriceLatest`, `status` to `BuyPanel`
3. Show market question, company info, current prices, and the BuyPanel

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Make `Trade.sellOrderId` nullable |
| `src/app/api/markets/[marketId]/buy/route.ts` | Create | POST buy endpoint |
| `src/components/markets/BuyPanel.tsx` | Create | Buy UI with live cost preview |
| `src/app/markets/[marketId]/page.tsx` | Modify | Market detail page with BuyPanel |

---

## Error Handling

| Scenario | Response |
|---|---|
| Not signed in | 401 Unauthorized |
| Market not found | 404 Not Found |
| Market not OPEN | 400 `{ error: "Market is not open for trading" }` |
| shares < 10 | 400 `{ error: "Minimum 10 shares" }` |
| Insufficient balance | 400 `{ error: "Insufficient balance" }` |
| DB error | 500 generic error |
