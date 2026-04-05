import { redirect } from "next/navigation";
import { Suspense } from "react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { BalanceTopUp } from "@/components/portfolio/BalanceTopUp";
import { PortfolioSummary } from "@/components/portfolio/PortfolioSummary";
import { PortfolioTabs } from "@/components/portfolio/PortfolioTabs";
import { PositionsTable } from "@/components/portfolio/PositionsTable";
import { CompanyWatchlistTable } from "@/components/portfolio/CompanyWatchlistTable";
import { HistoryTable } from "@/components/portfolio/HistoryTable";
import {
  getPortfolioSummary,
  getOpenPositions,
  getCompanyWatchlist,
  getPositionHistory,
} from "@/lib/queries/portfolio";

export const dynamic = "force-dynamic";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { tab = "positions" } = await searchParams;
  const userId = session.user.id;

  const [user, summary] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { cashBalanceCents: true, lastTopUpAt: true },
    }),
    getPortfolioSummary(userId),
  ]);

  if (!user) redirect("/auth/signin");

  const isOnCooldown =
    user.lastTopUpAt !== null &&
    Date.now() - user.lastTopUpAt.getTime() < 24 * 60 * 60 * 1000;
  const nextTopUpAt =
    isOnCooldown && user.lastTopUpAt
      ? new Date(user.lastTopUpAt.getTime() + 24 * 60 * 60 * 1000).toISOString()
      : null;

  const openPositions = tab === "positions" ? await getOpenPositions(userId) : null;
  const watchlist = tab === "watchlist" ? await getCompanyWatchlist(userId) : null;
  const history = tab === "history" ? await getPositionHistory(userId) : null;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-medium text-white mb-2">Portfolio</h1>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
          Your balance and open positions
        </p>
      </div>

      <BalanceTopUp
        initialCashBalanceCents={Number(user.cashBalanceCents)}
        initialNextTopUpAt={nextTopUpAt}
      />

      <PortfolioSummary summary={summary} />

      <Suspense>
        <PortfolioTabs />
      </Suspense>

      {tab === "positions" && openPositions && (
        <PositionsTable positions={openPositions} />
      )}
      {tab === "watchlist" && watchlist && (
        <CompanyWatchlistTable initialItems={watchlist} />
      )}
      {tab === "history" && history && (
        <HistoryTable history={history} />
      )}
    </div>
  );
}
