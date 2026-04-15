import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getMarketFeed } from "@/lib/queries/markets";
import { MarketRow } from "@/components/markets/MarketRow";
import { FeedControls } from "@/components/markets/FeedControls";
import { TrendingView } from "@/components/markets/TrendingView";
import { metricLabel } from "@/lib/metricLabel";

interface PageProps {
  searchParams: Promise<{ q?: string; sort?: string; section?: string }>;
}

export const dynamic = "force-dynamic";

export default async function MarketsPage({ searchParams }: PageProps) {
  const { q, sort, section } = await searchParams;
  const session = await auth();

  const isTrending = !section || section === "trending";

  const [companies, bookmarkedCompanyIds] = await Promise.all([
    getMarketFeed({
      q: q ?? "",
      sort: isTrending ? "totalVolume" : sort === "volume" ? "volume" : "time",
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
    <div className="app-container">
      <div className="page-header">
        <h1 className="page-title">
          {isTrending ? "Trending" : "All Markets"}
        </h1>
        <p className="page-subtitle">
          Daily stock price predictions — direction, targets, and volatility
        </p>
      </div>

      {isTrending ? (
        <>
          <Suspense>
            <FeedControls hideSort />
          </Suspense>
          <TrendingView companies={companies} />
        </>
      ) : (
        <>
          <Suspense>
            <FeedControls />
          </Suspense>
          {companies.length === 0 ? (
            <div className="glass-card py-16 text-center">
              <p className="text-sm" style={{ color: "var(--color-text-soft)" }}>
                {q ? `No markets matching "${q}"` : "No open markets yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
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
        </>
      )}
    </div>
  );
}
