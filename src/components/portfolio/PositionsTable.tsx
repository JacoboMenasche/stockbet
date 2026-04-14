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
    <div className="glass-card overflow-x-auto px-4">
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
