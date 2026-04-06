# Resolution Payouts Design

**Date:** 2026-04-05

## Goal

Complete the core trading loop by adding payout logic to the market resolution script. When a market resolves, winners are credited automatically and all positions record their realized P&L. No sell-before-resolution mechanic — users hold until resolution.

---

## Trading Loop

1. **Buy** — user purchases YES/NO shares via AMM; cash debited immediately
2. **Hold** — position stays open until earnings report
3. **Resolution** — `resolve.ts` determines winning side from actual financial data
4. **Payout** — winners receive `shares * 100` cents; all positions stamped with `realizedPL`

Steps 3 and 4 happen atomically in the same Prisma transaction per market.

---

## What Changes

### Modified
- `prisma/schema.prisma` — add `realizedPL Int?` to `Position` model
- `scripts/resolve.ts` — add payout logic inside market resolution transaction
- `src/components/portfolio/HistoryTable.tsx` — display stored `realizedPL` as P&L column

### Unchanged
- `src/app/api/markets/[marketId]/buy/route.ts` — buy endpoint unchanged
- `src/lib/amm.ts` — AMM logic unchanged
- `src/lib/queries/portfolio.ts` — `getPositionHistory` already returns all position fields; `realizedPL` comes along automatically

---

## Schema

Add to `Position` model, after `unrealizedPL`:

```prisma
realizedPL Int? // cents; null while market open, set on resolution
```

Nullable: open positions have `null`, resolved positions have the actual P&L value.

---

## Resolve Script Payout Logic

Within `resolveCompany`, after creating the `Resolution` record for a market, in the **same `$transaction`**:

1. Fetch all positions for the market
2. For each position:
   - **Winner** (`position.side === winningSide`):
     - `payout = shares * 100` (each winning share pays $1.00)
     - `realizedPL = payout - (shares * avgCostCents)`
     - Credit `user.cashBalanceCents += payout`
     - Update position: `realizedPL`, `currentPrice = 100`, `unrealizedPL = 0`
   - **Loser** (`position.side !== winningSide`):
     - `realizedPL = -(shares * avgCostCents)`
     - Update position: `realizedPL`, `currentPrice = 0`, `unrealizedPL = 0`
3. Update resolution: `payoutsIssuedAt = new Date()`

### Key invariant

Each market's full resolution — status change, resolution record, all position updates, all balance credits, payoutsIssuedAt stamp — happens in one Prisma `$transaction`. If anything fails, everything rolls back.

### Idempotency

The script only processes markets with status `CLOSED` (set earlier in the function). Already-resolved markets are skipped. Re-running the script is safe.

---

## HistoryTable Update

Current behavior: computes `won` and `payout` client-side from `resolution.winningSide`.

New behavior:
- Add "P&L" column showing `realizedPL` from the position directly
- Format as green "+$X.XX" for positive, red "-$X.XX" for negative
- Keep existing "Payout" column (`won ? shares * 100 : 0`) and "Result" WIN/LOSS badge

No query changes needed — `getPositionHistory` already returns all position fields.

---

## Money Flow Summary

| Event | Balance effect |
|---|---|
| User buys 100 shares at 60c | -$60.00 (debited on buy) |
| Market resolves, user wins | +$100.00 (shares * $1.00) |
| Market resolves, user loses | No change (already paid on buy) |

**Net P&L for winner:** +$100.00 - $60.00 = +$40.00 (`realizedPL = 4000` cents)
**Net P&L for loser:** -$60.00 (`realizedPL = -6000` cents)
