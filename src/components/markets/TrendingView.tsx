import Link from "next/link";
import { Sparkline } from "./Sparkline";
import { ProbabilityBar } from "./ProbabilityBar";
import { YesNoPrice } from "./YesNoPrice";
import { formatVolume } from "@/lib/format";
import { metricLabel } from "@/lib/metricLabel";
import type { MarketFeedCompany } from "@/lib/queries/markets";

interface TrendingViewProps {
  companies: MarketFeedCompany[];
}

export function TrendingView({ companies }: TrendingViewProps) {
  if (companies.length === 0) {
    return (
      <div className="glass-card py-16 text-center">
        <p className="text-sm" style={{ color: "var(--color-text-soft)" }}>
          No open markets yet.
        </p>
      </div>
    );
  }

  const [hero, ...rest] = companies;
  // Use the highest-volume contract from the hero company as the featured market
  // (getMarketFeed guarantees each company entry has ≥1 market, so plain reduce is safe)
  const heroMarket = hero.markets.reduce((best, m) =>
    BigInt(m.totalVolume) > BigInt(best.totalVolume) ? m : best
  );

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <Link
        href={`/markets/${heroMarket.id}`}
        className="block glass-card p-5 hover:border-white/20 transition-colors group"
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="inline-flex items-center justify-center h-6 px-2 rounded text-xs font-semibold tracking-wider"
            style={{ backgroundColor: "var(--color-brand-surface-strong)", color: "var(--color-text-muted)" }}
          >
            {hero.company.ticker}
          </span>
          <span className="text-xs font-medium" style={{ color: "var(--color-yes)" }}>
            Trending #1
          </span>
        </div>
        <p className="text-base font-semibold leading-snug mb-1 group-hover:opacity-80 transition-opacity" style={{ color: "var(--color-text-main)" }}>
          {heroMarket.question}
        </p>
        <p className="text-xs mb-3" style={{ color: "var(--color-text-soft)" }}>
          {metricLabel(heroMarket.metricType)} · {heroMarket.thresholdLabel} · Vol {formatVolume(heroMarket.totalVolume)}
        </p>
        <Sparkline data={heroMarket.probabilitySnaps} height={56} fallbackPrice={heroMarket.yesPriceLatest} />
        <div className="grid grid-cols-2 gap-2 mt-4">
          <div
            className="flex flex-col items-center justify-center py-3 rounded-lg font-semibold text-sm"
            style={{
              backgroundColor: "rgba(120, 190, 105, 0.18)",
              border: "1px solid rgba(120, 190, 105, 0.3)",
              color: "rgba(140, 210, 120, 0.95)",
            }}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-70 mb-0.5">Buy YES</span>
            <span className="text-lg font-bold tabular">{heroMarket.yesPriceLatest}¢</span>
          </div>
          <div
            className="flex flex-col items-center justify-center py-3 rounded-lg font-semibold text-sm"
            style={{
              backgroundColor: "rgba(190, 70, 55, 0.18)",
              border: "1px solid rgba(190, 70, 55, 0.3)",
              color: "rgba(210, 90, 75, 0.95)",
            }}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider opacity-70 mb-0.5">Buy NO</span>
            <span className="text-lg font-bold tabular">{heroMarket.noPriceLatest}¢</span>
          </div>
        </div>
      </Link>

      {/* 2-col grid */}
      {rest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {rest.map((entry) => {
            const topMarket = entry.markets.reduce((best, m) =>
              BigInt(m.totalVolume) > BigInt(best.totalVolume) ? m : best
            );
            return (
              <Link
                key={entry.id}
                href={`/markets/${topMarket.id}`}
                className="glass-card p-4 hover:border-white/20 transition-colors group block"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="inline-flex items-center justify-center h-6 px-2 rounded text-xs font-semibold tracking-wider shrink-0"
                    style={{ backgroundColor: "var(--color-brand-surface-strong)", color: "var(--color-text-muted)" }}
                  >
                    {entry.company.ticker}
                  </span>
                  <span className="text-xs truncate" style={{ color: "var(--color-text-soft)" }}>
                    {entry.company.name}
                  </span>
                </div>
                <p className="text-sm font-medium leading-snug mb-2 line-clamp-2 group-hover:opacity-80 transition-opacity" style={{ color: "var(--color-text-main)" }}>
                  {topMarket.question}
                </p>
                <div className="mb-3">
                  <ProbabilityBar yesPrice={topMarket.yesPriceLatest} noPrice={topMarket.noPriceLatest} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <YesNoPrice
                    yesPrice={topMarket.yesPriceLatest}
                    noPrice={topMarket.noPriceLatest}
                    className="shrink-0"
                  />
                  <span className="text-xs tabular" style={{ color: "var(--color-text-soft)" }}>
                    {formatVolume(entry.totalVolume)}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
