import { formatCents } from "@/lib/format";
import type { PortfolioSummaryData } from "@/lib/queries/portfolio";

interface PortfolioSummaryProps {
  summary: PortfolioSummaryData;
}

export function PortfolioSummary({ summary }: PortfolioSummaryProps) {
  const { openPositionValue, unrealizedPL } = summary;
  const plPositive = unrealizedPL >= 0;

  return (
    <div className="grid grid-cols-2 gap-3 mb-6">
      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          Position value
        </p>
        <p className="text-xl font-semibold tabular text-white">
          {formatCents(openPositionValue)}
        </p>
      </div>

      <div
        className="rounded-xl border p-4"
        style={{
          borderColor: "rgba(255,255,255,0.08)",
          backgroundColor: "rgba(255,255,255,0.02)",
        }}
      >
        <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "rgba(255,255,255,0.3)" }}>
          Unrealized P&amp;L
        </p>
        <p
          className="text-xl font-semibold tabular"
          style={{ color: plPositive ? "var(--color-yes)" : "var(--color-no)" }}
        >
          {plPositive ? "+" : ""}{formatCents(unrealizedPL)}
        </p>
      </div>
    </div>
  );
}
