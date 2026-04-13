import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { TradePanel } from "@/components/markets/TradePanel";
import { OrderBook } from "@/components/markets/OrderBook";
import { MarketWatchlistButton } from "@/components/markets/MarketWatchlistButton";
import { formatDate, formatVolume } from "@/lib/format";
import { metricLabel } from "@/lib/metricLabel";
import { getBestBid, getBestAsk } from "@/lib/order-book";
import { OrderStatus, OrderAction, Side } from "@prisma/client";

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
    include: { company: true },
  });

  if (!market) notFound();

  const isOpen = market.status === "OPEN";

  // Fetch open orders to compute best bid/ask for the trade panel
  const openOrders = await db.order.findMany({
    where: {
      marketId,
      status: { in: [OrderStatus.OPEN, OrderStatus.PARTIALLY_FILLED] },
    },
    select: { userId: true, side: true, action: true, price: true, shares: true, filledShares: true, id: true },
  });

  // Compute bids and asks for best price display
  const bids = openOrders
    .filter(
      (o) =>
        (o.action === OrderAction.BUY && o.side === Side.YES) ||
        (o.action === OrderAction.SELL && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: o.side === Side.YES ? o.price! : 100 - o.price!,
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);

  const asks = openOrders
    .filter(
      (o) =>
        (o.action === OrderAction.SELL && o.side === Side.YES) ||
        (o.action === OrderAction.BUY && o.side === Side.NO)
    )
    .map((o) => ({
      id: o.id,
      userId: o.userId,
      price: o.side === Side.YES ? o.price! : 100 - o.price!,
      available: o.shares - o.filledShares,
    }))
    .filter((e) => e.available > 0);

  const bestBid = getBestBid(bids) ?? market.yesPriceLatest;
  const bestAsk = getBestAsk(asks) ?? market.yesPriceLatest;

  const bookmarked = session?.user?.id
    ? !!(await db.watchlist.findUnique({
        where: { userId_marketId: { userId: session.user.id, marketId: market.id } },
      }))
    : false;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Breadcrumb + watchlist button */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
          {market.company.ticker} · {metricLabel(market.metricType)}
          {market.betDate ? ` · ${formatDate(market.betDate)}` : ""}
        </p>
        {session && (
          <MarketWatchlistButton marketId={market.id} initialBookmarked={bookmarked} />
        )}
      </div>

      {/* Question */}
      <h1 className="text-xl font-medium text-white mb-2">{market.question}</h1>
      <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.4)" }}>
        Threshold: {market.thresholdLabel}
        {market.consensusEstimate ? ` · Analyst est. ${market.consensusEstimate}` : ""}
      </p>

      {/* Prices + volume */}
      <div className="flex items-center gap-6 mb-8">
        <div>
          <p className="text-2xl font-semibold tabular" style={{ color: "var(--color-yes)" }}>
            {market.yesPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>YES</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular" style={{ color: "var(--color-no)" }}>
            {market.noPriceLatest}¢
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>NO</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-sm font-medium text-white/60 tabular">
            {formatVolume(market.totalVolume)}
          </p>
          <p className="text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>Total volume</p>
        </div>
      </div>

      {/* Order book + trade panel side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <OrderBook marketId={market.id} />
        {session ? (
          <TradePanel
            marketId={market.id}
            isOpen={isOpen}
            bestAsk={bestAsk}
            bestBid={bestBid}
          />
        ) : (
          <div
            className="rounded-xl border p-6 text-center flex items-center justify-center"
            style={{ borderColor: "rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
              <a href="/auth/signin" className="underline hover:text-white transition-colors">
                Sign in
              </a>{" "}
              to trade.
            </p>
          </div>
        )}
      </div>

      {/* Resolution criteria */}
      {market.resolutionCriteria && (
        <div className="mt-4">
          <div className="h-px w-full mb-4" style={{ backgroundColor: "rgba(255,255,255,0.06)" }} />
          <h2
            className="text-xs font-medium mb-2 uppercase tracking-wider"
            style={{ color: "rgba(255,255,255,0.3)" }}
          >
            Resolution Criteria
          </h2>
          <div className="rounded-lg px-4 py-3" style={{ backgroundColor: "rgba(255,255,255,0.03)" }}>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              {market.resolutionCriteria}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
