import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMarketFeed } from "@/lib/queries/markets";
import { MarketRow } from "@/components/markets/MarketRow";
import { FeedControls } from "@/components/markets/FeedControls";
import { metricLabel } from "@/lib/metricLabel";

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: string }>;
}

export const dynamic = "force-dynamic";

export default async function MarketsPage({ searchParams }: PageProps) {
  const { q, sort } = await searchParams;
  const session = await auth();

  const [companies, bookmarkedCompanyIds] = await Promise.all([
    getMarketFeed({
      q: q ?? "",
      sort: sort === "volume" ? "volume" : "time",
    }),
    session?.user?.id
      ? db.companyWatchlist
          .findMany({
            where: { userId: session.user.id },
            select: { companyId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.companyId)))
      : Promise.resolve(new Set<string>()),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-1">Active markets</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Daily stock price predictions — direction, targets, and volatility
        </p>
      </div>

      <Suspense>
        <FeedControls />
      </Suspense>

      {companies.length === 0 ? (
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
          {companies.map((entry) => (
            <MarketRow
              key={entry.id}
              ticker={entry.company.ticker}
              companyName={entry.company.name}
              companyId={session ? entry.company.id : undefined}
              initialCompanyBookmarked={bookmarkedCompanyIds.has(entry.company.id)}
              reportDate={entry.betDate}
              totalVolume={entry.totalVolume}
              contracts={entry.markets.map((m) => ({
                marketId: m.id,
                question: m.question,
                metricLabel: metricLabel(m.metricType),
                thresholdLabel: m.thresholdLabel,
                yesPrice: m.yesPriceLatest,
                noPrice: m.noPriceLatest,
                volume24h: m.volume24h,
                probabilitySnaps: m.probabilitySnaps,
              }))}
              defaultExpanded={true}
            />
          ))}
        </div>
      )}
    </div>
  );
}
