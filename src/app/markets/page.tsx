import { Suspense } from "react";
import { getMarketFeed } from "@/lib/queries/markets";
import { MarketRow } from "@/components/markets/MarketRow";
import { FeedControls } from "@/components/markets/FeedControls";
import { daysUntil } from "@/lib/format";
import { metricLabel } from "@/lib/metricLabel";

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: string }>;
}

export const dynamic = "force-dynamic";

export default async function MarketsPage({ searchParams }: PageProps) {
  const { q, sort } = await searchParams;

  const events = await getMarketFeed({
    q: q ?? "",
    sort: sort === "volume" ? "volume" : "time",
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-1">Active markets</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Trade on financial statement outcomes before earnings reports publish
        </p>
      </div>

      {/* Controls */}
      <Suspense>
        <FeedControls />
      </Suspense>

      {/* Market rows */}
      {events.length === 0 ? (
        <div
          className="rounded-xl border py-16 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            {q ? `No markets matching "${q}"` : "No open markets yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <MarketRow
              key={event.id}
              ticker={event.company.ticker}
              companyName={event.company.name}
              reportDate={event.reportDate}
              totalVolume={event.totalVolume}
              contracts={event.markets.map((m) => ({
                marketId: m.id,
                question: m.question,
                metricLabel: metricLabel(m.metricType),
                thresholdLabel: m.thresholdLabel,
                yesPrice: m.yesPriceLatest,
                noPrice: m.noPriceLatest,
                volume24h: m.volume24h,
                probabilitySnaps: m.probabilitySnaps,
              }))}
              defaultExpanded={daysUntil(event.reportDate) <= 7}
            />
          ))}
        </div>
      )}
    </div>
  );
}
