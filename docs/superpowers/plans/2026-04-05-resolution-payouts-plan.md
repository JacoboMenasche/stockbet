# Resolution Payouts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the trading loop by paying out winners and recording realized P&L when markets resolve.

**Architecture:** Add a `realizedPL` field to `Position`, then extend the existing `resolve.ts` script to credit winners' balances and stamp all positions with their realized P&L — all within a single Prisma transaction per market. Update the portfolio history table to display the stored P&L.

**Tech Stack:** Prisma 5, TypeScript, Next.js 15 App Router

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `realizedPL Int?` to `Position` model |
| `scripts/resolve.ts` | Modify | Add payout + position settlement logic inside market resolution |
| `src/components/portfolio/HistoryTable.tsx` | Modify | Display stored `realizedPL` as P&L column |

---

### Task 1: Add realizedPL to Position schema

**Files:**
- Modify: `prisma/schema.prisma:219-237`

- [ ] **Step 1: Add `realizedPL` field to `Position` model**

In `prisma/schema.prisma`, in the `Position` model, add after `unrealizedPL`:

```prisma
  realizedPL     Int?             // cents; null while open, set on resolution
```

- [ ] **Step 2: Push schema to DB**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add prisma/schema.prisma && git commit -m "feat: add realizedPL field to Position model"
```

---

### Task 2: Add payout logic to resolve script

**Files:**
- Modify: `scripts/resolve.ts`

- [ ] **Step 1: Wrap market resolution in a transaction with payout logic**

Replace the entire `resolveCompany` function in `scripts/resolve.ts` with:

```typescript
async function resolveCompany(ticker: string, companyId: string, eventId: string) {
  // Close all open markets for this event
  await db.market.updateMany({
    where: { earningsEventId: eventId, status: MarketStatus.OPEN },
    data: { status: MarketStatus.CLOSED },
  });
  console.log(`[resolve] Closed markets for ${ticker}`);

  // Fetch actual results
  const statements = await fetchIncomeStatements(ticker, 1);
  const actual = statements[0];
  if (!actual) {
    console.warn(`[resolve] No income statement available yet for ${ticker} — will retry next run`);
    return;
  }

  // Resolve each market
  const markets = await db.market.findMany({
    where: { earningsEventId: eventId, status: MarketStatus.CLOSED },
  });

  for (const market of markets) {
    let actualValue: number | null = null;
    let actualLabel = "";

    if (market.metricType === MetricType.EPS) {
      actualValue = actual.eps;
      actualLabel = `$${actual.eps.toFixed(2)}`;
    } else if (market.metricType === MetricType.GROSS_MARGIN) {
      actualValue = (actual.grossProfit / actual.revenue) * 100;
      actualLabel = `${actualValue.toFixed(1)}%`;
    } else if (market.metricType === MetricType.OPERATING_MARGIN) {
      actualValue = (actual.operatingIncome / actual.revenue) * 100;
      actualLabel = `${actualValue.toFixed(1)}%`;
    } else if (market.metricType === MetricType.REVENUE_GROWTH) {
      await db.market.update({ where: { id: market.id }, data: { status: "VOIDED" } });
      console.warn(`[resolve] ${ticker} REVENUE_GROWTH market voided — prior year data needed`);
      continue;
    }

    if (actualValue === null) continue;

    const threshold = Number(market.threshold);
    const winningSide = determineWinningSide(actualValue, threshold);

    // Resolve + payout in a single transaction
    await db.$transaction(async (tx) => {
      // Create resolution record
      const resolution = await tx.resolution.create({
        data: {
          marketId: market.id,
          actualValue,
          actualLabel,
          winningSide,
          sourceFiling: `https://financialmodelingprep.com/financial-statements/${ticker}`,
        },
      });

      // Mark market as resolved
      await tx.market.update({
        where: { id: market.id },
        data: { status: MarketStatus.RESOLVED },
      });

      // Fetch all positions for this market
      const positions = await tx.position.findMany({
        where: { marketId: market.id },
      });

      // Settle each position
      for (const position of positions) {
        const won = position.side === winningSide;
        const totalCost = position.shares * position.avgCostCents;

        if (won) {
          const payout = position.shares * 100;
          const realizedPL = payout - totalCost;

          // Credit winner's balance
          await tx.user.update({
            where: { id: position.userId },
            data: { cashBalanceCents: { increment: BigInt(payout) } },
          });

          // Update position
          await tx.position.update({
            where: { id: position.id },
            data: {
              realizedPL,
              currentPrice: 100,
              unrealizedPL: 0,
            },
          });

          console.log(`[resolve] ${ticker} ${market.metricType}: paid user ${position.userId} ${payout}¢ (P&L: ${realizedPL > 0 ? "+" : ""}${realizedPL}¢)`);
        } else {
          const realizedPL = -totalCost;

          // Update position
          await tx.position.update({
            where: { id: position.id },
            data: {
              realizedPL,
              currentPrice: 0,
              unrealizedPL: 0,
            },
          });

          console.log(`[resolve] ${ticker} ${market.metricType}: user ${position.userId} lost ${totalCost}¢`);
        }
      }

      // Stamp payouts issued
      await tx.resolution.update({
        where: { id: resolution.id },
        data: { payoutsIssuedAt: new Date() },
      });
    });

    console.log(`[resolve] ${ticker} ${market.metricType}: actual=${actualLabel}, threshold=${market.thresholdLabel}, winner=${winningSide}`);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit -p scripts/tsconfig.json 2>&1 | grep "resolve" || echo "No errors"
```

If there's no `scripts/tsconfig.json`, run:

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "resolve" || echo "No errors"
```

- [ ] **Step 3: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add scripts/resolve.ts && git commit -m "feat: resolve script pays out winners and records realizedPL"
```

---

### Task 3: Update HistoryTable to show realizedPL

**Files:**
- Modify: `src/components/portfolio/HistoryTable.tsx`

- [ ] **Step 1: Replace the file contents**

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
            {["Market", "Ticker", "Side", "Shares", "Avg cost", "Payout", "P&L", "Result"].map((h) => (
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
            const realizedPL = p.realizedPL ?? (won ? payout - p.shares * p.avgCostCents : -(p.shares * p.avgCostCents));

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
                <td className="py-3 pr-4 tabular text-white">{formatCents(p.shares * p.avgCostCents)}</td>
                <td className="py-3 pr-4 tabular text-white">{formatCents(payout)}</td>
                <td className="py-3 pr-4 tabular font-medium" style={{
                  color: realizedPL >= 0 ? "var(--color-yes)" : "var(--color-no)",
                }}>
                  {realizedPL >= 0 ? "+" : ""}{formatCents(Math.abs(realizedPL))}
                </td>
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

Note: The `realizedPL` fallback calculation (`p.realizedPL ?? ...`) handles positions resolved before this change was deployed — they won't have `realizedPL` stored, so we compute it client-side as a graceful fallback.

The "Avg cost" column now shows `shares * avgCostCents` (total cost) instead of per-share cost, since that's more useful alongside the P&L column.

- [ ] **Step 2: TypeScript check**

```bash
cd /c/Users/jmena/Desktop/stockbet && npx tsc --noEmit 2>&1 | grep "HistoryTable" || echo "No errors"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/jmena/Desktop/stockbet && git add src/components/portfolio/HistoryTable.tsx && git commit -m "feat: HistoryTable shows realizedPL column"
```
