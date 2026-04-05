import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BuyPanel } from "@/components/markets/BuyPanel";
import { formatDate, formatVolume } from "@/lib/format";
import { metricLabel } from "@/lib/metricLabel";

export const dynamic = "force-dynamic";

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ marketId: string }>;
}) {
  const { marketId } = await params;
  const session = await auth();

  const market = await db.market.findUnique({
    where: { id: marketId },
    include: {
      company: true,
      earningsEvent: true,
    },
  });

  if (!market) notFound();

  const isOpen = market.status === "OPEN";

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Breadcrumb */}
      <p className="text-xs mb-6" style={{ color: "rgba(255,255,255,0.3)" }}>
        {market.company.ticker} · {metricLabel(market.metricType)} · Reports{" "}
        {formatDate(market.earningsEvent.reportDate)}
      </p>

      {/* Question */}
      <h1 className="text-xl font-medium text-white mb-2">{market.question}</h1>
      <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
        Threshold: {market.thresholdLabel}
        {market.consensusEstimate ? ` · Analyst est. ${market.consensusEstimate}` : ""}
      </p>

      {/* Prices + volume */}
      <div className="flex items-center gap-6 mb-8">
        <div>
          <p
            className="text-2xl font-semibold tabular"
            style={{ color: "var(--color-yes)" }}
          >
            {market.yesPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            YES
          </p>
        </div>
        <div>
          <p
            className="text-2xl font-semibold tabular"
            style={{ color: "var(--color-no)" }}
          >
            {market.noPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
            NO
          </p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-medium text-white/60 tabular">
            {formatVolume(market.totalVolume)}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            Total volume
          </p>
        </div>
      </div>

      {/* Buy panel */}
      {session ? (
        <BuyPanel
          marketId={market.id}
          initialYesPrice={market.yesPriceLatest}
          initialNoPrice={market.noPriceLatest}
          isOpen={isOpen}
        />
      ) : (
        <div
          className="rounded-xl border p-6 text-center"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
            <a href="/auth/signin" className="underline hover:text-white transition-colors">
              Sign in
            </a>{" "}
            to place bets.
          </p>
        </div>
      )}
    </div>
  );
}
