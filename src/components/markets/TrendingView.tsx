import Link from "next/link";
import { Sparkline } from "./Sparkline";
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
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
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
            <p className="text-base font-semibold leading-snug group-hover:opacity-80 transition-opacity" style={{ color: "var(--color-text-main)" }}>
              {heroMarket.question}
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--color-text-soft)" }}>
              {metricLabel(heroMarket.metricType)} · {heroMarket.thresholdLabel} · Vol {formatVolume(heroMarket.totalVolume)}
            </p>
          </div>
          <YesNoPrice
            yesPrice={heroMarket.yesPriceLatest}
            noPrice={heroMarket.noPriceLatest}
            className="shrink-0 w-32"
          />
        </div>
        <Sparkline data={heroMarket.probabilitySnaps} height={56} dual />
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
                <div className="mb-2.5">
                  <Sparkline data={topMarket.probabilitySnaps} height={32} dual />
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
