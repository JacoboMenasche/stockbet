import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getCompanyDetail } from "@/lib/queries/company";
import { StockChartWithRanges } from "@/components/company/StockChartWithRanges";
import { CompanyWatchlistButton } from "@/components/company/CompanyWatchlistButton";
import { MarketWatchlistButton } from "@/components/markets/MarketWatchlistButton";
import { metricLabel } from "@/lib/metricLabel";
import { formatVolume, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ticker: string }>;
}

export default async function CompanyPage({ params }: PageProps) {
  const { ticker } = await params;
  const session = await auth();

  let company;
  try {
    company = await getCompanyDetail(ticker);
  } catch {
    notFound();
  }

  const [companyBookmarked, bookmarkedMarketIds] = await Promise.all([
    session?.user?.id
      ? db.companyWatchlist
          .findUnique({
            where: {
              userId_companyId: {
                userId: session.user.id,
                companyId: company.id,
              },
            },
          })
          .then(Boolean)
      : Promise.resolve(false),
    session?.user?.id
      ? db.watchlist
          .findMany({
            where: {
              userId: session.user.id,
              market: { companyId: company.id },
            },
            select: { marketId: true },
          })
          .then((rows) => new Set(rows.map((r) => r.marketId)))
      : Promise.resolve(new Set<string>()),
  ]);

  const event = company.earningsEvents[0] ?? null;
  const markets = company.markets;

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center gap-4 mb-6">
        <span
          className="inline-flex items-center justify-center h-10 w-16 rounded-md text-sm font-semibold tracking-wider"
          style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.7)" }}
        >
          {company.ticker}
        </span>
        <div>
          <h1 className="text-xl font-medium text-white">{company.name}</h1>
          {company.sector && (
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.35)" }}>
              {company.sector}
            </p>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {event && (
            <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              Reports {formatDate(event.reportDate)}
            </span>
          )}
          {session && (
            <CompanyWatchlistButton
              companyId={company.id}
              initialBookmarked={companyBookmarked}
            />
          )}
        </div>
      </div>

      <div
        className="rounded-xl border p-4 mb-6"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}
      >
        <StockChartWithRanges ticker={company.ticker} />
      </div>

      {markets.length === 0 ? (
        <div
          className="rounded-xl border py-12 text-center"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>
            No open markets for this company today.
          </p>
        </div>
      ) : (
        <>
          <h2 className="text-sm font-medium mb-3" style={{ color: "rgba(255,255,255,0.5)" }}>
            Today&apos;s contracts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {markets.map((m) => (
              <div
                key={m.id}
                className="relative rounded-xl border hover:border-white/20 transition-colors"
                style={{
                  borderColor: "rgba(255,255,255,0.06)",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                <a
                  href={`/markets/${m.id}`}
                  className="absolute inset-0 rounded-xl"
                  aria-label={m.question}
                />
                <div className="p-4">
                  {session && (
                    <div className="relative z-10 flex justify-end mb-2">
                      <MarketWatchlistButton
                        marketId={m.id}
                        initialBookmarked={bookmarkedMarketIds.has(m.id)}
                      />
                    </div>
                  )}
                  <p
                    className="text-xs uppercase tracking-wider mb-1"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    {metricLabel(m.metricType)}
                  </p>
                  <p className="text-sm font-medium text-white mb-3">{m.question}</p>
                  <div className="flex gap-2 mb-3">
                    <span
                      className="flex-1 text-center py-1.5 rounded-lg text-sm font-semibold"
                      style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80" }}
                    >
                      YES {m.yesPriceLatest}¢
                    </span>
                    <span
                      className="flex-1 text-center py-1.5 rounded-lg text-sm font-semibold"
                      style={{ background: "rgba(248,113,113,0.1)", color: "#f87171" }}
                    >
                      NO {m.noPriceLatest}¢
                    </span>
                  </div>
                  <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>
                    Vol {formatVolume(m.volume24h)} (24h)
                  </p>
                  {m.resolutionCriteria && (
                    <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-xs uppercase tracking-wider mb-1" style={{ color: "rgba(255,255,255,0.25)" }}>
                        Resolution Criteria
                      </p>
                      <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.4)" }}>
                        {m.resolutionCriteria}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
