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
    <div className="glass-card overflow-x-auto px-4">
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
                          ? "rgba(148,228,132,0.15)"
                          : "rgba(216,72,56,0.15)",
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
                        ? "rgba(148,228,132,0.15)"
                        : "rgba(216,72,56,0.15)",
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
